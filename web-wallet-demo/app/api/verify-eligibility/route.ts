import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, keccak256, encodePacked, toBytes, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

if (!process.env.ADMIN_PRIVATE_KEY) {
    throw new Error('ADMIN_PRIVATE_KEY environment variable is required');
}
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as Hex;
const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);

const O2_ORACLE_ADDRESS = (process.env.NEXT_PUBLIC_O2_ORACLE_ADDRESS || '0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2') as `0x${string}`;
const RPC_URL           = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';

const O2_ORACLE_ABI = [
    { inputs: [{ type: 'string', name: 'username' }], name: 'getQuality_score', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'string', name: 'username' }], name: 'getLast_updated',  outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ type: 'string', name: 'username' }], name: 'getReview_count',  outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

// Tier amounts in GASS wei (18 decimals)
const TIER_AMOUNTS = {
    LIMITED:  BigInt( 50) * BigInt(10 ** 18),
    STANDARD: BigInt(100) * BigInt(10 ** 18),
    BONUS:    BigInt(200) * BigInt(10 ** 18),
};

async function getOracleTier(githubUsername: string): Promise<{ tier: string; amount: bigint }> {
    const [rawScore, rawLastUpdated, rawReviewCount] = await Promise.all([
        publicClient.readContract({ address: O2_ORACLE_ADDRESS, abi: O2_ORACLE_ABI, functionName: 'getQuality_score', args: [githubUsername] }),
        publicClient.readContract({ address: O2_ORACLE_ADDRESS, abi: O2_ORACLE_ABI, functionName: 'getLast_updated',  args: [githubUsername] }),
        publicClient.readContract({ address: O2_ORACLE_ADDRESS, abi: O2_ORACLE_ABI, functionName: 'getReview_count',  args: [githubUsername] }),
    ]);

    const qualityScore = Number(rawScore);
    const lastUpdated  = Number(rawLastUpdated);
    const reviewCount  = Number(rawReviewCount);

    console.log(`O2 Oracle data for ${githubUsername}: score=${qualityScore} lastUpdated=${lastUpdated} reviews=${reviewCount}`);

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

        if (proof.length < 10) {
            return NextResponse.json({ error: 'Invalid verification proof' }, { status: 401 });
        }

        // Read tier from O2 Oracle (same logic as the on-chain RE policy)
        let tier: string;
        let amount: bigint;

        try {
            ({ tier, amount } = await getOracleTier(githubUsername));
        } catch (oracleErr) {
            console.warn('O2 Oracle read failed, falling back to Standard tier:', oracleErr);
            tier   = 'Standard';
            amount = TIER_AMOUNTS.STANDARD;
        }

        if (tier === 'Rejected' || amount === 0n) {
            return NextResponse.json({ error: 'Quality score too low — not eligible for rewards' }, { status: 403 });
        }

        // Sign the claim permit exactly as the contract expects:
        // keccak256(abi.encodePacked(githubUsername, address, timestamp, amount))
        const messageHash = keccak256(
            encodePacked(
                ['string', 'address', 'uint256', 'uint256'],
                [githubUsername, address as `0x${string}`, BigInt(timestamp), amount]
            )
        );

        const signature = await account.signMessage({ message: { raw: toBytes(messageHash) } });

        return NextResponse.json({
            success: true,
            signature,
            tier,
            amount:       amount.toString(),
            trustedSigner: account.address,
        });

    } catch (error) {
        console.error('Error in verify-eligibility:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
