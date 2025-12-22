'use client';

import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useToggles } from '@/app/components/HeaderToggles';
import safeStorage from '@/lib/safeStorage';
import { Check, Info, XCircle } from 'lucide-react';

export default function EmbeddedWalletManager() {
  const { primaryWallet } = useDynamicContext();
  const { debugMode } = useToggles();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Function to check if a wallet is an embedded wallet
  const isEmbeddedWallet = (wallet: any) => {
    return wallet?.connector?.key === 'embeddedWallet' ||
      wallet?.connector?.name === 'embeddedWallet' ||
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

          // Try to get chain ID from wallet
          let chainId: number | undefined;

          try {
            if (primaryWallet.connector && 'getNetwork' in primaryWallet.connector) {
              const network = await (primaryWallet.connector as any).getNetwork();
              chainId = network;
            } else {
              const client = await primaryWallet.getWalletClient();
              chainId = await client.getChainId();
            }
          } catch (err) {
            console.warn('Error fetching chain ID:', err);
            // Fallback to cache
            if (cachedChainId !== null) {
              chainId = parseInt(cachedChainId);
            }
          }

          if (chainId === baseSepolia) {
            setMessage('Embedded wallet is on Base Sepolia');
            // Cache the chain ID for future use
            safeStorage.set('embeddedWalletChainId', baseSepolia);
          } else {
            setMessage(`Embedded wallet is on chain ID: ${chainId || 'Unknown'} (Not Base Sepolia)`);

            // Auto-switch if possible
            // handleSwitchNetwork(); // Disabled specific auto-switch to avoid infinite loops if it fails
          }
        } catch (err) {
          console.error('Error checking embedded wallet network:', err);
        }
      } else {
        setMessage('Not using an embedded wallet');
      }
    };

    const timer = setTimeout(() => {
      checkEmbeddedWallet();
    }, 1000);

    return () => clearTimeout(timer);
  }, [primaryWallet]);

  // Function to switch the embedded wallet to Base Sepolia
  const handleSwitchNetwork = async () => {
    if (!primaryWallet || !isEmbeddedWallet(primaryWallet)) {
      setError('No embedded wallet connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (primaryWallet.switchNetwork) {
        await primaryWallet.switchNetwork(baseSepolia);
      } else if (primaryWallet.connector && (primaryWallet.connector as any).switchChain) {
        await (primaryWallet.connector as any).switchChain({ chainId: baseSepolia });
      } else {
        throw new Error('Wallet does not support network switching');
      }

      setMessage('Successfully switched embedded wallet to Base Sepolia');
      safeStorage.set('embeddedWalletChainId', baseSepolia);
    } catch (err: any) {
      console.error('Failed to switch embedded wallet network:', err);
      // Only show error to user if it's not a storage-related issue
      if (!String(err).includes('storage') && !String(err).includes('localStorage')) {
        setError(err.message || 'Failed to switch to Base Sepolia. Please try again.');
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
          <span className="gass-status-icon">{message.includes('Base Sepolia') ? <Check className="w-4 h-4" /> : <Info className="w-4 h-4" />}</span>
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
          <span className="gass-status-icon"><XCircle className="w-4 h-4" /></span>
          <span>{error}</span>
        </div>
      )}

      {debugMode && (
        <div className="gass-debug-info">
          <h4>Embedded Wallet Debug Info:</h4>
          <pre>
            {`Wallet Address: ${primaryWallet?.address || 'Unknown'}
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
