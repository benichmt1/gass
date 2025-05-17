# GASS Demo Script

This demo script shows the behind-the-scenes process of calling the GASS (GitHub Activity Scoring System) smart contract on Base Sepolia testnet. It demonstrates how the Forte Rules Engine applies policies based on data from the O2 Oracle.

## Prerequisites

1. Node.js installed
2. Private key for a wallet with Base Sepolia ETH

## Setup

1. Create a `.env` file with the following variables:
   ```
   RPC_URL=https://base-sepolia-rpc.publicnode.com
   PRIV_KEY=your_private_key_here
   ```

2. Install dependencies:
   ```
   npm install ethers@5.7.2 dotenv
   ```

## Getting Base Sepolia ETH

To run the blockchain demo, you'll need Base Sepolia ETH. You can get it from:

1. **Base Sepolia Faucet**: Visit [https://www.coinbase.com/faucets/base-sepolia-faucet](https://www.coinbase.com/faucets/base-sepolia-faucet)
2. **Alchemy Faucet**: Visit [https://sepoliafaucet.com/](https://sepoliafaucet.com/) and select Base Sepolia
3. **Paradigm Faucet**: Visit [https://faucet.paradigm.xyz/](https://faucet.paradigm.xyz/) and select Base Sepolia

Once you have Base Sepolia ETH, you can use the blockchain demo script to interact with the contract.

## Running the Demo

### Basic Demo

Run the basic demo script with:

```
# Run in simulation mode (no transaction sent)
node gass-demo.js --simulate

# Run with a specific GitHub username
node gass-demo.js --username=your_github_username --simulate

# Run with actual transaction (requires private key)
node gass-demo.js
```

### Advanced Demo

The advanced demo script simulates different policy scenarios without connecting to the blockchain:

```
# Run with the 'limited' scenario (default)
node gass-demo-advanced.js --scenario=limited

# Run with the 'rejected' scenario (quality score too low)
node gass-demo-advanced.js --scenario=rejected

# Run with the 'standard' scenario (normal reward)
node gass-demo-advanced.js --scenario=standard

# Run with the 'bonus' scenario (double reward)
node gass-demo-advanced.js --scenario=bonus

# Run with a custom GitHub username
node gass-demo-advanced.js --scenario=bonus --username=your_github_username
```

### Blockchain Demo

The blockchain demo script actually calls the production Base Sepolia contract:

```
# Call the contract with the default GitHub username (benichmt1)
node gass-blockchain-demo.js

# Call the contract with a specific GitHub username
node gass-blockchain-demo.js --username=your_github_username

# Force a transaction even if the distribution has already been processed
node gass-blockchain-demo.js --force
```

**Important**: This script requires:
1. A private key with Base Sepolia ETH in your `.env` file
2. The GitHub username must exist in the O2 Oracle
3. The quality score must be > 50 to avoid transaction revert

### Revert Demo

The revert demo script demonstrates what happens when calling the contract with a non-existent GitHub username:

```
# Run with the default non-existent username
node gass-revert-demo.js

# Run with a specific non-existent username
node gass-revert-demo.js --username=non_existent_user
```

This script shows how the transaction reverts when:
1. The GitHub username doesn't exist in the O2 Oracle
2. The Rules Engine tries to read data from the O2 Oracle
3. The O2 Oracle reverts with "Row does not exist"
4. This causes the entire transaction to revert

## What the Demo Shows

The script demonstrates the following process:

1. **Reading Data from O2 Oracle**: Shows the GitHub user's metrics (quality score, last updated timestamp, review count)
2. **Policy Condition Analysis**: Explains which policy condition will be triggered based on the metrics
3. **Checking Previous Distribution Status**: Verifies if the user has already received tokens
4. **Calling Contract and Applying Policy**: Executes the transaction that triggers the Rules Engine
5. **Analyzing Emitted Events**: Shows which events were emitted based on the policy conditions
6. **Verifying Final State**: Confirms the distribution was processed

## Expected Output

For the test user 'benichmt1', the script should show:
- Quality Score: 63
- Last Updated: 1747331744 (below the threshold of 1750000000)
- Review Count: 25

This should trigger the "Limited" distribution tier, resulting in a `LimitedDistribution` event being emitted with half the token amount.

## Contract Details

- **GASS Contract**: `0x171A95CE45025f0AE0e56eC67Bf7084117e335d8`
- **O2 Oracle**: `0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2`
- **Rules Engine**: `0x4E448907B4B8d5949D4A6C67f34419dBb29690bD`
- **Policy ID**: 69

## Policy Conditions

The GASS contract uses the following policy conditions:

1. **Rejected**: Quality score ≤ 50 (transaction reverts)
2. **Limited**: Quality score > 50, but activity not recent (half tokens)
3. **Standard**: Quality score > 50, recent activity, normal contribution volume (standard amount)
4. **Bonus**: Quality score > 50, recent activity, high contribution volume (double tokens)

## Behind the Scenes

When the `processReward` function is called:

1. The Rules Engine intercepts the call via the `checkRulesBeforeprocessReward` modifier
2. It queries the O2 Oracle for the user's metrics using foreign calls
3. It evaluates the policy conditions based on those metrics
4. It emits the appropriate event based on which condition was met
5. The transaction completes and the distribution is marked as processed

This demonstrates how the Forte Rules Engine allows for flexible, on-chain policy enforcement without changing the contract code.
