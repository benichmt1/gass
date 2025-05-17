'use client';
import { useState, useEffect } from 'react';
import { useDynamicContext, useIsLoggedIn, useUserWallets } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from '@dynamic-labs/ethereum';
import { useToggles } from '@/app/components/HeaderToggles';

import './Methods.css';

interface DynamicMethodsProps {
	isDarkMode: boolean;
}

export default function DynamicMethods({ isDarkMode }: DynamicMethodsProps) {
	const isLoggedIn = useIsLoggedIn();
	const { sdkHasLoaded, primaryWallet, user } = useDynamicContext();
	const userWallets = useUserWallets();
	const [isLoading, setIsLoading] = useState(true);
	const [result, setResult] = useState('');
	const [error, setError] = useState<string | null>(null);

	// Use global debug mode from context
	const { debugMode } = useToggles();


  const safeStringify = (obj: unknown): string => {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }
        return value;
      },
      2
    );
  };


	useEffect(() => {
		if (sdkHasLoaded && isLoggedIn && primaryWallet) {
			setIsLoading(false);
		} else {
			setIsLoading(true);
		}
	}, [sdkHasLoaded, isLoggedIn, primaryWallet]);

	function clearResult() {
		setResult('');
		setError(null);
	}

	function showUser() {
		try {
			setResult(safeStringify(user));
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to stringify user data');
		}
	}

	function showUserWallets() {
		try {
			setResult(safeStringify(userWallets));
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to stringify wallet data');
		}
	}


  async function fetchEthereumPublicClient() {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) return;
    try {
      setIsLoading(true);
      const result = await primaryWallet.getPublicClient();
      setResult(safeStringify(result));
    } catch (error) {
      setResult(safeStringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }));
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchEthereumWalletClient() {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) return;
    try {
      setIsLoading(true);
      const result = await primaryWallet.getWalletClient();
      setResult(safeStringify(result));
    } catch (error) {
      setResult(safeStringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }));
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchEthereumMessage() {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) return;
    try {
      setIsLoading(true);
      // Get GitHub username from user object
      const githubCredential = user?.verifiedCredentials?.find(
        (credential: any) => credential.format === 'oauth' && credential.oauthProvider === 'github'
      );
      const githubUsername = githubCredential?.oauthUsername || 'unknown';

      // Sign a message confirming GitHub ownership
      const message = `I am the owner of ${githubUsername} on GitHub`;
      const result = await primaryWallet.signMessage(message);
      setResult(safeStringify(result));
    } catch (error) {
      setResult(safeStringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }));
    } finally {
      setIsLoading(false);
    }
  }

	return (
		<>
			{!isLoading && (
				<div className="dynamic-methods" data-theme={isDarkMode ? 'dark' : 'light'}>
					<div className="methods-container">
						{/* Only show debug buttons when debug mode is enabled */}
						{debugMode && (
							<>
								<button className="btn btn-primary" onClick={showUser}>Fetch User</button>
								<button className="btn btn-primary" onClick={showUserWallets}>Fetch User Wallets</button>

								{primaryWallet && isEthereumWallet(primaryWallet) && (
									<>
										<button type="button" className="btn btn-primary" onClick={fetchEthereumPublicClient}>
											Fetch PublicClient
										</button>

										<button type="button" className="btn btn-primary" onClick={fetchEthereumWalletClient}>
											Fetch WalletClient
										</button>
									</>
								)}
							</>
						)}

						{/* Always show the GitHub ownership button */}
						{primaryWallet && isEthereumWallet(primaryWallet) && (
							<button type="button" className="btn btn-primary" onClick={fetchEthereumMessage}>
								I am the owner of this GitHub account
							</button>
						)}
					</div>
					{(result || error) && (
						<div className="results-container">
							{error ? (
								<pre className="results-text error">{error}</pre>
							) : (
								<pre className="results-text">{result}</pre>
							)}
						</div>
					)}
					{(result || error) && (
						<div className="clear-container">
							<button className="btn btn-primary" onClick={clearResult}>Clear</button>
						</div>
					)}
				</div>
			)}
		</>
	);
}