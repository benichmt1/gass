import { useEffect, useState } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { signIn, useSession } from 'next-auth/react';

/**
 * Custom hook to handle Dynamic and NextAuth integration
 * This hook will automatically sign in to NextAuth when the user logs in with Dynamic
 */
export function useDynamicAuth() {
  const { user, authToken, isAuthenticated, primaryWallet } = useDynamicContext();

  // Use try/catch to handle the case when SessionProvider is not available
  let session = null;
  let status = 'unauthenticated';
  try {
    const sessionData = useSession();
    session = sessionData.data;
    status = sessionData.status;
  } catch (error) {
    console.warn('SessionProvider not available, falling back to Dynamic auth only');
  }

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign in to NextAuth when the user logs in with Dynamic
  useEffect(() => {
    const handleDynamicLogin = async () => {
      if (isAuthenticated && authToken && !session) {
        setIsLoading(true);
        setError(null);

        try {
          // Sign in to NextAuth with the Dynamic JWT token
          const result = await signIn('dynamic', {
            jwt: authToken,
            redirect: false
          });

          if (result?.error) {
            setError(result.error);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to sign in');
          console.error('Error signing in with Dynamic:', err);
        } finally {
          setIsLoading(false);
        }
      }
    };

    handleDynamicLogin();
  }, [isAuthenticated, authToken, session]);

  // Get GitHub username from Dynamic or NextAuth
  const githubUsername = session?.user?.githubUsername ||
    user?.verifiedCredentials?.find(
      (credential) => credential.format === 'oauth' && credential.oauthProvider === 'github'
    )?.oauthUsername ||
    null;

  // Get wallet address from Dynamic or NextAuth
  const walletAddress = session?.user?.walletAddress ||
    primaryWallet?.address ||
    null;

  return {
    isAuthenticated: !!session || isAuthenticated,
    isLoading: isLoading || status === 'loading',
    error,
    user: session?.user || user,
    githubUsername,
    walletAddress,
    jwt: session?.jwt || authToken
  };
}
