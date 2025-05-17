import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';

// GASS Contract address on Base Sepolia
export const GASS_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GASS_CONTRACT_ADDRESS || '0x171A95CE45025f0AE0e56eC67Bf7084117e335d8';

// O2 Oracle address on Base Sepolia
export const O2_ORACLE_ADDRESS = process.env.NEXT_PUBLIC_O2_ORACLE_ADDRESS || '0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2';

// Base Sepolia RPC URL
export const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';

// Minimal ABI for the GASS contract's processReward function
export const GASS_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "string", "name": "githubUsername", "type": "string"},
      {"internalType": "string", "name": "verificationToken", "type": "string"},
      {"internalType": "uint256", "name": "verificationTimestamp", "type": "uint256"}
    ],
    "name": "processReward",
    "outputs": [{"internalType": "bool", "name": "success", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "githubUsername", "type": "string"}
    ],
    "name": "hasDistributionBeenProcessed",
    "outputs": [{"internalType": "bool", "name": "distributed", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Create a public client for read-only operations
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// Tier definitions based on the actual policy
export enum RewardTier {
  NONE = 'None',
  REJECTED = 'Rejected',
  LIMITED = 'Limited',
  STANDARD = 'Standard',
  BONUS = 'Bonus'
}

export interface EligibilityResult {
  hasReceived: boolean;
  eligibleTier: RewardTier;
  qualityScore?: number;
  lastUpdated?: number;
  reviewCount?: number;
  error?: string;
}

// Check if a GitHub username has already received a distribution
export async function checkDistributionStatus(githubUsername: string): Promise<boolean> {
  try {
    const hasReceived = await publicClient.readContract({
      address: GASS_CONTRACT_ADDRESS as Address,
      abi: GASS_ABI,
      functionName: 'hasDistributionBeenProcessed',
      args: [githubUsername],
    });

    return hasReceived as boolean;
  } catch (error) {
    console.error('Error checking distribution status:', error);
    return false;
  }
}

// Check eligibility and determine which tier the user qualifies for
export async function checkEligibilityTier(githubUsername: string): Promise<EligibilityResult> {
  try {
    // First check if the user has already received a distribution
    const hasReceived = await checkDistributionStatus(githubUsername);

    if (hasReceived) {
      return {
        hasReceived: true,
        eligibleTier: RewardTier.NONE
      };
    }

    // For a real implementation, we would query the O2 Oracle directly
    // or use the GASS contract to determine eligibility based on the criteria
    // For this demo, we'll use hardcoded values for benichmt1

    if (githubUsername === 'benichmt1') {
      // Based on the README and policy, benichmt1 has:
      // - Quality score of 63 (> 50, so passes first rule)
      // - Last updated timestamp of 1747331744 (< 1750000000, so matches LIMITED tier)
      // - Review count of 15 (< 100, so not eligible for BONUS tier)

      const qualityScore = 63;
      const lastUpdated = 1747331744;
      const reviewCount = 15; // Based on our simulation

      // Apply the actual policy rules:

      // Rule 1: If quality score <= 50, REJECTED
      if (qualityScore <= 50) {
        return {
          hasReceived: false,
          eligibleTier: RewardTier.REJECTED,
          qualityScore,
          lastUpdated,
          reviewCount
        };
      }

      // Rule 2: If quality score > 50 AND last updated < 1750000000, LIMITED
      if (qualityScore > 50 && lastUpdated < 1750000000) {
        return {
          hasReceived: false,
          eligibleTier: RewardTier.LIMITED,
          qualityScore,
          lastUpdated,
          reviewCount
        };
      }

      // Rule 3: If quality score > 50 AND last updated >= 1750000000 AND review count > 100, BONUS
      if (qualityScore > 50 && lastUpdated >= 1750000000 && reviewCount > 100) {
        return {
          hasReceived: false,
          eligibleTier: RewardTier.BONUS,
          qualityScore,
          lastUpdated,
          reviewCount
        };
      }

      // Rule 4: If quality score > 50 AND last updated >= 1750000000 AND review count <= 100, STANDARD
      if (qualityScore > 50 && lastUpdated >= 1750000000 && reviewCount <= 100) {
        return {
          hasReceived: false,
          eligibleTier: RewardTier.STANDARD,
          qualityScore,
          lastUpdated,
          reviewCount
        };
      }

      // Fallback (should never reach here based on the rules)
      return {
        hasReceived: false,
        eligibleTier: RewardTier.NONE,
        qualityScore,
        lastUpdated,
        reviewCount,
        error: "No matching tier found - this should never happen"
      };
    } else {
      // For other usernames, create a simulated profile
      // Let's make it eligible for STANDARD tier
      const qualityScore = 75;
      const lastUpdated = 1755000000; // Recent activity
      const reviewCount = 50; // Moderate activity

      return {
        hasReceived: false,
        eligibleTier: RewardTier.STANDARD,
        qualityScore,
        lastUpdated,
        reviewCount
      };
    }
  } catch (error) {
    console.error('Error checking eligibility tier:', error);
    return {
      hasReceived: false,
      eligibleTier: RewardTier.NONE,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Process a reward for a GitHub username using the connected wallet
export async function processReward(
  walletClient: any,
  to: Address,
  amount: bigint,
  githubUsername: string,
  verificationProof?: string,
  verificationTimestamp?: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Default values for verification if not provided
    const proof = verificationProof || '';
    const timestamp = verificationTimestamp || Math.floor(Date.now() / 1000);

    // Prepare the transaction
    const { request } = await publicClient.simulateContract({
      address: GASS_CONTRACT_ADDRESS as Address,
      abi: GASS_ABI,
      functionName: 'processReward',
      args: [to, amount, githubUsername, proof, BigInt(timestamp)],
      account: to,
    });

    // Send the transaction
    const hash = await walletClient.writeContract(request);

    return { success: true, txHash: hash };
  } catch (error: any) {
    console.error('Error processing reward:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error occurred while processing reward'
    };
  }
}
