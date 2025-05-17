/**
 * Mock implementation of the GASS contract with verification
 * This file demonstrates how the contract would verify the GitHub credentials
 */

import { ethers } from 'ethers';

/**
 * Mock implementation of the contract's verification function
 * In a real contract, this would be implemented in Solidity
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    // Recover the address that signed the message
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    // Check if the recovered address matches the expected address
    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Mock implementation of the contract's processReward function with verification
 * In a real contract, this would be implemented in Solidity
 */
export function mockProcessReward(
  to: string,
  amount: bigint,
  githubUsername: string,
  verificationProof: string,
  verificationTimestamp: number
): { success: boolean; error?: string } {
  try {
    // 1. Check if the verification timestamp is recent (within last hour)
    const currentTime = Math.floor(Date.now() / 1000);
    const oneHour = 60 * 60;
    
    if (currentTime - verificationTimestamp > oneHour) {
      return { 
        success: false, 
        error: 'Verification proof has expired. Please generate a new proof.' 
      };
    }
    
    // 2. Reconstruct the message that should have been signed
    const message = `I confirm that I am the GitHub user "${githubUsername}" and the owner of wallet ${to}. Timestamp: ${verificationTimestamp}`;
    
    // 3. Verify the signature
    const isValid = verifySignature(message, verificationProof, to);
    
    if (!isValid) {
      return { 
        success: false, 
        error: 'Invalid verification proof. Signature verification failed.' 
      };
    }
    
    // 4. If verification passes, process the reward
    // In a real contract, this would transfer tokens and record the distribution
    console.log(`Processing reward of ${amount} tokens to ${to} for GitHub user ${githubUsername}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error in mock processReward:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error in processReward' 
    };
  }
}

/**
 * Example of how the contract would verify a GitHub credential
 * This is a simplified version of what would happen on-chain
 */
export function verifyGithubCredentialOnChain(
  walletAddress: string,
  githubUsername: string,
  verificationProof: string,
  verificationTimestamp: number
): { isValid: boolean; reason?: string } {
  try {
    // 1. Check if the verification timestamp is recent
    const currentTime = Math.floor(Date.now() / 1000);
    const oneHour = 60 * 60;
    
    if (currentTime - verificationTimestamp > oneHour) {
      return { 
        isValid: false, 
        reason: 'Verification proof has expired' 
      };
    }
    
    // 2. Reconstruct the message that should have been signed
    const message = `I confirm that I am the GitHub user "${githubUsername}" and the owner of wallet ${walletAddress}. Timestamp: ${verificationTimestamp}`;
    
    // 3. Verify the signature
    const isValid = verifySignature(message, verificationProof, walletAddress);
    
    if (!isValid) {
      return { 
        isValid: false, 
        reason: 'Invalid signature' 
      };
    }
    
    return { isValid: true };
  } catch (error) {
    console.error('Error verifying GitHub credential on chain:', error);
    return { 
      isValid: false, 
      reason: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
