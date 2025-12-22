'use client';

import { useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useToggles } from '@/app/components/HeaderToggles';
import { isEthereumWallet, EthereumWalletConnector } from '@dynamic-labs/ethereum';
import {
  checkEligibilityTier,
  processReward as processRewardUtil,
  verifyAndSignEligibility,
  checkDistributionStatus,
  GASS_CONTRACT_ADDRESS,
  type EligibilityResult,
  RewardTier
} from '@/lib/contractUtils';
import { getDynamicJwtToken } from '@/lib/verificationUtils';
import { parseEther, type Address, type Hex } from 'viem';

export default function ContractInteraction() {
  const { primaryWallet, user } = useDynamicContext();
  const { debugMode } = useToggles();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eligibilityInfo, setEligibilityInfo] = useState<EligibilityResult | null>(null);
  const [hasAlreadyClaimed, setHasAlreadyClaimed] = useState<boolean | null>(null);
  const [githubUsername, setGithubUsername] = useState<string>('');

  // Get GitHub username from user object if available
  const userGithubUsername = user?.verifiedCredentials?.find(
    credential => credential.format === 'oauth' && credential.oauthProvider === 'github'
  )?.oauthUsername || '';

  // Check if we're on Base Sepolia network
  const checkNetwork = async () => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) return false;

    try {
      const walletClient = await (primaryWallet.connector as EthereumWalletConnector).getWalletClient();
      if (!walletClient) return false;

      const chainId = await walletClient.getChainId();

      // Base Sepolia chain ID is 84532
      if (chainId !== 84532) {
        setError('Please switch to Base Sepolia network to interact with the contract.');

        // Try to switch the network
        try {
          await walletClient.switchChain({ id: 84532 });
          return true;
        } catch (switchError) {
          console.error('Error switching network:', switchError);

          // If the chain doesn't exist, try to add it
          try {
            await walletClient.addChain({
              chain: {
                id: 84532,
                name: 'Base Sepolia',
                nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: { default: { http: ['https://84532.rpc.thirdweb.com'] } },
                blockExplorers: { default: { name: 'Base Sepolia Explorer', url: 'https://sepolia-explorer.base.org' } },
              }
            });

            await walletClient.switchChain({ id: 84532 });
            return true;
          } catch (addError) {
            console.error('Error adding network:', addError);
            return false;
          }
        }
      }

      return true;
    } catch (err) {
      console.error('Error checking network:', err);
      return false;
    }
  };

  // Check eligibility for rewards
  const checkEligibility = async () => {
    const username = githubUsername || userGithubUsername;
    if (!username) {
      setError('No GitHub username provided. Please enter a username or connect with GitHub.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setEligibilityInfo(null);

    try {
      // Check if we're on the right network (if wallet is connected)
      if (primaryWallet) {
        const isCorrectNetwork = await checkNetwork();
        if (!isCorrectNetwork) {
          // Continue anyway as read operations might work without correct network depending on provider
          console.warn('Network check failed, checking eligibility anyway');
        }
      }

      // Check distribution status
      const claimed = await checkDistributionStatus(username);
      setHasAlreadyClaimed(claimed);

      // Check eligibility tier (Client-side simulation for display)
      const eligibilityResult = await checkEligibilityTier(username);
      setEligibilityInfo(eligibilityResult);

      const isEligible = eligibilityResult.eligibleTier !== RewardTier.NONE &&
        eligibilityResult.eligibleTier !== RewardTier.REJECTED;

      setResult(`GitHub user "${username}" is eligible for the "${eligibilityResult.eligibleTier}" tier.
${claimed ? '⚠️ You have already claimed your reward.' : isEligible ? '✅ Your reward is available to claim!' : '❌ Not eligible for rewards.'}`);
    } catch (err) {
      console.error('Error checking eligibility:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Claim reward for a GitHub username
  const claimReward = async () => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      setError('No wallet connected. Please connect your wallet first.');
      return;
    }

    const username = githubUsername || userGithubUsername;
    if (!username) {
      setError('No GitHub username provided. Please enter a username or connect with GitHub.');
      return;
    }

    if (hasAlreadyClaimed) {
      setError('You have already claimed your reward for this GitHub username.');
      return;
    }

    if (!eligibilityInfo ||
      eligibilityInfo.eligibleTier === RewardTier.NONE ||
      eligibilityInfo.eligibleTier === RewardTier.REJECTED) {
      setError('You are not eligible for rewards yet.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Check if we're on the right network
      const isCorrectNetwork = await checkNetwork();
      if (!isCorrectNetwork) {
        setError('Please switch to Base Sepolia network to interact with the contract.');
        setLoading(false);
        return;
      }

      // 1. Generate Proof of Ownership (JWT)
      let proof = '';
      let timestamp = 0;

      try {
        const jwtResult = await getDynamicJwtToken();
        if (jwtResult.isVerified && jwtResult.proof) {
          proof = jwtResult.proof;
          timestamp = jwtResult.timestamp || Math.floor(Date.now() / 1000);
        } else {
          throw new Error('Could not generate verification proof. Please log in again.');
        }
      } catch (e) {
        console.warn('Error generating proof:', e);
        throw new Error('Failed to generate verification proof: ' + (e instanceof Error ? e.message : String(e)));
      }

      // 2. Verify Eligibility & Get Signature from Backend
      setResult('Verifying eligibility with trusted backend...');

      const verificationResult = await verifyAndSignEligibility(
        username,
        primaryWallet.address,
        proof,
        timestamp
      );

      if (!verificationResult.success || !verificationResult.signature || !verificationResult.amount) {
        throw new Error(verificationResult.error || 'Backend verification failed');
      }

      // Get the wallet client
      const walletClient = await (primaryWallet.connector as EthereumWalletConnector).getWalletClient();
      if (!walletClient) {
        throw new Error('Failed to get wallet client');
      }

      // 3. Submit Claim Transaction
      setResult('Submitting claim transaction...');

      const processResult = await processRewardUtil(
        walletClient,
        primaryWallet.address as Address,
        verificationResult.amount,
        username,
        verificationResult.signature,
        timestamp
      );

      if (processResult.success) {
        setResult(`Claim transaction sent! Transaction hash: ${processResult.txHash || 'Simulated'}
Please wait for the transaction to be confirmed on the Base Sepolia network.
${processResult.txHash && !processResult.txHash.startsWith('0x') ? '' : `View on BaseScan: https://sepolia.basescan.org/tx/${processResult.txHash}`}`);

        // Set claimed to true after successful transaction
        setHasAlreadyClaimed(true);
      } else {
        throw new Error(processResult.error || 'Failed to process reward');
      }
    } catch (err) {
      console.error('Error claiming reward:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gass-contract-interaction">
      <h3>Claim Your GASS Rewards</h3>
      <p>Check eligibility and claim your rewards on Base Sepolia</p>

      <div className="gass-form-group">
        <label htmlFor="githubUsername">GitHub Username:</label>
        <input
          type="text"
          id="githubUsername"
          value={githubUsername || userGithubUsername}
          onChange={(e) => setGithubUsername(e.target.value)}
          placeholder="Enter GitHub username"
          className="gass-input"
        />
        <div className="gass-form-help">
          {userGithubUsername ? `Using connected GitHub account: ${userGithubUsername}` : 'Enter a GitHub username or connect with GitHub'}
        </div>
      </div>

      <div className="gass-action-buttons">
        <button
          className="gass-button gass-button-secondary"
          onClick={checkEligibility}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Check Eligibility'}
        </button>
        <button
          className="gass-button gass-button-primary"
          onClick={claimReward}
          disabled={loading || !eligibilityInfo || hasAlreadyClaimed === true}
        >
          {loading ? 'Processing...' : 'Claim Reward'}
        </button>
      </div>

      {eligibilityInfo && (
        <div className="gass-eligibility-info">
          <h4>Reward Information:</h4>
          <div className="gass-info-item">
            <span className="gass-info-label">Eligible Tier:</span>
            <span className="gass-info-value">{eligibilityInfo.eligibleTier}</span>
          </div>
          <div className="gass-info-item">
            <span className="gass-info-label">Quality Score:</span>
            <span className="gass-info-value">{eligibilityInfo.qualityScore || 'N/A'}</span>
          </div>
          <div className="gass-info-item">
            <span className="gass-info-label">Claim Status:</span>
            <span className="gass-info-value">
              {hasAlreadyClaimed
                ? '⚠️ Already claimed'
                : '✅ Available to claim'}
            </span>
          </div>
          {eligibilityInfo.error && (
            <div className="mt-2 text-xs text-red-400">
              {eligibilityInfo.error}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="gass-status gass-status-success">
          <span className="gass-status-icon">✅</span>
          <span>{result}</span>
        </div>
      )}

      {error && (
        <div className="gass-status gass-status-error">
          <span className="gass-status-icon">❌</span>
          <span>{error}</span>
        </div>
      )}

      {debugMode && (
        <details className="mt-8 p-4 rounded-xl bg-black/20 border border-white/10">
          <summary className="cursor-pointer font-medium opacity-70 hover:opacity-100 text-xs uppercase">Contract Details</summary>
          <pre className="text-xs overflow-x-auto p-4 mt-2 rounded bg-black/40 text-blue-400 font-mono">
            {`Contract Address: ${GASS_CONTRACT_ADDRESS}
Network: Base Sepolia
Connected Wallet: ${primaryWallet?.address || 'None'}
GitHub Username: ${userGithubUsername || githubUsername || 'None'}
Has Claimed: ${hasAlreadyClaimed !== null ? hasAlreadyClaimed.toString() : 'Unknown'}
Eligible Tier: ${eligibilityInfo?.eligibleTier || 'Unknown'}
Quality Score: ${eligibilityInfo?.qualityScore || 'Unknown'}
Last Updated: ${eligibilityInfo?.lastUpdated ? new Date(eligibilityInfo.lastUpdated * 1000).toLocaleString() : 'Unknown'}`}
          </pre>
        </details>
      )}
    </div>
  );
}
