import { createPublicClient, http, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';

// Contract addresses
export const GASS_CONTRACT_ADDRESS  = process.env.NEXT_PUBLIC_GASS_CONTRACT_ADDRESS  || '0xF35C0460Df0678c21FE813971C5087B5fd03366A';
export const GASS_TOKEN_ADDRESS     = process.env.NEXT_PUBLIC_GASS_TOKEN_ADDRESS     || '0x777E1Ad0Cfb52abbF5A5F70dB4382CC166d8DFf7';
export const O2_ORACLE_ADDRESS      = process.env.NEXT_PUBLIC_O2_ORACLE_ADDRESS      || '0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2';
export const RPC_URL                = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL   || 'https://base-sepolia-rpc.publicnode.com';

// Tier reward amounts (in GASS wei)
export const TIER_AMOUNTS = {
  LIMITED:  BigInt( 50) * BigInt(10 ** 18),  //  50 GASS
  STANDARD: BigInt(100) * BigInt(10 ** 18),  // 100 GASS
  BONUS:    BigInt(200) * BigInt(10 ** 18),  // 200 GASS
} as const;

export const GASS_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'to',                    type: 'address' },
      { internalType: 'uint256', name: 'amount',                type: 'uint256' },
      { internalType: 'string',  name: 'githubUsername',        type: 'string'  },
      { internalType: 'bytes',   name: 'signature',             type: 'bytes'   },
      { internalType: 'uint256', name: 'verificationTimestamp', type: 'uint256' },
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
  {
    inputs:  [],
    name:    'tokenBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Minimal O2 Oracle ABI — only the three getter functions used by the RE policy
export const O2_ORACLE_ABI = [
  {
    inputs:  [{ internalType: 'string', name: 'username', type: 'string' }],
    name:    'getQuality_score',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs:  [{ internalType: 'string', name: 'username', type: 'string' }],
    name:    'getLast_updated',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs:  [{ internalType: 'string', name: 'username', type: 'string' }],
    name:    'getReview_count',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export enum RewardTier {
  NONE     = 'None',
  REJECTED = 'Rejected',
  LIMITED  = 'Limited',
  STANDARD = 'Standard',
  BONUS    = 'Bonus',
}

export interface EligibilityResult {
  hasReceived:   boolean;
  eligibleTier:  RewardTier;
  qualityScore?: number;
  lastUpdated?:  number;
  reviewCount?:  number;
  amount?:       bigint;
  error?:        string;
}

export async function checkDistributionStatus(githubUsername: string): Promise<boolean> {
  try {
    return await publicClient.readContract({
      address:      GASS_CONTRACT_ADDRESS as Address,
      abi:          GASS_ABI,
      functionName: 'hasDistributionBeenProcessed',
      args:         [githubUsername],
    }) as boolean;
  } catch {
    return false;
  }
}

/**
 * Reads the O2 Oracle on-chain and applies the same tier logic as the RE policy:
 *   - quality_score <= 50 → REJECTED
 *   - quality_score > 50 AND last_updated < 1750000000 → LIMITED  (50 GASS)
 *   - quality_score > 50 AND last_updated >= 1750000000 AND review_count > 100 → BONUS (200 GASS)
 *   - quality_score > 50 AND last_updated >= 1750000000 AND review_count <= 100 → STANDARD (100 GASS)
 *   - no data found (all zeros) → NONE
 */
export async function checkEligibilityTier(githubUsername: string): Promise<EligibilityResult> {
  try {
    const hasReceived = await checkDistributionStatus(githubUsername);
    if (hasReceived) {
      return { hasReceived: true, eligibleTier: RewardTier.NONE };
    }

    // Fetch all three metrics in parallel from the O2 Oracle
    const [rawScore, rawLastUpdated, rawReviewCount] = await Promise.all([
      publicClient.readContract({
        address: O2_ORACLE_ADDRESS as Address, abi: O2_ORACLE_ABI,
        functionName: 'getQuality_score', args: [githubUsername],
      }),
      publicClient.readContract({
        address: O2_ORACLE_ADDRESS as Address, abi: O2_ORACLE_ABI,
        functionName: 'getLast_updated', args: [githubUsername],
      }),
      publicClient.readContract({
        address: O2_ORACLE_ADDRESS as Address, abi: O2_ORACLE_ABI,
        functionName: 'getReview_count', args: [githubUsername],
      }),
    ]);

    const qualityScore  = Number(rawScore);
    const lastUpdated   = Number(rawLastUpdated);
    const reviewCount   = Number(rawReviewCount);

    // No data → username not in the oracle yet
    if (qualityScore === 0 && lastUpdated === 0 && reviewCount === 0) {
      return { hasReceived: false, eligibleTier: RewardTier.NONE, qualityScore, lastUpdated, reviewCount };
    }

    // Apply the same rules as the on-chain RE policy
    if (qualityScore <= 50) {
      return { hasReceived: false, eligibleTier: RewardTier.REJECTED, qualityScore, lastUpdated, reviewCount };
    }
    if (lastUpdated < 1750000000) {
      return { hasReceived: false, eligibleTier: RewardTier.LIMITED, qualityScore, lastUpdated, reviewCount, amount: TIER_AMOUNTS.LIMITED };
    }
    if (reviewCount > 100) {
      return { hasReceived: false, eligibleTier: RewardTier.BONUS, qualityScore, lastUpdated, reviewCount, amount: TIER_AMOUNTS.BONUS };
    }
    return { hasReceived: false, eligibleTier: RewardTier.STANDARD, qualityScore, lastUpdated, reviewCount, amount: TIER_AMOUNTS.STANDARD };

  } catch (error) {
    console.error('Error checking eligibility tier:', error);
    return {
      hasReceived:  false,
      eligibleTier: RewardTier.NONE,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function verifyAndSignEligibility(
  githubUsername: string,
  address:        string,
  proof:          string,
  timestamp:      number,
): Promise<{ success: boolean; signature?: Hex; amount?: bigint; error?: string; tier?: string }> {
  try {
    const response = await fetch('/api/verify-eligibility', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ githubUsername, address, proof, timestamp }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Verification failed');
    return { success: true, signature: data.signature as Hex, amount: BigInt(data.amount), tier: data.tier };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown verification error' };
  }
}

export async function processReward(
  walletClient:          any,
  to:                    Address,
  amount:                bigint,
  githubUsername:        string,
  signature:             Hex,
  verificationTimestamp: number,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const { request } = await publicClient.simulateContract({
      address:      GASS_CONTRACT_ADDRESS as Address,
      abi:          GASS_ABI,
      functionName: 'processReward',
      args:         [to, amount, githubUsername, signature, BigInt(verificationTimestamp)],
      account:      to,
    });
    const hash = await walletClient.writeContract(request);
    return { success: true, txHash: hash };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error' };
  }
}
