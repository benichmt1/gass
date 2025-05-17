'use client';

import { useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useToggles } from '@/app/components/HeaderToggles';
import { Address, createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { isEthereumWallet, EthereumWalletConnector } from '@dynamic-labs/ethereum';

// GASS Contract address and ABI
const GASS_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GASS_CONTRACT_ADDRESS || '0x171A95CE45025f0AE0e56eC67Bf7084117e335d8';
const GASS_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "githubUsername", "type": "string"}
    ],
    "name": "checkEligibility",
    "outputs": [
      {"internalType": "string", "name": "tier", "type": "string"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "githubUsername", "type": "string"}
    ],
    "name": "claimReward",
    "outputs": [{"internalType": "bool", "name": "success", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "githubUsername", "type": "string"}
    ],
    "name": "hasClaimedReward",
    "outputs": [{"internalType": "bool", "name": "claimed", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Base Sepolia RPC URL
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

export default function ContractInteraction() {
  const { primaryWallet, user } = useDynamicContext();
  const { debugMode } = useToggles();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eligibilityInfo, setEligibilityInfo] = useState<{tier: string, amount: bigint} | null>(null);
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
    if (!primaryWallet) {
      setError('No wallet connected. Please connect your wallet first.');
      return;
    }

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
      // Check if we're on the right network
      const isCorrectNetwork = await checkNetwork();
      if (!isCorrectNetwork) {
        setError('Please switch to Base Sepolia network to interact with the contract.');
        setLoading(false);
        return;
      }

      // Create a public client for read-only operations
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
      });

      // Check if user has already claimed
      const claimed = await publicClient.readContract({
        address: GASS_CONTRACT_ADDRESS as Address,
        abi: GASS_ABI,
        functionName: 'hasClaimedReward',
        args: [username],
      });

      setHasAlreadyClaimed(claimed as boolean);

      // Call the contract to check eligibility
      const [tier, amount] = await publicClient.readContract({
        address: GASS_CONTRACT_ADDRESS as Address,
        abi: GASS_ABI,
        functionName: 'checkEligibility',
        args: [username],
      }) as [string, bigint];

      setEligibilityInfo({ tier, amount });

      // Format the amount to ETH (assuming 18 decimals)
      const formattedAmount = Number(amount) / 10**18;

      setResult(`GitHub user "${username}" is eligible for the "${tier}" tier with ${formattedAmount} tokens.
${claimed ? '⚠️ You have already claimed your reward.' : '✅ Your reward is available to claim!'}`);
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

      // Get the wallet client
      const ethereumWallet = primaryWallet;
      if (!isEthereumWallet(ethereumWallet)) throw new Error('Not an Ethereum wallet');
      const walletClient = await (ethereumWallet.connector as EthereumWalletConnector).getWalletClient();

      if (!walletClient) {
        throw new Error('Failed to get wallet client');
      }

      // Create a public client for simulating transactions
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
      });

      // Prepare the transaction
      const { request } = await publicClient.simulateContract({
        address: GASS_CONTRACT_ADDRESS as Address,
        abi: GASS_ABI,
        functionName: 'claimReward',
        args: [username],
        account: primaryWallet.address as Address,
      });

      // Send the transaction
      const hash = await walletClient.writeContract(request);

      setResult(`Claim transaction sent! Transaction hash: ${hash}
Please wait for the transaction to be confirmed on the Base Sepolia network.
View on BaseScan: https://sepolia.basescan.org/tx/${hash}`);

      // Set claimed to true after successful transaction
      setHasAlreadyClaimed(true);
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
            <span className="gass-info-value">{eligibilityInfo.tier}</span>
          </div>
          <div className="gass-info-item">
            <span className="gass-info-label">Reward Amount:</span>
            <span className="gass-info-value">{Number(eligibilityInfo.amount) / 10**18} tokens</span>
          </div>
          <div className="gass-info-item">
            <span className="gass-info-label">Claim Status:</span>
            <span className="gass-info-value">
              {hasAlreadyClaimed
                ? '⚠️ Already claimed'
                : '✅ Available to claim'}
            </span>
          </div>
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
        <div className="gass-debug-info">
          <h4>Contract Details:</h4>
          <pre>
            {`Contract Address: ${GASS_CONTRACT_ADDRESS}
Network: Base Sepolia
Connected Wallet: ${primaryWallet?.address || 'None'}
GitHub Username: ${userGithubUsername || githubUsername || 'None'}
Has Claimed: ${hasAlreadyClaimed !== null ? hasAlreadyClaimed.toString() : 'Unknown'}
Eligible Tier: ${eligibilityInfo?.tier || 'Unknown'}
Reward Amount: ${eligibilityInfo ? (Number(eligibilityInfo.amount) / 10**18).toString() : 'Unknown'} tokens`}
          </pre>
        </div>
      )}
    </div>
  );
}
