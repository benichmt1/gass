
import { NextResponse } from 'next/server';
import { createWalletClient, http, keccak256, encodePacked, toBytes, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Environment variable for the admin private key (trusted signer)
// In a real app, this MUST be in .env.local and never committed
// For this demo, we'll use a hardcoded private key if the env var is missing
// This account needs to be the one set as 'trustedSigner' in the contract
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as Hex || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Anvil default account 0
const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { githubUsername, address, proof, timestamp } = body;

        if (!githubUsername || !address || !proof || !timestamp) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // 1. Verify the JWT (Proof)
        // In a production environment, you would use a library like 'jose' to verify the JWT
        // against Dynamic's public keys (JWKS).
        // For this demo, we'll do a basic check to ensure the token exists and isn't empty.
        if (proof.length < 10) {
            return NextResponse.json(
                { error: 'Invalid verification proof' },
                { status: 401 }
            );
        }

        // Simulate verifying that the JWT belongs to the githubUsername
        // const decoded = decodeJwt(proof);
        // if (decoded.username !== githubUsername) throw new Error('Username mismatch');

        // 2. Determine Eligibility & Amount (Off-chain logic)
        // This logic moves from the client to the server for security
        let tier = 'Standard';
        let amount = 1000000000000000000n; // 1 ETH in wei

        if (githubUsername === 'michael-bey') {
            tier = 'Limited'; // Matches the README/previous logic
        }

        // 3. Sign the Claim Permit
        // Construct the message exactly as the contract expects it
        // Message: keccak256(abi.encodePacked(githubUsername, address, timestamp, amount))

        // Note: The message structure depends on what verifySignature in the contract expects.
        // Based on the original contract, it was:
        // "I confirm that I am the GitHub user \"...\" and the owner of wallet ..."

        // BUT we are updating the contract to use a Hash + Trusted Signer.
        // Let's stick to the secure standard: Hash(data)

        // We will update the contract to verify:
        // keccak256(abi.encodePacked(githubUsername, address, timestamp, amount))
        // So we sign THAT hash.

        // Encode the data
        const messageHash = keccak256(
            encodePacked(
                ['string', 'address', 'uint256', 'uint256'],
                [githubUsername, address, BigInt(timestamp), amount]
            )
        );

        // Sign the message hash
        const signature = await account.signMessage({
            message: { raw: toBytes(messageHash) }
        });

        return NextResponse.json({
            success: true,
            signature,
            tier,
            amount: amount.toString(), // JSON doesn't support BigInt
            trustedSigner: account.address
        });

    } catch (error) {
        console.error('Error in verify-eligibility:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
