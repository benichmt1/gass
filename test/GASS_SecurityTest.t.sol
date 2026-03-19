// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/GASS_Updated.sol";
import "../src/GASSToken.sol";

/**
 * @title GASS Security & Spoofing Pressure Test Suite
 *
 * Attacks covered:
 *  A. setRulesEngineAddress — no access control, attacker can bypass oracle
 *  B. setCallingContractAdmin — no access control, attacker can hijack RE policy admin
 *  C. Zero-address trustedSigner — ecrecover(bad sig) == address(0) → free pass
 *  D. Cross-contract signature replay — no contract address in signed payload
 *  E. Signature malleability — alternate valid (r, n-s, v^1) ECDSA form
 *  F. Future timestamp — underflow behavior in Solidity 0.8+
 *  G. Multi-username drain — same wallet claims for N different usernames
 *  H. Front-running — can a third party submit another user's valid claim?
 *  I. Redirect-to attack — can an attacker steal tokens bound to another address?
 */
contract MaliciousRE {
    // A fake Rules Engine that always passes — no oracle checks
    function checkPolicies(bytes calldata) external pure {}
    function grantCallingContractRole(address, address) external pure returns (bytes32) {
        return bytes32(0);
    }
}

contract GASS_SecurityTest is Test {
    GASS_Updated public gass;

    uint256 constant SIGNER_PK  = 0xA11CE;
    uint256 constant ATTACKER_PK = 0xBAD0;
    address signerAddr;
    address attacker;
    address victim  = address(0xBEEF);
    uint256 amount  = 1 ether;

    // secp256k1 curve order (used for malleability test)
    uint256 constant N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function setUp() public {
        signerAddr = vm.addr(SIGNER_PK);
        attacker   = vm.addr(ATTACKER_PK);
        GASSToken token = new GASSToken();
        gass = new GASS_Updated(signerAddr, address(token));
        // Fund so that any successful processReward calls can transfer tokens
        token.transfer(address(gass), 1_000 ether);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _sign(
        string memory username,
        address to,
        uint256 ts,
        uint256 _amount
    ) internal pure returns (bytes memory) {
        bytes32 msgHash  = keccak256(abi.encodePacked(username, to, ts, _amount));
        bytes32 ethHash  = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // ── A. setRulesEngineAddress — NO ACCESS CONTROL ──────────────────────────
    //
    // FINDING: Any address can call setRulesEngineAddress() and point it at a
    // malicious contract that always approves checkPolicies(). This bypasses the
    // O2 Oracle quality-score gate entirely. A low-quality-score developer who
    // obtains a valid backend signature (by proving GitHub ownership) could route
    // around the on-chain policy enforcement.

    function test_attack_setRulesEngineAddress_noAccessControl() public {
        // FIXED: setRulesEngineAddress now requires owner
        MaliciousRE fakeRE = new MaliciousRE();

        vm.prank(attacker);
        vm.expectRevert("Not owner");
        gass.setRulesEngineAddress(address(fakeRE));
    }

    function test_attack_bypassOracleViaFakeRE() public {
        // FIXED: attacker can no longer swap the RE, so oracle bypass is blocked
        MaliciousRE fakeRE = new MaliciousRE();
        vm.prank(attacker);
        vm.expectRevert("Not owner");
        gass.setRulesEngineAddress(address(fakeRE));

        // RE swap was blocked — processReward still uses the original (zero) RE address,
        // which means no RE call is made (rulesEngineAddress == address(0)).
        uint256 ts  = block.timestamp;
        bytes memory sig = _sign("low-quality-dev", victim, ts, amount);

        vm.prank(victim);
        bool ok = gass.processReward(victim, amount, "low-quality-dev", sig, ts);
        assertTrue(ok, "claim still works with original RE (no RE set in test env)");
    }

    // ── B. setCallingContractAdmin — NO ACCESS CONTROL ───────────────────────
    //
    // FINDING: Any address can call setCallingContractAdmin() to grant themselves
    // (or anyone) the calling-contract-admin role on the live RE Diamond. That
    // role allows modifying or deleting the applied policy (policy ID 4), which
    // would silently remove all oracle-based gating.

    function test_attack_setCallingContractAdmin_noAccessControl() public {
        // FIXED: setCallingContractAdmin now requires owner
        vm.prank(attacker);
        vm.expectRevert("Not owner");
        gass.setCallingContractAdmin(attacker);
    }

    // ── C. Zero-address trustedSigner ─────────────────────────────────────────
    //
    // FINDING: ecrecover() returns address(0) when given a malformed signature.
    // If trustedSigner is set to address(0) (constructor allows it; owner key
    // compromise could do it later), ANY call with a length-65 garbage signature
    // would pass verifySignature() and allow free claiming.

    function test_attack_zeroTrustedSigner_ecrecoverZeroBypass() public {
        // FIXED: constructor now rejects address(0) — this deploy reverts
        // Deploy token first so vm.expectRevert only intercepts the GASS deploy
        address token = address(new GASSToken());
        vm.expectRevert("Zero signer");
        new GASS_Updated(address(0), token);
    }

    function test_mitigation_constructorShouldRejectZeroSigner() public {
        // FIXED: constructor rejects address(0)
        address token = address(new GASSToken());
        vm.expectRevert("Zero signer");
        new GASS_Updated(address(0), token);
    }

    // ── D. Cross-contract signature replay ────────────────────────────────────
    //
    // FINDING: The signed message is keccak256(username ++ to ++ ts ++ amount).
    // It contains NO contract address and NO chain ID. If GASS is deployed at a
    // second address (same chain or another EVM chain), a signature issued for
    // one deployment is valid on the other. For the current single testnet deploy
    // this is low-risk, but it becomes critical on mainnet or multi-chain.

    function test_attack_crossContractReplay() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _sign("cross-replay-user", victim, ts, amount);

        // Deploy a second GASS with the SAME trustedSigner (and fund it)
        GASSToken token2 = new GASSToken();
        GASS_Updated gass2 = new GASS_Updated(signerAddr, address(token2));
        token2.transfer(address(gass2), 1_000 ether);

        // Signature issued for gass is valid on gass2 — no contract address binding
        vm.prank(victim);
        bool ok = gass2.processReward(victim, amount, "cross-replay-user", sig, ts);
        assertTrue(ok, "VULN: signature valid on any contract sharing the same trustedSigner");
    }

    // ── E. ECDSA Signature Malleability ───────────────────────────────────────
    //
    // For any valid (r, s, v) ECDSA signature there exists an alternate valid
    // form: (r, N-s, v^1). Both recover to the same address. Impact here is LOW
    // because double-claim protection prevents a second use, but an observer of
    // a pending tx could submit the malleable form first (frontrunning).
    // Mitigation: check s <= N/2 (as OpenZeppelin ECDSA does).

    function test_signatureMalleability_alternateSigValidates() public {
        uint256 ts = block.timestamp;
        bytes32 msgHash = keccak256(abi.encodePacked("alice", victim, ts, amount));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, ethHash);

        // Produce the malleable (high-s) form
        bytes32 sHigh = bytes32(N - uint256(s));
        uint8   vAlt  = v == 27 ? 28 : 27;
        bytes memory mallSig = abi.encodePacked(r, sHigh, vAlt);

        // Both forms recover to the same signer
        vm.prank(victim);
        bool ok = gass.processReward(victim, amount, "alice", mallSig, ts);
        assertTrue(ok, "malleable signature is accepted (low impact but worth noting)");
    }

    // ── F. Future timestamp → underflow revert ────────────────────────────────
    //
    // block.timestamp - verificationTimestamp reverts (not wraps) in 0.8+ if
    // verificationTimestamp > block.timestamp. The backend clock being ahead by
    // even 1 second would cause legitimate claims to fail unexpectedly.

    function test_futureTimestamp_reverts() public {
        uint256 futureTs = block.timestamp + 1;
        bytes memory sig = _sign("alice", victim, futureTs, amount);

        vm.prank(victim);
        // Solidity 0.8 arithmetic overflow → revert (Panic 0x11)
        vm.expectRevert();
        gass.processReward(victim, amount, "alice", sig, futureTs);
    }

    // ── G. Multi-username drain — same wallet, different usernames ─────────────
    //
    // EXPECTED BEHAVIOR: the double-claim guard is per-username, not per-address.
    // One wallet CAN successfully claim for multiple GitHub usernames as long as
    // the backend signed each one. For a demo this is probably fine, but on mainnet
    // it means a developer with multiple GitHub accounts can multiply their reward.

    function test_sameAddressMultipleUsernames_succeeds() public {
        uint256 ts = block.timestamp;

        bytes memory sig1 = _sign("alice", victim, ts, amount);
        bytes memory sig2 = _sign("bob",   victim, ts, amount);

        vm.prank(victim);
        gass.processReward(victim, amount, "alice", sig1, ts);

        vm.prank(victim);
        bool ok = gass.processReward(victim, amount, "bob", sig2, ts);
        assertTrue(ok, "same address can claim for multiple usernames");
    }

    // ── H. Front-running — third party submits another user's valid tx ─────────
    //
    // EXPECTED BEHAVIOR: Safe. The signature binds `to`, so the tokens still go
    // to the intended recipient even if a front-runner submits the tx.

    function test_frontrun_tokensStillGoToIntendedRecipient() public {
        uint256 ts  = block.timestamp;
        bytes memory sig = _sign("alice", victim, ts, amount);

        // Attacker front-runs with victim's exact parameters
        vm.prank(attacker);
        bool ok = gass.processReward(victim, amount, "alice", sig, ts);
        assertTrue(ok);

        // Tokens went to `victim` (the `to` in the signature), not to attacker
        assertTrue(gass.hasDistributionBeenProcessed("alice"));
    }

    // ── I. Redirect-to attack — attacker tries to steal a signed claim ─────────
    //
    // EXPECTED BEHAVIOR: Safe. The signature binds `to`. Attacker cannot swap in
    // their own address without an invalid signature.

    function test_redirectTo_attackerCannotStealTokens() public {
        uint256 ts  = block.timestamp;
        // Backend signed for victim's address
        bytes memory sig = _sign("alice", victim, ts, amount);

        // Attacker tries to claim for themselves using victim's signature
        vm.prank(attacker);
        vm.expectRevert("Invalid signature from Trusted Signer");
        gass.processReward(attacker, amount, "alice", sig, ts);
    }

    // ── I2. Username swap attack ───────────────────────────────────────────────
    //
    // EXPECTED BEHAVIOR: Safe. Attacker cannot swap username while keeping
    // a valid signature (different username → different hash).

    function test_usernameSwap_invalidatesSignature() public {
        uint256 ts  = block.timestamp;
        bytes memory sig = _sign("alice", victim, ts, amount);

        vm.prank(victim);
        vm.expectRevert("Invalid signature from Trusted Signer");
        gass.processReward(victim, amount, "mallory", sig, ts);
    }
}
