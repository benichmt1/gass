'use client';

import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useToggles } from '@/app/components/HeaderToggles';
import safeStorage from '@/lib/safeStorage';
import { Check, AlertTriangle, XCircle } from 'lucide-react';

export default function NetworkSwitcher() {
  const {
    network,
    primaryWallet
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
        // Try to get chain ID from wallet
        let chainId: number | undefined;

        if (primaryWallet.connector && 'getNetwork' in primaryWallet.connector) {
          const networkVal = await (primaryWallet.connector as any).getNetwork();
          chainId = networkVal;
        } else {
          const client = await (primaryWallet as any).getWalletClient();
          chainId = await client.getChainId();
        }

        if (typeof chainId === 'number') {
          setCurrentChainId(chainId);

          // If not on Base Sepolia, try to switch
          if (chainId !== baseSepolia) {
            // handleSwitchToBaseSepolia(); // Disabled automatic switch to avoid loop
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (primaryWallet.switchNetwork) {
        await primaryWallet.switchNetwork(baseSepolia);
        setCurrentChainId(baseSepolia);
      } else if (primaryWallet.connector && (primaryWallet.connector as any).switchChain) {
        await (primaryWallet.connector as any).switchChain({ chainId: baseSepolia });
        setCurrentChainId(baseSepolia);
      } else {
        throw new Error('Wallet does not support network switching');
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

  // Access check for debug info
  const hasStorageAccess = typeof window !== 'undefined' && 'hasStorageAccess' in document
    ? (document as any).hasStorageAccess
    : false;

  return (
    <div className="gass-network-switcher">
      <div className={`gass-status ${currentChainId === baseSepolia ? 'gass-status-success' : 'gass-status-warning'}`}>
        <span className="gass-status-icon">{currentChainId === baseSepolia ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}</span>
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
          <span className="gass-status-icon"><XCircle className="w-4 h-4" /></span>
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
Storage Type: ${safeStorage.getStorageType()}
Storage Available: ${safeStorage.isAvailable()}
localStorage Available: ${safeStorage.isAvailable('localStorage')}
sessionStorage Available: ${safeStorage.isAvailable('sessionStorage')}
Window Storage Access: ${hasStorageAccess ? 'Yes' : 'No'}`}
          </pre>
        </div>
      )}
    </div>
  );
}
