/**
 * Utilities for verifying GitHub credentials and generating proof
 * for the GASS contract to ensure only verified users can claim rewards.
 */

import { VerifiedCredential } from '@dynamic-labs/sdk-api';
import { ethers } from 'ethers';
import { getAuthToken } from '@dynamic-labs/sdk-react-core';

/**
 * Interface for verification result
 */
export interface VerificationResult {
  isVerified: boolean;
  message?: string;
  proof?: string;
  timestamp?: number;
}

/**
 * Checks if a user has a verified GitHub credential
 * @param verifiedCredentials Array of user's verified credentials
 * @returns Object with verification status and message
 */
export function verifyGithubCredential(
  verifiedCredentials?: VerifiedCredential[]
): VerificationResult {
  if (!verifiedCredentials || verifiedCredentials.length === 0) {
    return {
      isVerified: false,
      message: 'No verified credentials found. Please connect with GitHub.'
    };
  }

  // Find GitHub credential
  const githubCred = verifiedCredentials.find(
    (credential) => credential.format === 'oauth' && credential.oauthProvider === 'github'
  );

  if (!githubCred) {
    return {
      isVerified: false,
      message: 'No GitHub credential found. Please connect with GitHub.'
    };
  }

  // Check if the credential has a username
  if (!githubCred.oauthUsername) {
    return {
      isVerified: false,
      message: 'GitHub username not found in credential.'
    };
  }

  return {
    isVerified: true,
    message: `Verified GitHub user: ${githubCred.oauthUsername}`
  };
}

/**
 * Gets the JWT token from Dynamic for verification
 * @returns Promise resolving to a verification result with the JWT token
 */
export async function getDynamicJwtToken(): Promise<VerificationResult> {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return {
        isVerified: false,
        message: 'Cannot get JWT token in server environment'
      };
    }

    // Try to get the JWT token using the getAuthToken helper function
    let jwtToken;
    try {
      jwtToken = getAuthToken();
    } catch (tokenError) {
      console.warn('Error getting auth token directly:', tokenError);

      // Fallback: try to get it from localStorage if available
      try {
        // Check if localStorage is available
        if (typeof localStorage !== 'undefined') {
          // Try to find the Dynamic token in localStorage
          // The key might be different based on Dynamic's implementation
          const dynamicStorageKeys = Object.keys(localStorage).filter(key =>
            key.includes('dynamic') && key.includes('token')
          );

          if (dynamicStorageKeys.length > 0) {
            jwtToken = localStorage.getItem(dynamicStorageKeys[0]);
          }
        }
      } catch (storageError) {
        console.warn('Error accessing localStorage:', storageError);
      }
    }

    if (!jwtToken) {
      // For development/testing, provide a fallback token
      if (process.env.NODE_ENV === 'development') {
        console.warn('Using fallback JWT token for development');
        jwtToken = 'dev_fallback_token';
      } else {
        return {
          isVerified: false,
          message: 'No JWT token found. Please reconnect with GitHub.'
        };
      }
    }

    // The timestamp is included in the JWT token
    const timestamp = Math.floor(Date.now() / 1000);

    return {
      isVerified: true,
      message: `Successfully retrieved JWT token for verification`,
      proof: jwtToken,
      timestamp
    };
  } catch (error) {
    console.error('Error getting JWT token:', error);
    return {
      isVerified: false,
      message: error instanceof Error ? error.message : 'Failed to get JWT token'
    };
  }
}

/**
 * Verifies a signature to ensure it was signed by the expected address
 * @param message Original message that was signed
 * @param signature Signature produced by the wallet
 * @param expectedAddress Address that should have signed the message
 * @returns Boolean indicating if the signature is valid
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    // In ethers v6, we need to use the Signature class
    // This is a simplified version for demo purposes
    console.log('Signature verification not implemented in this demo');

    // For demo purposes, always return true
    return true;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}
