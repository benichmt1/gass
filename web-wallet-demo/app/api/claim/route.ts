import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, keccak256, encodePacked, toBytes, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as jose from 'jose';

if (!process.env.ADMIN_PRIVATE_KEY) {
    throw new Error('ADMIN_PRIVATE_KEY environment variable is required');
}
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as Hex;
const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);

const GASS_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_GASS_CONTRACT_ADDRESS || '0xF35C0460Df0678c21FE813971C5087B5fd03366A') as `0x${string}`;
const O2_ORACLE_ADDRESS     = (process.env.NEXT_PUBLIC_O2_ORACLE_ADDRESS     || '0xa23F689466F1D6f93b0B598aAEf390Db2CA3614F') as `0x${string}`;
const RPC_URL               =  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL  || 'https://base-sepolia-rpc.publicnode.com';

const O2_ORACLE_ABI = [
    { inputs: [{ type: 'string', name: 'username' }], name: 'getQuality_score', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'string', name: 'username' }], name: 'getLast_updated',  outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'string', name: 'username' }], name: 'getReview_count',  outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

const GASS_ABI = [
    {
        inputs: [
            { internalType: 'address',  name: 'to',                    type: 'address' },
            { internalType: 'uint256',  name: 'amount',                type: 'uint256' },
            { internalType: 'string',   name: 'githubUsername',        type: 'string'  },
            { internalType: 'bytes',    name: 'signature',             type: 'bytes'   },
            { internalType: 'uint256',  name: 'verificationTimestamp', type: 'uint256' },
        ],
        name: 'processReward',
        outputs: [{ internalType: 'bool', name: 'success', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs:  [{ internalType: 'string', name: 'githubUsername', type: 'string' }],
        name:    'hasDistributionBeenProcessed',
        outputs: [{ internalType: 'bool',   name: 'distributed',   type: 'bool'   }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

const TIER_AMOUNTS = {
    LIMITED:  BigInt( 50) * BigInt(10 ** 18),
    STANDARD: BigInt(100) * BigInt(10 ** 18),
    BONUS:    BigInt(200) * BigInt(10 ** 18),
};

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });

async function getOracleTier(githubUsername: string): Promise<{ tier: string; amount: bigint }> {
    const [rawScore, rawLastUpdated, rawReviewCount] = await Promise.all([
        publicClient.readContract({ address: O2_ORACLE_ADDRESS, abi: O2_ORACLE_ABI, functionName: 'getQuality_score', args: [githubUsername] }),
        publicClient.readContract({ address: O2_ORACLE_ADDRESS, abi: O2_ORACLE_ABI, functionName: 'getLast_updated',  args: [githubUsername] }),
        publicClient.readContract({ address: O2_ORACLE_ADDRESS, abi: O2_ORACLE_ABI, functionName: 'getReview_count',  args: [githubUsername] }),
    ]);

    const qualityScore = Number(rawScore);
    const lastUpdated  = Number(rawLastUpdated);
    const reviewCount  = Number(rawReviewCount);

    console.log(`O2 Oracle for ${githubUsername}: score=${qualityScore} lastUpdated=${lastUpdated} reviews=${reviewCount}`);

    if (qualityScore <= 50) return { tier: 'Rejected', amount: 0n };
    if (lastUpdated < 1750000000) return { tier: 'Limited',  amount: TIER_AMOUNTS.LIMITED  };
    if (reviewCount > 100)        return { tier: 'Bonus',    amount: TIER_AMOUNTS.BONUS    };
    return                               { tier: 'Standard', amount: TIER_AMOUNTS.STANDARD };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { githubUsername, address, proof, timestamp } = body;

        if (!githubUsername || !address || !proof || !timestamp) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // --- 1. Verify Dynamic JWT ---
        const dynamicEnvId = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID || '29ed16d2-1bac-4503-bfe0-1dbdc206af0a';
        const JWKS = jose.createRemoteJWKSet(new URL(`https://app.dynamic.xyz/api/v0/sdk/${dynamicEnvId}/.well-known/jwks`));

        let jwtPayload: jose.JWTPayload;
        try {
            const { payload } = await jose.jwtVerify(proof, JWKS);
            jwtPayload = payload;
        } catch (jwtErr) {
            console.warn('JWT verification failed:', jwtErr);
            return NextResponse.json({ error: 'Invalid or expired verification proof' }, { status: 401 });
        }

        const verifiedCredentials = (jwtPayload as any).verified_credentials as Array<any> | undefined;
        const githubCred = verifiedCredentials?.find(
            (c) =>
                c.provider === 'github'       || c.oauthProvider === 'github' ||
                c.oauth_provider === 'github' ||
                (c.format === 'oauth' && (c.oauthProvider === 'github' || c.oauth_provider === 'github'))
        );
        const extractedUsername = githubCred?.oauthUsername || githubCred?.oauth_username || githubCred?.username;

        if (!extractedUsername) {
            console.warn('No GitHub credential in JWT. verifiedCredentials:', JSON.stringify(verifiedCredentials));
            return NextResponse.json({ error: 'No GitHub credential found in verification proof' }, { status: 401 });
        }
        if (extractedUsername !== githubUsername) {
            console.warn(`Username mismatch: JWT="${extractedUsername}" submitted="${githubUsername}"`);
            return NextResponse.json({ error: 'GitHub username mismatch' }, { status: 401 });
        }

        // --- 2. Check oracle tier ---
        let tier: string;
        let amount: bigint;
        try {
            ({ tier, amount } = await getOracleTier(githubUsername));
        } catch (oracleErr) {
            console.error('O2 Oracle read failed:', oracleErr);
            return NextResponse.json({ error: 'Oracle unavailable, please try again' }, { status: 503 });
        }

        if (tier === 'Rejected' || amount === 0n) {
            return NextResponse.json({ error: 'Quality score too low — not eligible for rewards' }, { status: 403 });
        }

        // --- 3. Check not already claimed ---
        const alreadyClaimed = await publicClient.readContract({
            address: GASS_CONTRACT_ADDRESS,
            abi: GASS_ABI,
            functionName: 'hasDistributionBeenProcessed',
            args: [githubUsername],
        });
        if (alreadyClaimed) {
            return NextResponse.json({ error: 'Reward already claimed for this account' }, { status: 409 });
        }

        // --- 4. Sign the claim permit ---
        const messageHash = keccak256(
            encodePacked(
                ['string', 'address', 'uint256', 'uint256'],
                [githubUsername, address as `0x${string}`, BigInt(timestamp), amount]
            )
        );
        const signature = await account.signMessage({ message: { raw: toBytes(messageHash) } });

        // --- 5. Submit transaction (admin pays gas) ---
        let txHash: string;
        try {
            const { request: contractRequest } = await publicClient.simulateContract({
                address: GASS_CONTRACT_ADDRESS,
                abi: GASS_ABI,
                functionName: 'processReward',
                args: [address as `0x${string}`, amount, githubUsername, signature, BigInt(timestamp)],
                account,
            });
            txHash = await walletClient.writeContract(contractRequest);
        } catch (txErr: any) {
            console.error('Transaction failed:', txErr);
            return NextResponse.json({ error: txErr?.shortMessage || txErr?.message || 'Transaction failed' }, { status: 500 });
        }

        console.log(`Claim submitted for ${githubUsername}: txHash=${txHash}`);

        return NextResponse.json({
            success: true,
            txHash,
            tier,
            amount: amount.toString(),
        });

    } catch (error) {
        console.error('Error in /api/claim:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
