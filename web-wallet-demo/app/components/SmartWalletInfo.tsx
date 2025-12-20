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
        const walletClient = await primaryWallet.connector.getWalletClient();
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

      {/* GitHub Authentication Status */}
      <div className={`gass-status ${isGitHubAuthenticated ? 'gass-status-success' : 'gass-status-warning'}`}>
        <span className="gass-status-icon">{isGitHubAuthenticated ? '✅' : 'ℹ️'}</span>
        <span>
          {isGitHubAuthenticated
            ? 'GitHub Authentication: Connected'
            : 'GitHub Authentication: Not connected. Connect with GitHub to verify your identity.'}
        </span>
      </div>

      {/* Network Status - Using the new NetworkSwitcher component */}
      <NetworkSwitcher />

      {/* Embedded Wallet Manager - Handles embedded wallet network switching */}
      <EmbeddedWalletManager />

      {/* Wallet Info */}
      <div className="gass-info-item">
        <span className="gass-info-label">Wallet Address:</span>
        <span className="gass-info-value">
          {`${primaryWallet.address.substring(0, 6)}...${primaryWallet.address.substring(primaryWallet.address.length - 4)}`}
        </span>
      </div>

      <div className="gass-info-item">
        <span className="gass-info-label">Wallet Type:</span>
        <span className="gass-info-value">{primaryWallet.connector.name}</span>
      </div>

      {error && (
        <div className="gass-status gass-status-error">
          <span className="gass-status-icon">❌</span>
          <span>{error}</span>
        </div>
      )}

      {debugMode && (
        <div className="gass-debug-info">
          <h4>Wallet Debug Info:</h4>
          <pre>
            {`Wallet Address: ${primaryWallet.address}
Wallet Type: ${primaryWallet.connector.name}
Network Info: ${networkInfo || 'Unknown'}
GitHub Authentication: ${isGitHubAuthenticated ? 'Yes' : 'No'}`}
          </pre>
        </div>
      )}
    </div>
  );
}
