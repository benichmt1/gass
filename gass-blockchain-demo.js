// GASS Blockchain Demo Script - Calls the actual Base Sepolia contract
// This script demonstrates how the Forte Rules Engine applies policies based on O2 Oracle data
const { ethers } = require('ethers');
require('dotenv').config();

// Command line arguments
const args = process.argv.slice(2);
const GITHUB_USERNAME = args.find(arg => arg.startsWith('--username=') || arg.startsWith('-u='))?.split('=')[1] || 'benichmt1';
const FORCE_SEND = args.includes('--force') || args.includes('-f');

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
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "githubUsername",
        "type": "string"
      }
    ],
    "name": "TokensDistributed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "githubUsername",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "lastUpdated",
        "type": "uint256"
      }
    ],
    "name": "LimitedDistribution",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "githubUsername",
        "type": "string"
      }
    ],
    "name": "StandardDistribution",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "githubUsername",
        "type": "string"
      }
    ],
    "name": "BonusDistribution",
    "type": "event"
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

// Contract addresses
const GASS_CONTRACT_ADDRESS = '0x171A95CE45025f0AE0e56eC67Bf7084117e335d8';
const O2_ORACLE_ADDRESS = '0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2';
const RULES_ENGINE_ADDRESS = '0x4E448907B4B8d5949D4A6C67f34419dBb29690bD';

// Policy details
const POLICY_ID = 69; // From README
const TIMESTAMP_THRESHOLD = 1750000000; // From policy.json

async function main() {
  console.log('=== GASS Blockchain Demo: Calling the Production Base Sepolia Contract ===\n');

  // Check for private key
  if (!process.env.PRIV_KEY) {
    console.error('Error: PRIV_KEY environment variable is required');
    console.error('Please add your private key to the .env file:');
    console.error('PRIV_KEY=your_private_key_here');
    process.exit(1);
  }

  // Connect to the Base Sepolia network
  console.log('Connecting to Base Sepolia network...');
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://base-sepolia-rpc.publicnode.com');
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
    console.log('=== Step 1: Reading Data from O2 Oracle ===');
    console.log(`Checking metrics for GitHub user: ${githubUsername}`);

    // Read data from O2 Oracle directly to show what the Rules Engine will check
    const qualityScore = await oracleContract.getQuality_score(githubUsername);
    const lastUpdated = await oracleContract.getLast_updated(githubUsername);
    const reviewCount = await oracleContract.getReview_count(githubUsername);

    console.log(`Quality Score: ${qualityScore}`);
    console.log(`Last Updated: ${lastUpdated} (Threshold: ${TIMESTAMP_THRESHOLD})`);
    console.log(`Review Count: ${reviewCount}\n`);

    // Explain which policy condition will be triggered
    console.log('=== Step 2: Policy Condition Analysis ===');
    if (qualityScore <= 50) {
      console.log('Policy Condition: Quality score too low (≤ 50)');
      console.log('Expected Result: Transaction will revert\n');
    } else if (lastUpdated < TIMESTAMP_THRESHOLD) {
      console.log('Policy Condition: Quality score > 50 but activity not recent');
      console.log('Expected Result: LimitedDistribution event (half tokens)\n');
    } else if (reviewCount > 100) {
      console.log('Policy Condition: Quality score > 50, recent activity, high contribution volume');
      console.log('Expected Result: BonusDistribution event (double tokens)\n');
    } else {
      console.log('Policy Condition: Quality score > 50, recent activity, normal contribution volume');
      console.log('Expected Result: StandardDistribution event (standard amount)\n');
    }

    // Check if distribution has already been processed
    console.log('=== Step 3: Checking Previous Distribution Status ===');
    const alreadyProcessed = await gassContract.hasDistributionBeenProcessed(githubUsername);
    console.log(`Distribution already processed for ${githubUsername}: ${alreadyProcessed}\n`);

    if (!alreadyProcessed || FORCE_SEND) {
      if (alreadyProcessed && FORCE_SEND) {
        console.log('WARNING: Distribution already processed, but --force flag is set. Proceeding anyway.\n');
      }

      console.log('=== Step 4: Calling Contract and Applying Policy ===');
      console.log(`Processing reward for ${githubUsername}...`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Base Amount: ${ethers.utils.formatEther(amount)} tokens\n`);

      // Process the reward - this will trigger the Rules Engine to apply the policy
      console.log('Sending transaction to the blockchain...');
      const tx = await gassContract.processReward(recipient, amount, githubUsername);
      console.log('Transaction hash:', tx.hash);
      console.log(`View on BaseScan: https://sepolia.basescan.org/tx/${tx.hash}`);
      console.log('Waiting for transaction confirmation...');

      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);
      console.log(`Gas used: ${receipt.gasUsed.toString()}\n`);

      // Check for events to see which policy condition was triggered
      console.log('=== Step 5: Analyzing Emitted Events ===');

      // Parse all events from the transaction receipt
      const tokenDistributedEvents = receipt.logs
        .filter(log => log.topics[0] === ethers.utils.id('TokensDistributed(address,uint256,string)'))
        .map(log => gassContract.interface.parseLog(log));

      const limitedDistributionEvents = receipt.logs
        .filter(log => log.topics[0] === ethers.utils.id('LimitedDistribution(address,uint256,string,uint256)'))
        .map(log => gassContract.interface.parseLog(log));

      const standardDistributionEvents = receipt.logs
        .filter(log => log.topics[0] === ethers.utils.id('StandardDistribution(address,uint256,string)'))
        .map(log => gassContract.interface.parseLog(log));

      const bonusDistributionEvents = receipt.logs
        .filter(log => log.topics[0] === ethers.utils.id('BonusDistribution(address,uint256,string)'))
        .map(log => gassContract.interface.parseLog(log));

      // Count total events
      const totalEvents = tokenDistributedEvents.length +
                         limitedDistributionEvents.length +
                         standardDistributionEvents.length +
                         bonusDistributionEvents.length;

      console.log(`Found ${totalEvents} events emitted by the transaction\n`);

      // Create a visual separator
      console.log('┌─────────────────────────────────────────────────────────────────┐');
      console.log('│                        EMITTED EVENTS                           │');
      console.log('└─────────────────────────────────────────────────────────────────┘');

      // Display base event
      if (tokenDistributedEvents.length > 0) {
        const event = tokenDistributedEvents[0];
        console.log('\n🔷 Event: TokensDistributed (Base Event)');
        console.log('  ├─ Recipient: ' + event.args.to);
        console.log('  ├─ Amount: ' + ethers.utils.formatEther(event.args.amount) + ' tokens');
        console.log('  └─ GitHub Username: ' + event.args.githubUsername);
      }

      // Display tier-specific events with more details
      let appliedTier = 'None';
      let finalAmount = amount;

      if (limitedDistributionEvents.length > 0) {
        const event = limitedDistributionEvents[0];
        appliedTier = 'LIMITED';
        finalAmount = event.args.amount;

        console.log('\n🔶 Event: LimitedDistribution');
        console.log('  ├─ Tier: LIMITED (Half Reward)');
        console.log('  ├─ Recipient: ' + event.args.to);
        console.log('  ├─ Amount: ' + ethers.utils.formatEther(event.args.amount) + ' tokens (50% of base amount)');
        console.log('  ├─ GitHub Username: ' + event.args.githubUsername);
        console.log('  ├─ Last Updated: ' + event.args.lastUpdated.toString());
        console.log('  │');
        console.log('  ├─ Policy Condition Matched:');
        console.log('  │  ├─ Quality Score > 50 (' + qualityScore + ')');
        console.log('  │  └─ Last Updated < ' + TIMESTAMP_THRESHOLD + ' (' + lastUpdated + ')');
        console.log('  │');
        console.log('  └─ Explanation: Reward halved because activity is not recent');
      }

      if (standardDistributionEvents.length > 0) {
        const event = standardDistributionEvents[0];
        appliedTier = 'STANDARD';
        finalAmount = event.args.amount;

        console.log('\n🔷 Event: StandardDistribution');
        console.log('  ├─ Tier: STANDARD (Normal Reward)');
        console.log('  ├─ Recipient: ' + event.args.to);
        console.log('  ├─ Amount: ' + ethers.utils.formatEther(event.args.amount) + ' tokens (100% of base amount)');
        console.log('  ├─ GitHub Username: ' + event.args.githubUsername);
        console.log('  │');
        console.log('  ├─ Policy Condition Matched:');
        console.log('  │  ├─ Quality Score > 50 (' + qualityScore + ')');
        console.log('  │  ├─ Last Updated >= ' + TIMESTAMP_THRESHOLD + ' (' + lastUpdated + ')');
        console.log('  │  └─ Review Count <= 100 (' + reviewCount + ')');
        console.log('  │');
        console.log('  └─ Explanation: Standard reward for recent activity with normal contribution volume');
      }

      if (bonusDistributionEvents.length > 0) {
        const event = bonusDistributionEvents[0];
        appliedTier = 'BONUS';
        finalAmount = event.args.amount;

        console.log('\n🔹 Event: BonusDistribution');
        console.log('  ├─ Tier: BONUS (Double Reward)');
        console.log('  ├─ Recipient: ' + event.args.to);
        console.log('  ├─ Amount: ' + ethers.utils.formatEther(event.args.amount) + ' tokens (200% of base amount)');
        console.log('  ├─ GitHub Username: ' + event.args.githubUsername);
        console.log('  │');
        console.log('  ├─ Policy Condition Matched:');
        console.log('  │  ├─ Quality Score > 50 (' + qualityScore + ')');
        console.log('  │  ├─ Last Updated >= ' + TIMESTAMP_THRESHOLD + ' (' + lastUpdated + ')');
        console.log('  │  └─ Review Count > 100 (' + reviewCount + ')');
        console.log('  │');
        console.log('  └─ Explanation: Double reward for recent activity with high contribution volume');
      }

      // Summary of policy application
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│                      POLICY APPLICATION SUMMARY                  │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      console.log('\n• GitHub Username: ' + githubUsername);
      console.log('• Quality Score: ' + qualityScore);
      console.log('• Last Updated: ' + lastUpdated + ' (Threshold: ' + TIMESTAMP_THRESHOLD + ')');
      console.log('• Review Count: ' + reviewCount);
      console.log('• Applied Tier: ' + appliedTier);
      console.log('• Base Amount: ' + ethers.utils.formatEther(amount) + ' tokens');
      console.log('• Final Amount: ' + ethers.utils.formatEther(finalAmount) + ' tokens');

      // Transaction details
      console.log('\n┌─────────────────────────────────────────────────────────────────┐');
      console.log('│                      TRANSACTION DETAILS                         │');
      console.log('└─────────────────────────────────────────────────────────────────┘');
      console.log('\n• Transaction Hash: ' + tx.hash);
      console.log('• Block Number: ' + receipt.blockNumber);
      console.log('• Gas Used: ' + receipt.gasUsed.toString());
      console.log('• View on BaseScan: https://sepolia.basescan.org/tx/' + tx.hash);

      console.log('\n=== Step 6: Verifying Final State ===');
    } else {
      console.log('Skipping transaction since distribution has already been processed.');
      console.log('Use --force flag to send the transaction anyway.\n');
      console.log('=== Step 6: Verifying Final State ===');
    }

    // Verify the distribution was processed
    const processedAfter = await gassContract.hasDistributionBeenProcessed(githubUsername);
    console.log(`Distribution processed for ${githubUsername} after transaction: ${processedAfter}`);
    console.log('\nDemo complete! The policy was successfully applied based on O2 Oracle data.');

  } catch (error) {
    console.log('\n=== Error Occurred ===');
    if (error.message.includes('Quality score too low')) {
      console.error('Error: Quality score too low for this developer');
      console.error('Policy condition triggered: FC:getQualityScore(githubUsername) <= 50');
    } else if (error.message.includes('Row does not exist')) {
      console.error('Error: GitHub username not found in the O2 Oracle');
    } else if (error.message.includes('Already distributed')) {
      console.error('Error: Tokens have already been distributed to this developer');
    } else {
      console.error('Error:', error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
