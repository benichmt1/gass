/**
 * apply_policy.ts
 *
 * Applies the o2_oracle_policy.json to the GASS contract on the Forte Rules Engine.
 *
 * Uses viem directly (bypassing the SDK's hardcoded Anvil account) so it works
 * on Base Sepolia with your own ADMIN_PRIVATE_KEY.
 *
 * Usage:
 *   npx tsx script/apply_policy.ts
 *
 * Required env vars (reads from web-wallet-demo/.env.local):
 *   ADMIN_PRIVATE_KEY         - deployer private key
 *   NEXT_PUBLIC_GASS_CONTRACT_ADDRESS - GASS contract address on Base Sepolia
 *
 * Optional env var override:
 *   RULES_ENGINE_ADDRESS      - defaults to 0x3f148c6bdd81Af9c6F43665A63289858c2402ECc
 */

import dotenv from 'dotenv';
import path from 'path';
import { readFileSync } from 'fs';

// Load .env.local from the web-wallet-demo directory
dotenv.config({ path: path.resolve(process.cwd(), 'web-wallet-demo/.env.local') });

import {
    createWalletClient,
    createPublicClient,
    http,
    toFunctionSelector,
    type Address,
    type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// SDK utilities — these modules do NOT import the SDK's hardcoded Anvil account,
// so they are safe to use with our own private key.
import { buildARuleStruct, buildAnEffectStruct } from '../node_modules/@thrackle-io/forte-rules-engine-sdk/src/modules/contract-interaction-utils';
import { parseForeignCallDefinition } from '../node_modules/@thrackle-io/forte-rules-engine-sdk/src/modules/parser';
import type { ruleJSON, FCNameToID } from '../node_modules/@thrackle-io/forte-rules-engine-sdk/src/modules/types';

// ABIs from the SDK
const RulesEnginePolicyABI = require('../node_modules/@thrackle-io/forte-rules-engine-sdk/src/abis/RulesEnginePolicyFacet.json').abi;
const RulesEngineComponentABI = require('../node_modules/@thrackle-io/forte-rules-engine-sdk/src/abis/RulesEngineComponentFacet.json').abi;

// ─── Configuration ────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY as Hex;
if (!PRIVATE_KEY) throw new Error('ADMIN_PRIVATE_KEY is required in web-wallet-demo/.env.local');

const GASS_ADDRESS = (process.env.NEXT_PUBLIC_GASS_CONTRACT_ADDRESS as Address) || '0xa158B11f0c9F6cafC6C5b81Fa2f5F2E3b2B989E0';
const RE_ADDRESS: Address = (process.env.RULES_ENGINE_ADDRESS as Address) || '0x3f148c6bdd81Af9c6F43665A63289858c2402ECc';
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

// ─── Viem Clients ─────────────────────────────────────────────────────────────

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
});

const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendTx(functionName: string, args: any[], abi: any[], address: Address): Promise<any> {
    const { request, result } = await publicClient.simulateContract({
        address,
        abi,
        functionName,
        args,
        account,
    });
    const hash = await walletClient.writeContract(request);
    console.log(`  tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
    return result;
}

// Normalize && → AND so the SDK parser handles both styles
function normalizeCondition(condition: string): string {
    return condition.replace(/&&/g, 'AND');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n═══════════════════════════════════════');
    console.log('  GASS Rules Engine Policy Application');
    console.log('═══════════════════════════════════════\n');
    console.log(`  Deployer:       ${account.address}`);
    console.log(`  Rules Engine:   ${RE_ADDRESS}`);
    console.log(`  GASS Contract:  ${GASS_ADDRESS}`);
    console.log(`  Network:        Base Sepolia\n`);

    // Load policy definition
    const policyPath = path.resolve(process.cwd(), 'o2_oracle_policy.json');
    const policyJSON = JSON.parse(readFileSync(policyPath, 'utf-8'));

    // Normalize && to AND in all rule conditions/effects
    for (const rule of policyJSON.RulesJSON) {
        rule.condition = normalizeCondition(rule.condition);
        if (rule.positiveEffects) rule.positiveEffects = rule.positiveEffects.map(normalizeCondition);
        if (rule.negativeEffects) rule.negativeEffects = rule.negativeEffects.map(normalizeCondition);
    }

    // ── Step 1: Create empty policy ───────────────────────────────────────────
    console.log('Step 1: Creating policy...');
    const policyId: number = await sendTx('createPolicy', [[], [], 1], RulesEnginePolicyABI, RE_ADDRESS);
    console.log(`  ✓ Policy created: ID = ${policyId}\n`);

    // ── Step 2: Register foreign calls ────────────────────────────────────────
    console.log('Step 2: Registering foreign calls...');
    const fcIds: FCNameToID[] = [];

    for (const fcJson of policyJSON.ForeignCalls) {
        console.log(`  Creating foreign call: ${fcJson.name}`);
        const fc = parseForeignCallDefinition(fcJson);

        const fcStruct = {
            set: true,
            foreignCallAddress: fc.address,
            signature: toFunctionSelector(fc.signature) as Hex,
            foreignCallIndex: 0,
            returnType: fc.returnType,
            parameterTypes: fc.parameterTypes,
            typeSpecificIndices: fc.encodedIndices,
        };

        const fcId: number = await sendTx('createForeignCall', [policyId, fcStruct], RulesEngineComponentABI, RE_ADDRESS);
        console.log(`  ✓ ${fcJson.name} → ID ${fcId}`);
        fcIds.push({ id: fcId, name: fc.name.split('(')[0], type: 0 });
    }
    console.log('');

    // ── Step 3: Register function signature ───────────────────────────────────
    console.log('Step 3: Registering function signature...');
    const functionSignature = 'processReward(address to, uint256 amount, string githubUsername)';
    const selector = toFunctionSelector(functionSignature) as Hex;

    // Map argument types: address→0, uint256→2, string→1
    const argTypes = [0, 2, 1];

    const fsId: number = await sendTx('createFunctionSignature', [policyId, selector, argTypes], RulesEngineComponentABI, RE_ADDRESS);
    console.log(`  ✓ ${functionSignature} → ID ${fsId}\n`);

    // ── Step 4: Create rules ───────────────────────────────────────────────────
    console.log('Step 4: Creating rules...');
    const ruleIds: number[] = [];

    for (let i = 0; i < policyJSON.RulesJSON.length; i++) {
        const ruleJson: ruleJSON = policyJSON.RulesJSON[i];
        console.log(`  Creating rule ${i + 1}: ${ruleJson.condition.substring(0, 60)}...`);

        const effect = buildAnEffectStruct(ruleJson, [], fcIds);
        const ruleStruct = buildARuleStruct(policyId, ruleJson, fcIds, effect, []);

        const ruleId: number = await sendTx('createRule', [policyId, ruleStruct], RulesEnginePolicyABI, RE_ADDRESS);
        if (ruleId === -1) throw new Error(`Failed to create rule ${i + 1}`);
        console.log(`  ✓ Rule ${i + 1} → ID ${ruleId}`);
        ruleIds.push(ruleId);
    }
    console.log('');

    // ── Step 5: Update policy (link signatures → rules) ───────────────────────
    console.log('Step 5: Updating policy (linking signatures to rules)...');

    // All 4 rules apply to the same function signature
    const signatures = [selector];
    const functionSigIds = [fsId];
    const rulesDoubleMapping = [ruleIds]; // [[rule0, rule1, rule2, rule3]]

    await sendTx('updatePolicy', [policyId, signatures, functionSigIds, rulesDoubleMapping, 1], RulesEnginePolicyABI, RE_ADDRESS);
    console.log(`  ✓ Policy updated\n`);

    // ── Step 6: Apply policy to GASS contract ─────────────────────────────────
    console.log('Step 6: Applying policy to GASS contract...');
    await sendTx('applyPolicy', [GASS_ADDRESS, [policyId]], RulesEnginePolicyABI, RE_ADDRESS);
    console.log(`  ✓ Policy ${policyId} applied to ${GASS_ADDRESS}\n`);

    // ── Done ──────────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════');
    console.log('  Policy successfully applied!');
    console.log('═══════════════════════════════════════');
    console.log(`\n  Policy ID: ${policyId}`);
    console.log(`  Rules:     ${ruleIds.join(', ')}`);
    console.log(`  Contract:  ${GASS_ADDRESS}`);
    console.log(`\n  SAVE THIS: functionSignatureMappings = ${JSON.stringify([{
        hex: selector,
        functionSignature,
        encodedValues: 'address to, uint256 amount, string githubUsername'
    }])}\n`);
}

main().catch(err => {
    console.error('\n✗ Error:', err.message || err);
    process.exit(1);
});
