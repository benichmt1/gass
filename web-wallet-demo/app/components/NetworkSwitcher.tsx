'use client';

import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useToggles } from '@/app/components/HeaderToggles';
import safeStorage from '@/lib/safeStorage';

export default function NetworkSwitcher() {
  const {
    network,
    setNetwork,
    primaryWallet,
    networkConfigurations,
    evmNetworks
  } = useDynamicContext();

  const { debugMode } = useToggles();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);

  // Base Sepolia chain ID
  const baseSepolia = 84532;

  // Check current network on component mount and when wallet changes
  useEffect(() => {
    // Wrap all network operations in try/catch to handle any potential errors
    const checkNetwork = async () => {
      if (!primaryWallet) return;

      try {
        // Try to get the wallet client, but handle any errors that might occur
        let walletClient;
        try {
          walletClient = await primaryWallet.connector.getWalletClient();
        } catch (clientErr) {
          console.warn('Could not get wallet client:', clientErr);
          // Continue with other operations even if this fails
        }

        // If we couldn't get a wallet client, try to use the network from context
        if (!walletClient) {
          console.log('Using network from context:', network);
          // If we have a network from context, use that
          if (network) {
            const networkChainId = parseInt(network);
            if (!isNaN(networkChainId)) {
              setCurrentChainId(networkChainId);
              return;
            }
          }
          return;
        }

        // Try to get chain ID from wallet client
        let chainId;
        try {
          chainId = await walletClient.getChainId();
          setCurrentChainId(chainId);
        } catch (chainErr) {
          console.warn('Could not get chain ID from wallet:', chainErr);
          // If we can't get the chain ID, don't try to switch networks
          return;
        }

        // If not on Base Sepolia, try to switch
        if (chainId !== baseSepolia) {
          handleSwitchToBaseSepolia();
        }
      } catch (err) {
        console.error('Error checking network:', err);
        // Only set user-facing errors for non-storage issues
        if (!String(err).includes('No available storage found') &&
            !String(err).includes('storage') &&
            !String(err).includes('localStorage')) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    // Small delay to ensure Dynamic SDK is fully initialized
    const timer = setTimeout(() => {
      checkNetwork();
    }, 500);

    return () => clearTimeout(timer);
  }, [primaryWallet, network]);

  // Function to switch to Base Sepolia
  const handleSwitchToBaseSepolia = async () => {
    if (!primaryWallet) {
      setError('No wallet connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use Dynamic's setNetwork function to switch networks
      // Wrap in try/catch to handle any potential errors
      try {
        await setNetwork(baseSepolia.toString());
        setCurrentChainId(baseSepolia);
      } catch (networkErr) {
        console.warn('Error using setNetwork, trying alternative method:', networkErr);

        // If setNetwork fails, try using the wallet's switchChain method directly
        try {
          const walletClient = await primaryWallet.connector.getWalletClient();
          if (walletClient && walletClient.switchChain) {
            await walletClient.switchChain({ chainId: baseSepolia });
            setCurrentChainId(baseSepolia);
          } else {
            throw new Error('Wallet does not support chain switching');
          }
        } catch (switchErr) {
          // If both methods fail, throw the error to be caught by the outer catch
          console.error('Alternative method also failed:', switchErr);
          throw switchErr;
        }
      }
    } catch (err) {
      console.error('Failed to switch network:', err);
      // Only show error to user if it's not a storage-related issue
      if (!String(err).includes('No available storage found') &&
          !String(err).includes('storage') &&
          !String(err).includes('localStorage')) {
        setError('Failed to switch to Base Sepolia. Please try again or switch manually.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // If no wallet is connected, don't render anything
  if (!primaryWallet) {
    return null;
  }

  return (
    <div className="gass-network-switcher">
      <div className={`gass-status ${currentChainId === baseSepolia ? 'gass-status-success' : 'gass-status-warning'}`}>
        <span className="gass-status-icon">{currentChainId === baseSepolia ? '✅' : '⚠️'}</span>
        <span>
          {currentChainId === baseSepolia
            ? 'Connected to Base Sepolia'
            : `Connected to chain ID: ${currentChainId || 'Unknown'} (Not Base Sepolia)`}
        </span>

        {currentChainId !== baseSepolia && (
          <button
            className="gass-button gass-button-small"
            onClick={handleSwitchToBaseSepolia}
            disabled={isLoading}
          >
            {isLoading ? 'Switching...' : 'Switch to Base Sepolia'}
          </button>
        )}
      </div>

      {error && (
        <div className="gass-status gass-status-error">
          <span className="gass-status-icon">❌</span>
          <span>{error}</span>
        </div>
      )}

      {debugMode && (
        <div className="gass-debug-info">
          <h4>Network Debug Info:</h4>
          <pre>
            {`Current Chain ID: ${currentChainId}
Target Chain ID: ${baseSepolia}
Dynamic Network: ${network}
Available Networks: ${evmNetworks?.map(n => n.name).join(', ') || 'None'}
Storage Type: ${safeStorage.getStorageType()}
Storage Available: ${safeStorage.isAvailable()}
localStorage Available: ${safeStorage.isAvailable('localStorage')}
sessionStorage Available: ${safeStorage.isAvailable('sessionStorage')}
Window Storage Access: ${typeof window !== 'undefined' && window.hasStorageAccess ? 'Yes' : 'No'}`}
          </pre>
        </div>
      )}
    </div>
  );
}
