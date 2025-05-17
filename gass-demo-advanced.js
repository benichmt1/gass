// GASS Advanced Demo Script - Shows behind the scenes of calling the production Base Sepolia contract
// This script demonstrates how the Forte Rules Engine applies policies based on O2 Oracle data
// It includes simulation capabilities to demonstrate different policy conditions
const { ethers } = require('ethers');
require('dotenv').config();

// Command line arguments
const args = process.argv.slice(2);
const SCENARIO = args.find(arg => arg.startsWith('--scenario='))?.split('=')[1] || 'limited';
const GITHUB_USERNAME = args.find(arg => arg.startsWith('--username='))?.split('=')[1] || 'benichmt1';

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

// Contract addresses
const GASS_CONTRACT_ADDRESS = '0x171A95CE45025f0AE0e56eC67Bf7084117e335d8';
const O2_ORACLE_ADDRESS = '0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2';
const RULES_ENGINE_ADDRESS = '0x4E448907B4B8d5949D4A6C67f34419dBb29690bD';

// Policy details
const POLICY_ID = 69; // From README
const TIMESTAMP_THRESHOLD = 1750000000; // From policy.json

// Predefined scenarios for demonstration
const scenarios = {
  rejected: {
    qualityScore: 35,
    lastUpdated: 1747331744,
    reviewCount: 1,
    description: 'Quality score too low (≤ 50)',
    expectedResult: 'Transaction will revert'
  },
  limited: {
    qualityScore: 63,
    lastUpdated: 1747331744,
    reviewCount: 25,
    description: 'Quality score > 50 but activity not recent',
    expectedResult: 'LimitedDistribution event (half tokens)'
  },
  standard: {
    qualityScore: 75,
    lastUpdated: 1751000000,
    reviewCount: 50,
    description: 'Quality score > 50, recent activity, normal contribution volume',
    expectedResult: 'StandardDistribution event (standard amount)'
  },
  bonus: {
    qualityScore: 85,
    lastUpdated: 1751000000,
    reviewCount: 150,
    description: 'Quality score > 50, recent activity, high contribution volume',
    expectedResult: 'BonusDistribution event (double tokens)'
  }
};

// Mock O2 Oracle for simulation
class MockO2Oracle {
  constructor(scenario) {
    this.data = scenario;
  }

  async getQuality_score() {
    return this.data.qualityScore;
  }

  async getLast_updated() {
    return this.data.lastUpdated;
  }

  async getReview_count() {
    return this.data.reviewCount;
  }
}

// Mock GASS Contract for simulation
class MockGASSContract {
  constructor() {
    this.processedDistributions = {};
  }

  async hasDistributionBeenProcessed(githubUsername) {
    return this.processedDistributions[githubUsername] || false;
  }

  async processReward(recipient, amount, githubUsername) {
    this.processedDistributions[githubUsername] = true;
    return { hash: '0xsimulated_transaction_hash' };
  }

  // Mock for wait method
  async wait() {
    return {
      blockNumber: 12345678,
      gasUsed: ethers.BigNumber.from('100000'),
      logs: []
    };
  }
}

async function main() {
  console.log('=== GASS Advanced Demo: Behind the Scenes of Smart Contract Policy Application ===\n');
  
  // Check if scenario is valid
  if (!scenarios[SCENARIO]) {
    console.error(`Error: Invalid scenario "${SCENARIO}". Valid options are: ${Object.keys(scenarios).join(', ')}`);
    process.exit(1);
  }
  
  console.log(`Running scenario: ${SCENARIO.toUpperCase()}`);
  console.log(`Description: ${scenarios[SCENARIO].description}`);
  console.log(`Expected result: ${scenarios[SCENARIO].expectedResult}\n`);
  
  // Create mock instances for simulation
  const mockOracleContract = new MockO2Oracle(scenarios[SCENARIO]);
  const mockGassContract = new MockGASSContract();
  
  console.log(`GASS Contract: ${GASS_CONTRACT_ADDRESS}`);
  console.log(`O2 Oracle: ${O2_ORACLE_ADDRESS}`);
  console.log(`Rules Engine: ${RULES_ENGINE_ADDRESS}`);
  console.log(`Policy ID: ${POLICY_ID}\n`);

  // Use the GitHub username from command line or default
  const recipient = '0x' + '1'.repeat(40); // Simulated recipient address
  const amount = ethers.utils.parseEther('1.0'); // 1 token
  const githubUsername = GITHUB_USERNAME;
  
  console.log(`Using GitHub username: ${githubUsername}`);
  console.log(`Recipient address: ${recipient}`);
  console.log(`Base token amount: ${ethers.utils.formatEther(amount)} tokens\n`);

  try {
    console.log('=== Step 1: Reading Data from O2 Oracle ===');
    console.log(`Checking metrics for GitHub user: ${githubUsername}`);
    
    // Read data from mock O2 Oracle
    const qualityScore = await mockOracleContract.getQuality_score();
    const lastUpdated = await mockOracleContract.getLast_updated();
    const reviewCount = await mockOracleContract.getReview_count();
    
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
    const alreadyProcessed = await mockGassContract.hasDistributionBeenProcessed(githubUsername);
    console.log(`Distribution already processed for ${githubUsername}: ${alreadyProcessed}\n`);

    if (!alreadyProcessed) {
      console.log('=== Step 4: Calling Contract and Applying Policy ===');
      console.log(`Processing reward for ${githubUsername}...`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Base Amount: ${ethers.utils.formatEther(amount)} tokens\n`);

      // Simulate the policy application
      console.log('SIMULATION: Predicting policy outcome based on O2 Oracle data');
      
      if (qualityScore <= 50) {
        console.log('SIMULATION: Transaction would revert with "Quality score too low"');
        throw new Error('Quality score too low');
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
      
      // Mark as processed in our simulation
      await mockGassContract.processReward(recipient, amount, githubUsername);
    }
    
    console.log('\n=== Step 5: Verifying Final State ===');
    // Verify the distribution was processed
    const processedAfter = await mockGassContract.hasDistributionBeenProcessed(githubUsername);
    console.log(`Distribution processed for ${githubUsername} after transaction: ${processedAfter}`);
    console.log('\nDemo complete! The policy was successfully applied based on simulated O2 Oracle data.');

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
