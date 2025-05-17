// GASS Demo Script - Shows behind the scenes of calling the production Base Sepolia contract
// This script demonstrates how the Forte Rules Engine applies policies based on O2 Oracle data
const { ethers } = require('ethers');
require('dotenv').config();

// Command line arguments
const args = process.argv.slice(2);
const SIMULATE_ONLY = args.includes('--simulate') || args.includes('-s');
const GITHUB_USERNAME = args.find(arg => arg.startsWith('--username=') || arg.startsWith('-u='))?.split('=')[1] || 'benichmt1';

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
  console.log('=== GASS Demo: Behind the Scenes of Smart Contract Policy Application ===\n');

  // Connect to the Base Sepolia network
  console.log('Connecting to Base Sepolia network...');
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://base-sepolia-rpc.publicnode.com');

  // Create wallet if not in simulation mode
  let wallet;
  if (!SIMULATE_ONLY) {
    if (!process.env.PRIV_KEY) {
      console.error('Error: PRIV_KEY environment variable is required for non-simulation mode');
      process.exit(1);
    }
    wallet = new ethers.Wallet(process.env.PRIV_KEY, provider);
    console.log(`Connected with wallet address: ${wallet.address}\n`);
  } else {
    console.log('Running in SIMULATION mode (no transactions will be sent)\n');
    // Create a random wallet for simulation
    wallet = ethers.Wallet.createRandom().connect(provider);
  }

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

    if (!alreadyProcessed) {
      console.log('=== Step 4: Calling Contract and Applying Policy ===');
      console.log(`Processing reward for ${githubUsername}...`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Base Amount: ${ethers.utils.formatEther(amount)} tokens\n`);

      if (SIMULATE_ONLY) {
        // Simulate the policy application without sending a transaction
        console.log('SIMULATION: Predicting policy outcome based on O2 Oracle data');

        if (qualityScore <= 50) {
          console.log('SIMULATION: Transaction would revert with "Quality score too low"');
        } else if (lastUpdated < TIMESTAMP_THRESHOLD) {
          const halfAmount = amount.div(2);
          console.log('SIMULATION: LimitedDistribution event would be emitted');
          console.log(`SIMULATION: Token amount would be halved to ${ethers.utils.formatEther(halfAmount)} tokens`);
          console.log('SIMULATION: Policy condition matched: (FC:getQualityScore > 50) && (FC:getLastUpdated < 1750000000)');
        } else if (reviewCount > 100) {
          const doubleAmount = amount.mul(2);
          console.log('SIMULATION: BonusDistribution event would be emitted');
          console.log(`SIMULATION: Token amount would be doubled to ${ethers.utils.formatEther(doubleAmount)} tokens`);
          console.log('SIMULATION: Policy condition matched: (FC:getQualityScore > 50) && (FC:getLastUpdated >= 1750000000) && (FC:getReviewCount > 100)');
        } else {
          console.log('SIMULATION: StandardDistribution event would be emitted');
          console.log(`SIMULATION: Standard token amount would be ${ethers.utils.formatEther(amount)} tokens`);
          console.log('SIMULATION: Policy condition matched: FC:getQualityScore > 50 AND FC:getLastUpdated >= 1750000000 AND FC:getReviewCount <= 100');
        }

        console.log('\nSIMULATION: No transaction was sent to the blockchain');
        console.log('\n=== Step 6: Verifying Final State ===');
      } else {
        // Process the reward - this will trigger the Rules Engine to apply the policy
        const tx = await gassContract.processReward(recipient, amount, githubUsername);
        console.log('Transaction hash:', tx.hash);
        console.log('Waiting for transaction confirmation...');

        // Wait for the transaction to be mined
        const receipt = await tx.wait();
        console.log('Transaction confirmed in block:', receipt.blockNumber);
        console.log(`Gas used: ${receipt.gasUsed.toString()}\n`);

        // Check for events to see which policy condition was triggered
        console.log('=== Step 5: Analyzing Emitted Events ===');

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

        if (tokenDistributedEvents.length > 0) {
          console.log('✓ TokensDistributed event emitted (base event)');
        }

        if (limitedDistributionEvents.length > 0) {
          console.log('✓ LimitedDistribution event emitted - Half reward due to outdated data');
          console.log('  Amount:', ethers.utils.formatEther(limitedDistributionEvents[0].args.amount), 'tokens');
          console.log('  Last updated timestamp:', limitedDistributionEvents[0].args.lastUpdated.toString());
          console.log('  Policy condition matched: (FC:getQualityScore > 50) && (FC:getLastUpdated < 1750000000)');
        }

        if (standardDistributionEvents.length > 0) {
          console.log('✓ StandardDistribution event emitted - Standard reward');
          console.log('  Amount:', ethers.utils.formatEther(standardDistributionEvents[0].args.amount), 'tokens');
          console.log('  Policy condition matched: FC:getQualityScore > 50 AND FC:getLastUpdated >= 1750000000 AND FC:getReviewCount <= 100');
        }

        if (bonusDistributionEvents.length > 0) {
          console.log('✓ BonusDistribution event emitted - Double reward for high activity');
          console.log('  Amount:', ethers.utils.formatEther(bonusDistributionEvents[0].args.amount), 'tokens');
          console.log('  Policy condition matched: (FC:getQualityScore > 50) && (FC:getLastUpdated >= 1750000000) && (FC:getReviewCount > 100)');
        }

        console.log('\n=== Step 6: Verifying Final State ===');
      }
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
