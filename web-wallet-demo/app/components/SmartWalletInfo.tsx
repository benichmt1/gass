'use client';

import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useToggles } from '@/app/components/HeaderToggles';
import NetworkSwitcher from '@/app/components/NetworkSwitcher';
import EmbeddedWalletManager from '@/app/components/EmbeddedWalletManager';

export default function SmartWalletInfo() {
  const { primaryWallet, user } = useDynamicContext();
  const { debugMode } = useToggles();
  const [networkInfo, setNetworkInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in a browser environment with storage access
    const hasStorageAccess = typeof window !== 'undefined' &&
      typeof localStorage !== 'undefined' &&
      typeof sessionStorage !== 'undefined';

    if (!hasStorageAccess) {
      console.warn('Storage access is not available. Wallet info may not be displayed properly.');
      return;
    }

    const checkWalletInfo = async () => {
      if (!primaryWallet) {
        setNetworkInfo(null);
        return;
      }

      try {
        const walletClient = await (primaryWallet.connector as any).getWalletClient();
        if (!walletClient) {
          setNetworkInfo('Unable to get wallet information');
          return;
        }

        const chainId = await walletClient.getChainId();
        const baseSepolia = 84532; // Base Sepolia chain ID

        // Check if we're on Base Sepolia
        if (chainId === baseSepolia) {
          setNetworkInfo('Connected to Base Sepolia');
        } else {
          setNetworkInfo(`Connected to chain ID: ${chainId} (Not Base Sepolia)`);
          // Network switching is now handled by the NetworkSwitcher component
        }
      } catch (e) {
        console.error('Error getting wallet info:', e);
        // Don't set error state for storage issues to avoid cascading errors
        if (!String(e).includes('No available storage found')) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    };

    checkWalletInfo();
  }, [primaryWallet]);

  // Check if user is authenticated with GitHub
  const isGitHubAuthenticated = user?.verifiedCredentials?.some(
    credential => credential.format === 'oauth' && credential.oauthProvider === 'github'
  );

  if (!primaryWallet) {
    return null;
  }

  return (
    <div className="gass-smart-wallet-info">
      <h3>Wallet Information</h3>

      {/* GitHub Authentication Status - Small inline badge */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`text-sm px-3 py-1 rounded-full border ${isGitHubAuthenticated ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'}`}>
          {isGitHubAuthenticated ? 'GitHub Connected' : 'GitHub Not Connected'}
        </div>
      </div>

      {/* Network Status - Using the new NetworkSwitcher component */}
      <NetworkSwitcher />

      {/* Embedded Wallet Manager - Handles embedded wallet network switching */}
      <EmbeddedWalletManager />

      {/* Wallet Info */}
      <div className="gass-info-grid mt-4">
        <div className="gass-info-item">
          <span className="gass-info-label">Wallet Address</span>
          <span className="gass-info-value font-mono text-sm">
            {`${primaryWallet.address.substring(0, 6)}...${primaryWallet.address.substring(primaryWallet.address.length - 4)}`}
          </span>
        </div>

        <div className="gass-info-item">
          <span className="gass-info-label">Wallet Type</span>
          <span className="gass-info-value">{primaryWallet.connector.name}</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      {debugMode && (
        <details className="mt-6 p-4 rounded-xl bg-black/20 border border-white/10">
          <summary className="cursor-pointer font-medium opacity-70 hover:opacity-100 text-xs uppercase">Wallet Debug Info</summary>
          <pre className="text-xs overflow-x-auto p-4 mt-2 rounded bg-black/40 text-blue-400 font-mono">
            {`Wallet Address: ${primaryWallet.address}
Wallet Type: ${primaryWallet.connector.name}
Network Info: ${networkInfo || 'Unknown'}
GitHub Authentication: ${isGitHubAuthenticated ? 'Yes' : 'No'}`}
          </pre>
        </details>
      )}
    </div>
  );
}
