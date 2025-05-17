'use client';

import { useState, useEffect } from 'react';
import { useDynamicContext, useEmbeddedWallet } from '@dynamic-labs/sdk-react-core';
import { useToggles } from '@/app/components/HeaderToggles';
import safeStorage from '@/lib/safeStorage';

export default function EmbeddedWalletManager() {
  const { primaryWallet, user } = useDynamicContext();
  const { debugMode } = useToggles();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Use the embedded wallet hook from Dynamic
  const {
    createAccount,
    embeddedWallet,
    getNetworkInfo,
    switchNetwork,
  } = useEmbeddedWallet();

  // Function to check if a wallet is an embedded wallet
  const isEmbeddedWallet = (wallet: any) => {
    return wallet?.connector?.name === 'embeddedWallet' ||
           wallet?.connector?.connectorType === 'embeddedWallet';
  };

  // Base Sepolia chain ID
  const baseSepolia = 84532;

  // Check if the wallet is an embedded wallet and if it's on Base Sepolia
  useEffect(() => {
    const checkEmbeddedWallet = async () => {
      if (!primaryWallet) {
        setMessage(null);
        return;
      }

      // Check if this is an embedded wallet
      if (isEmbeddedWallet(primaryWallet)) {
        setMessage('Using embedded wallet');

        try {
          // Check if we have a cached network ID in our safe storage
          const cachedChainId = safeStorage.get('embeddedWalletChainId', null);

          // Try to get the current network info, but handle errors gracefully
          let networkInfo;
          try {
            networkInfo = await getNetworkInfo();
          } catch (networkErr) {
            console.warn('Error getting network info, using cached value:', networkErr);

            // If we have a cached value, use that instead
            if (cachedChainId !== null) {
              networkInfo = { chainId: cachedChainId };
            }
          }

          if (networkInfo?.chainId === baseSepolia) {
            setMessage('Embedded wallet is on Base Sepolia');
            // Cache the chain ID for future use
            safeStorage.set('embeddedWalletChainId', baseSepolia);
          } else {
            setMessage(`Embedded wallet is on chain ID: ${networkInfo?.chainId || 'Unknown'} (Not Base Sepolia)`);

            // Try to switch to Base Sepolia
            handleSwitchNetwork();
          }
        } catch (err) {
          console.error('Error checking embedded wallet network:', err);
          // Only show error to user if it's not a storage-related issue
          if (!String(err).includes('storage') && !String(err).includes('localStorage')) {
            setError(err instanceof Error ? err.message : 'Unknown error checking embedded wallet');
          }
        }
      } else {
        setMessage('Not using an embedded wallet');
      }
    };

    // Small delay to ensure Dynamic SDK is fully initialized
    const timer = setTimeout(() => {
      checkEmbeddedWallet();
    }, 500);

    return () => clearTimeout(timer);
  }, [primaryWallet, getNetworkInfo]);

  // Function to switch the embedded wallet to Base Sepolia
  const handleSwitchNetwork = async () => {
    if (!primaryWallet || !isEmbeddedWallet(primaryWallet)) {
      setError('No embedded wallet connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to switch to Base Sepolia with error handling
      try {
        await switchNetwork(baseSepolia);
        setMessage('Successfully switched embedded wallet to Base Sepolia');

        // Cache the successful chain ID
        safeStorage.set('embeddedWalletChainId', baseSepolia);
      } catch (switchErr) {
        console.warn('Error using switchNetwork, trying alternative method:', switchErr);

        // If the first method fails, try an alternative approach
        try {
          // Try to use the wallet's switchChain method directly if available
          if (primaryWallet.connector && primaryWallet.connector.switchChain) {
            await primaryWallet.connector.switchChain({ chainId: baseSepolia });
            setMessage('Successfully switched embedded wallet to Base Sepolia (alternative method)');
            safeStorage.set('embeddedWalletChainId', baseSepolia);
          } else {
            throw new Error('Wallet does not support chain switching');
          }
        } catch (altErr) {
          // If both methods fail, throw the error to be caught by the outer catch
          console.error('Alternative method also failed:', altErr);
          throw altErr;
        }
      }
    } catch (err) {
      console.error('Failed to switch embedded wallet network:', err);
      // Only show error to user if it's not a storage-related issue
      if (!String(err).includes('storage') && !String(err).includes('localStorage')) {
        setError('Failed to switch to Base Sepolia. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // If no wallet is connected or no message to display, don't render anything
  if (!primaryWallet || !message) {
    return null;
  }

  return (
    <div className="gass-embedded-wallet-manager">
      {message && (
        <div className={`gass-status ${message.includes('Base Sepolia') ? 'gass-status-success' : 'gass-status-info'}`}>
          <span className="gass-status-icon">{message.includes('Base Sepolia') ? '✅' : 'ℹ️'}</span>
          <span>{message}</span>

          {!message.includes('Base Sepolia') && isEmbeddedWallet(primaryWallet) && (
            <button
              className="gass-button gass-button-small"
              onClick={handleSwitchNetwork}
              disabled={isLoading}
            >
              {isLoading ? 'Switching...' : 'Switch to Base Sepolia'}
            </button>
          )}
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
          <h4>Embedded Wallet Debug Info:</h4>
          <pre>
            {`Wallet Address: ${embeddedWallet?.address || primaryWallet?.address || 'Unknown'}
Target Chain ID: ${baseSepolia}
Is Embedded: ${isEmbeddedWallet(primaryWallet)}
Storage Type: ${safeStorage.getStorageType()}
Storage Available: ${safeStorage.isAvailable()}
localStorage Available: ${safeStorage.isAvailable('localStorage')}
sessionStorage Available: ${safeStorage.isAvailable('sessionStorage')}
Cached Chain ID: ${safeStorage.get('embeddedWalletChainId', 'None')}`}
          </pre>
        </div>
      )}
    </div>
  );
}
