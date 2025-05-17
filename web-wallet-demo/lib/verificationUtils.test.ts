/**
 * Tests for verification utilities
 * Run with: npm test
 */

import { verifyGithubCredential, verifySignature } from './verificationUtils';
import { verifyGithubCredentialOnChain } from './mockContract';
import { ethers } from 'ethers';

describe('GitHub Credential Verification', () => {
  test('verifyGithubCredential should return false for empty credentials', () => {
    const result = verifyGithubCredential([]);
    expect(result.isVerified).toBe(false);
  });

  test('verifyGithubCredential should return false for non-GitHub credentials', () => {
    const credentials = [
      {
        format: 'email',
        email: 'test@example.com'
      }
    ];
    const result = verifyGithubCredential(credentials as any);
    expect(result.isVerified).toBe(false);
  });

  test('verifyGithubCredential should return true for valid GitHub credentials', () => {
    const credentials = [
      {
        format: 'oauth',
        oauthProvider: 'github',
        oauthUsername: 'testuser'
      }
    ];
    const result = verifyGithubCredential(credentials as any);
    expect(result.isVerified).toBe(true);
    expect(result.message).toContain('testuser');
  });
});

describe('Signature Verification', () => {
  test('verifySignature should validate a correctly signed message', async () => {
    // Create a random wallet for testing
    const wallet = ethers.Wallet.createRandom();
    const message = 'Test message';
    
    // Sign the message
    const signature = await wallet.signMessage(message);
    
    // Verify the signature
    const isValid = verifySignature(message, signature, wallet.address);
    expect(isValid).toBe(true);
  });

  test('verifySignature should reject an incorrectly signed message', async () => {
    // Create two random wallets
    const wallet1 = ethers.Wallet.createRandom();
    const wallet2 = ethers.Wallet.createRandom();
    const message = 'Test message';
    
    // Sign with wallet1
    const signature = await wallet1.signMessage(message);
    
    // Verify against wallet2's address (should fail)
    const isValid = verifySignature(message, signature, wallet2.address);
    expect(isValid).toBe(false);
  });
});

describe('On-Chain Verification', () => {
  test('verifyGithubCredentialOnChain should validate a correctly signed message', async () => {
    // Create a random wallet for testing
    const wallet = ethers.Wallet.createRandom();
    const githubUsername = 'testuser';
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Create the message that would be signed
    const message = `I confirm that I am the GitHub user "${githubUsername}" and the owner of wallet ${wallet.address}. Timestamp: ${timestamp}`;
    
    // Sign the message
    const signature = await wallet.signMessage(message);
    
    // Verify on-chain
    const result = verifyGithubCredentialOnChain(
      wallet.address,
      githubUsername,
      signature,
      timestamp
    );
    
    expect(result.isValid).toBe(true);
  });

  test('verifyGithubCredentialOnChain should reject an expired timestamp', async () => {
    // Create a random wallet for testing
    const wallet = ethers.Wallet.createRandom();
    const githubUsername = 'testuser';
    
    // Create a timestamp from 2 hours ago
    const twoHoursInSeconds = 2 * 60 * 60;
    const timestamp = Math.floor(Date.now() / 1000) - twoHoursInSeconds;
    
    // Create the message that would be signed
    const message = `I confirm that I am the GitHub user "${githubUsername}" and the owner of wallet ${wallet.address}. Timestamp: ${timestamp}`;
    
    // Sign the message
    const signature = await wallet.signMessage(message);
    
    // Verify on-chain
    const result = verifyGithubCredentialOnChain(
      wallet.address,
      githubUsername,
      signature,
      timestamp
    );
    
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('expired');
  });
});
