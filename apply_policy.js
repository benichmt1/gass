const fs = require('fs');
const { ethers } = require('ethers');
require('dotenv').config();

// Read the policy JSON file
const policyData = fs.readFileSync('quality_score_policy.json', 'utf8');
const policy = JSON.parse(policyData);

// Connect to the provider
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIV_KEY, provider);

// Rules Engine ABI (simplified for setupPolicy and applyPolicy functions)
const rulesEngineAbi = [
  "function setupPolicy(string memory policyJSON) external returns (uint256)",
  "function applyPolicy(uint256 policyId, address callingContractAddress) external"
];

async function main() {
  try {
    // Create contract instance
    const rulesEngine = new ethers.Contract(
      process.env.RULES_ENGINE_ADDRESS,
      rulesEngineAbi,
      wallet
    );

    console.log('Setting up policy...');
    const setupTx = await rulesEngine.setupPolicy(policyData);
    const setupReceipt = await setupTx.wait();
    
    // Parse the logs to get the policy ID
    // This is a simplified approach - in a real scenario, you'd need to parse the event logs properly
    console.log('Policy setup transaction:', setupReceipt.transactionHash);
    
    // For now, let's assume the policy ID is 1 (you'd need to get this from the event logs)
    const policyId = 1;
    
    console.log(`Applying policy ID ${policyId} to contract at ${process.argv[2]}...`);
    const applyTx = await rulesEngine.applyPolicy(policyId, process.argv[2]);
    const applyReceipt = await applyTx.wait();
    
    console.log('Policy applied successfully!');
    console.log('Transaction hash:', applyReceipt.transactionHash);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Check if contract address is provided
if (process.argv.length < 3) {
  console.error('Please provide the contract address as an argument');
  process.exit(1);
}

main();
