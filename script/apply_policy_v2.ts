/**
 * apply_policy_v2.ts
 *
 * Applies o2_oracle_policy_v2.json to the GASS contract using
 * @fortefoundation/forte-rules-engine-sdk v0.20.x against RE Diamond v0.9.2.
 *
 * Usage:
 *   npx tsx script/apply_policy_v2.ts
 *
 * Required env vars (reads from web-wallet-demo/.env.local):
 *   ADMIN_PRIVATE_KEY         - deployer private key (must be policy admin)
 *   NEXT_PUBLIC_GASS_CONTRACT_ADDRESS - GASS contract address on Base Sepolia
 */

import dotenv from 'dotenv';
import path from 'path';
import { readFileSync } from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), 'web-wallet-demo/.env.local') });

import { RulesEngine, connectConfig } from '@fortefoundation/forte-rules-engine-sdk';
import {
    createClient,
    http,
    getAddress,
    type Address,
    type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createConfig, mock } from '@wagmi/core';

// ─── Configuration ────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) throw new Error('ADMIN_PRIVATE_KEY is required');

const GASS_ADDRESS = getAddress(
    (process.env.NEXT_PUBLIC_GASS_CONTRACT_ADDRESS as string) ||
    '0xa158B11f0c9F6cafC6C5b81Fa2f5F2E3b2B989E0'
);
const RE_ADDRESS: Address = getAddress('0x6189A916E3f190Bf3cE6247b7A0dE862d1De8387');
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const account = privateKeyToAccount(PRIVATE_KEY);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n═══════════════════════════════════════');
    console.log('  GASS Rules Engine Policy Application');
    console.log('═══════════════════════════════════════\n');
    console.log(`  Deployer:       ${account.address}`);
    console.log(`  Rules Engine:   ${RE_ADDRESS}`);
    console.log(`  GASS Contract:  ${GASS_ADDRESS}`);
    console.log(`  Network:        Base Sepolia\n`);

    // Set up wagmi config (required by the SDK)
    const config = createConfig({
        chains: [baseSepolia],
        client({ chain }) {
            return createClient({
                chain,
                transport: http(RPC_URL),
                account,
            });
        },
        connectors: [mock({ accounts: [account.address] })],
    });

    const client = config.getClient({ chainId: baseSepolia.id });

    // Create RulesEngine instance — 2 confirmations for Base Sepolia
    const rulesEngine = await RulesEngine.create(RE_ADDRESS, config, client, 2);
    if (!rulesEngine) throw new Error('Failed to create RulesEngine instance');

    await connectConfig(config, 0);

    // ── Step 0: Unset old policy from GASS contract ───────────────────────────
    const OLD_POLICY_ID = 6;
    console.log(`Step 0: Unsetting old policy ${OLD_POLICY_ID} from GASS contract...`);
    try {
        await rulesEngine.unsetPolicies([OLD_POLICY_ID], GASS_ADDRESS);
        console.log(`  ✓ Policy ${OLD_POLICY_ID} unset\n`);
    } catch (e: any) {
        console.log(`  ⚠ Could not unset policy ${OLD_POLICY_ID} (may not be applied): ${e.message}\n`);
    }

    // ── Step 1: Create policy from JSON ───────────────────────────────────────
    console.log('Step 1: Creating policy from o2_oracle_policy_v2.json...');
    const policyData = readFileSync(
        path.resolve(process.cwd(), 'o2_oracle_policy_v2.json'),
        'utf-8'
    );

    const { policyId } = await rulesEngine.createPolicy(policyData);
    console.log(`  ✓ Policy created: ID = ${policyId}\n`);

    // ── Step 2: Apply policy to GASS contract ─────────────────────────────────
    console.log(`Step 2: Applying policy ${policyId} to GASS contract...`);
    await rulesEngine.appendPolicy(policyId, GASS_ADDRESS);
    console.log(`  ✓ Policy ${policyId} applied to ${GASS_ADDRESS}\n`);

    // ── Done ──────────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════');
    console.log('  Policy successfully applied!');
    console.log('═══════════════════════════════════════');
    console.log(`\n  Policy ID:  ${policyId}`);
    console.log(`  RE:         ${RE_ADDRESS}`);
    console.log(`  Contract:   ${GASS_ADDRESS}\n`);
    console.log('  SAVE THIS POLICY ID — needed to update or delete later.\n');
}

main().catch(err => {
    console.error('\n✗ Error:', err.message || err);
    process.exit(1);
});
