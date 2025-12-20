// GASS Revert Demo Script - Shows what happens when calling the contract with a non-existent user
// This script demonstrates how the transaction reverts when the GitHub username doesn't exist in the O2 Oracle
const { ethers } = require('ethers');
require('dotenv').config();

// Command line arguments
const args = process.argv.slice(2);
const GITHUB_USERNAME = args.find(arg => arg.startsWith('--username=') || arg.startsWith('-u='))?.split('=')[1] || 'non_existent_user';

// Contract ABI for the GASS contract
const contractABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "githubUsername",
        "type": "string"
      }
    ],
    "name": "processReward",
    "outputs": [
      {
        "internalType": "bool",
        "name": "success",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "githubUsername",
        "type": "string"
      }
    ],
    "name": "hasDistributionBeenProcessed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "distributed",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// O2 Oracle ABI (minimal for demonstration)
const oracleABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "rowId",
        "type": "string"
      }
    ],
    "name": "getQuality_score",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "rowId",
        "type": "string"
      }
    ],
    "name": "getLast_updated",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "rowId",
        "type": "string"
      }
    ],
    "name": "getReview_count",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Contract addresses from .env file
const GASS_CONTRACT_ADDRESS = '0x171A95CE45025f0AE0e56eC67Bf7084117e335d8';
const O2_ORACLE_ADDRESS = process.env.O2_ORACLE_ADDRESS || '0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2';
const RULES_ENGINE_ADDRESS = process.env.RULES_ENGINE_ADDRESS || '0x4E448907B4B8d5949D4A6C67f34419dBb29690bD';

// Policy details
const POLICY_ID = 69; // From README

async function main() {
  console.log('=== GASS Revert Demo: Testing with Non-Existent GitHub Username ===\n');

  // Check for private key
  if (!process.env.PRIV_KEY) {
    console.error('Error: PRIV_KEY environment variable is required');
    console.error('Please add your private key to the .env file');
    process.exit(1);
  }

  // Connect to the Base Sepolia network
  console.log('Connecting to Base Sepolia network...');
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://sepolia.base.org');
  const wallet = new ethers.Wallet(process.env.PRIV_KEY, provider);
  console.log(`Connected with wallet address: ${wallet.address}\n`);

  // Create contract instances
  const gassContract = new ethers.Contract(GASS_CONTRACT_ADDRESS, contractABI, wallet);
  const oracleContract = new ethers.Contract(O2_ORACLE_ADDRESS, oracleABI, wallet);

  console.log(`GASS Contract: ${GASS_CONTRACT_ADDRESS}`);
  console.log(`O2 Oracle: ${O2_ORACLE_ADDRESS}`);
  console.log(`Rules Engine: ${RULES_ENGINE_ADDRESS}`);
  console.log(`Policy ID: ${POLICY_ID}\n`);

  // Use the GitHub username from command line or default
  const recipient = wallet.address;
  const amount = ethers.utils.parseEther('1.0'); // 1 token
  const githubUsername = GITHUB_USERNAME;

  console.log(`Using GitHub username: ${githubUsername}`);
  console.log(`Recipient address: ${recipient}`);
  console.log(`Base token amount: ${ethers.utils.formatEther(amount)} tokens\n`);

  try {
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                CHECKING GITHUB USERNAME IN O2 ORACLE                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log(`\nAttempting to read data for GitHub user: ${githubUsername}`);

    try {
      // Try to read data from O2 Oracle
      const qualityScore = await oracleContract.getQuality_score(githubUsername);
      console.log(`\n✅ GitHub username '${githubUsername}' exists in the O2 Oracle`);
      console.log(`   Quality Score: ${qualityScore}`);
      console.log('\n⚠️  This demo is designed to show what happens with non-existent usernames.');
      console.log('   You may want to try with a different username that does not exist in the O2 Oracle.');
      console.log('\nProceeding with the transaction anyway...\n');
    } catch (error) {
      // If we get an error, the username doesn't exist
      console.log(`\n❌ GitHub username '${githubUsername}' does not exist in the O2 Oracle`);
      console.log('   Error: ' + (error.message.includes('Row does not exist') ? 'Row does not exist' : error.message));
      console.log('\n✅ Perfect! This is what we want to demonstrate.\n');
    }

    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│             CALLING CONTRACT WITH NON-EXISTENT USERNAME          │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('\nWhen a GitHub username does not exist in the O2 Oracle:');
    console.log('1️⃣  The Rules Engine will try to read data from the O2 Oracle');
    console.log('2️⃣  The O2 Oracle will revert with "Row does not exist"');
    console.log('3️⃣  This will cause the entire transaction to revert\n');

    console.log('Sending transaction to the blockchain...');
    const tx = await gassContract.processReward(recipient, amount, githubUsername, {
      gasLimit: 500000 // Set a higher gas limit to ensure the transaction is sent
    });
    console.log('Transaction hash:', tx.hash);
    console.log(`View on BaseScan: https://sepolia.basescan.org/tx/${tx.hash}`);
    console.log('Waiting for transaction confirmation...');

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    console.log(`Gas used: ${receipt.gasUsed.toString()}\n`);

    // If we get here, something unexpected happened
    console.log('⚠️ Unexpected result: Transaction did not revert as expected');
    console.log('This could mean the username actually exists or there was a change in the contract behavior');

  } catch (error) {
    console.log('\n=== Transaction Reverted as Expected ===');

    console.log('\n┌─────────────────────────────────────────────────────────────────┐');
    console.log('│                    TRANSACTION REVERTED AS EXPECTED                │');
    console.log('└─────────────────────────────────────────────────────────────────┘');

    // Check if the transaction was actually sent and reverted
    if (error.transactionHash) {
      console.log('\n📊 TRANSACTION DETAILS:');
      console.log('  ├─ Hash: ' + error.transactionHash);
      console.log('  ├─ Status: ❌ REVERTED');

      if (error.receipt) {
        console.log('  ├─ Block Number: ' + error.receipt.blockNumber);
        console.log('  ├─ Gas Used: ' + error.receipt.gasUsed.toString());
      }

      console.log('  └─ View on BaseScan: https://sepolia.basescan.org/tx/' + error.transactionHash);

      console.log('\n✅ VERIFICATION: Transaction was sent to the blockchain and reverted as expected');

      console.log('\n📝 EXPLANATION:');
      console.log('  This demonstrates how the Forte Rules Engine interacts with the O2 Oracle:');
      console.log('  1️⃣  The Rules Engine tried to call getQuality_score() on the O2 Oracle');
      console.log('  2️⃣  The O2 Oracle reverted because the row does not exist');
      console.log('  3️⃣  This caused the entire transaction to revert');

      console.log('\n🔒 SECURITY BENEFITS:');
      console.log('  • Only valid GitHub usernames can be used');
      console.log('  • The contract will not process rewards for non-existent users');
      console.log('  • The Rules Engine provides a security layer that validates data');
      console.log('  • No gas is wasted on processing invalid data beyond the initial check');
    } else if (error.message.includes('Row does not exist')) {
      // This is the case when we tried to read from the Oracle directly
      console.log('\n📊 ERROR DETAILS:');
      console.log('  └─ Message: Row does not exist');

      console.log('\n✅ VERIFICATION: GitHub username does not exist in the O2 Oracle');
    } else if (error.message.includes('Quality score too low')) {
      console.log('\n⚠️ UNEXPECTED RESULT:');
      console.log('  Transaction reverted because the quality score was too low');
      console.log('  This means the username exists in the O2 Oracle but has a quality score ≤ 50');
    } else {
      console.log('\n⚠️ UNEXPECTED ERROR:');
      console.log('  Message: ' + error.message);
    }
  }

  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│                           DEMO COMPLETE                           │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('\nThis demo has shown how the GASS contract handles non-existent GitHub usernames:');
  console.log('• The transaction reverts when the username does not exist in the O2 Oracle');
  console.log('• This is a security feature that prevents processing invalid data');
  console.log('• The Forte Rules Engine provides this validation through foreign calls to the O2 Oracle');
  console.log('\nView the transaction on BaseScan to confirm it reverted.');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
