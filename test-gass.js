// Test script for GASS contract
const { ethers } = require('ethers');
require('dotenv').config();

// Contract ABI for the GASS contract (minimal ABI for processReward function)
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

// Contract address
const contractAddress = '0x171A95CE45025f0AE0e56eC67Bf7084117e335d8';

async function main() {
  // Connect to the Base Sepolia network
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIV_KEY, provider);

  // Create contract instance
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);

  console.log('Connected to GASS contract at:', contractAddress);

  // Test with a valid GitHub username (benichmt1)
  const recipient = wallet.address;
  const amount = ethers.utils.parseEther('1.0'); // 1 token
  const githubUsername = 'benichmt1';

  try {
    // Check if distribution has already been processed
    const alreadyProcessed = await contract.hasDistributionBeenProcessed(githubUsername);
    console.log(`Distribution already processed for ${githubUsername}: ${alreadyProcessed}`);

    if (!alreadyProcessed) {
      console.log(`Processing reward for ${githubUsername}...`);

      // Process the reward
      const tx = await contract.processReward(recipient, amount, githubUsername);
      console.log('Transaction hash:', tx.hash);

      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);

      // Check for events
      const tokenDistributedEvents = receipt.logs
        .filter(log => log.topics[0] === ethers.utils.id('TokensDistributed(address,uint256,string)'))
        .map(log => contract.interface.parseLog(log));

      const limitedDistributionEvents = receipt.logs
        .filter(log => log.topics[0] === ethers.utils.id('LimitedDistribution(address,uint256,string,uint256)'))
        .map(log => contract.interface.parseLog(log));

      const standardDistributionEvents = receipt.logs
        .filter(log => log.topics[0] === ethers.utils.id('StandardDistribution(address,uint256,string)'))
        .map(log => contract.interface.parseLog(log));

      const bonusDistributionEvents = receipt.logs
        .filter(log => log.topics[0] === ethers.utils.id('BonusDistribution(address,uint256,string)'))
        .map(log => contract.interface.parseLog(log));

      if (tokenDistributedEvents.length > 0) {
        console.log('TokensDistributed event emitted');
      }

      if (limitedDistributionEvents.length > 0) {
        console.log('LimitedDistribution event emitted - Half reward due to outdated data');
        console.log('Amount:', ethers.utils.formatEther(limitedDistributionEvents[0].args.amount), 'ETH');
        console.log('Last updated timestamp:', limitedDistributionEvents[0].args.lastUpdated.toString());
      }

      if (standardDistributionEvents.length > 0) {
        console.log('StandardDistribution event emitted - Standard reward');
        console.log('Amount:', ethers.utils.formatEther(standardDistributionEvents[0].args.amount), 'ETH');
      }

      if (bonusDistributionEvents.length > 0) {
        console.log('BonusDistribution event emitted - Double reward for high activity');
        console.log('Amount:', ethers.utils.formatEther(bonusDistributionEvents[0].args.amount), 'ETH');
      }
    }

    // Verify the distribution was processed
    const processedAfter = await contract.hasDistributionBeenProcessed(githubUsername);
    console.log(`Distribution processed for ${githubUsername} after transaction: ${processedAfter}`);

  } catch (error) {
    if (error.message.includes('Quality score too low')) {
      console.error('Error: Quality score too low for this developer');
    } else if (error.message.includes('Row does not exist')) {
      console.error('Error: GitHub username not found in the O2 Oracle');
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
