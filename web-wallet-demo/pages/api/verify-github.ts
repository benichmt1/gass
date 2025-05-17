import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Dynamic environment ID from .env
const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;

// Response type for the API
type VerificationResponse = {
  success: boolean;
  message: string;
  data?: {
    githubUsername?: string;
    walletAddress?: string;
    isVerified: boolean;
    timestamp: number;
  };
  error?: string;
};

/**
 * API endpoint to verify a GitHub credential using Dynamic's backend validation
 *
 * @param req - The request object containing the JWT token and wallet address
 * @param res - The response object
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerificationResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    // Get the JWT token and wallet address from the request body
    const { jwtToken, walletAddress } = req.body;

    if (!jwtToken) {
      return res.status(400).json({
        success: false,
        message: 'JWT token is required'
      });
    }

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    // Verify the JWT token with Dynamic's API
    const verificationResult = await verifyDynamicJwt(jwtToken, walletAddress);

    if (!verificationResult.success) {
      return res.status(401).json({
        success: false,
        message: 'JWT verification failed',
        error: verificationResult.error
      });
    }

    // Return the verification result
    return res.status(200).json({
      success: true,
      message: 'GitHub credential verified successfully',
      data: {
        githubUsername: verificationResult.githubUsername,
        walletAddress: walletAddress,
        isVerified: true,
        timestamp: Math.floor(Date.now() / 1000)
      }
    });
  } catch (error) {
    console.error('Error verifying GitHub credential:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Verify a JWT token with Dynamic's API
 *
 * @param jwtToken - The JWT token to verify
 * @param walletAddress - The wallet address to check against
 * @returns The verification result
 */
async function verifyDynamicJwt(jwtToken: string, walletAddress: string): Promise<{
  success: boolean;
  githubUsername?: string;
  error?: string;
}> {
  try {
    // Call Dynamic's API to verify the JWT token
    const response = await axios.get('https://app.dynamic.xyz/api/v0/verify-jwt', {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'x-dynamic-env-id': DYNAMIC_ENV_ID,
        'x-api-key': process.env.DYNAMIC_API_KEY
      }
    });

    // Check if the verification was successful
    if (response.status !== 200) {
      return {
        success: false,
        error: `Dynamic API returned status ${response.status}`
      };
    }

    // Get the user data from the response
    const userData = response.data;

    // Check if the wallet address matches
    const walletCredential = userData.verifiedCredentials?.find(
      (cred: any) => cred.address?.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!walletCredential) {
      return {
        success: false,
        error: 'Wallet address does not match any verified credentials'
      };
    }

    // Find the GitHub credential
    const githubCredential = userData.verifiedCredentials?.find(
      (cred: any) => cred.format === 'oauth' && cred.oauthProvider === 'github'
    );

    if (!githubCredential) {
      return {
        success: false,
        error: 'No GitHub credential found'
      };
    }

    // Return the GitHub username
    return {
      success: true,
      githubUsername: githubCredential.oauthUsername
    };
  } catch (error) {
    console.error('Error verifying JWT with Dynamic:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error verifying JWT'
    };
  }
}
