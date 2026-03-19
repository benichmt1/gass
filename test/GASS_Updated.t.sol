// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/GASS_Updated.sol";

contract GASS_UpdatedTest is Test {
    GASS_Updated public gass;

    uint256 constant SIGNER_PK = 0xA11CE;
    address signerAddr;
    address user = address(0xBEEF);
    uint256 amount = 1 ether;

    function setUp() public {
        signerAddr = vm.addr(SIGNER_PK);
        gass = new GASS_Updated(signerAddr);
    }

    // Helper: produce a valid signature for the given params
    function _sign(
        string memory username,
        address to,
        uint256 timestamp,
        uint256 _amount
    ) internal pure returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(username, to, timestamp, _amount));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // --- Tests ---

    function test_processReward_validSignature() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _sign("alice", user, ts, amount);

        vm.prank(user);
        bool success = gass.processReward(user, amount, "alice", sig, ts);
        assertTrue(success);
    }

    function test_processReward_emitsTokensDistributed() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _sign("alice", user, ts, amount);

        vm.expectEmit(true, true, false, true);
        emit GASS_Updated.TokensDistributed(user, amount, "alice");

        vm.prank(user);
        gass.processReward(user, amount, "alice", sig, ts);
    }

    function test_processReward_invalidSignature_reverts() public {
        uint256 ts = block.timestamp;
        // Sign with a different key
        uint256 badPk = 0xBAD;
        bytes32 msgHash = keccak256(abi.encodePacked("alice", user, ts, amount));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badPk, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(user);
        vm.expectRevert("Invalid signature from Trusted Signer");
        gass.processReward(user, amount, "alice", badSig, ts);
    }

    function test_processReward_expiredTimestamp_reverts() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _sign("alice", user, ts, amount);

        // Warp past MAX_PROOF_AGE (3600 seconds)
        vm.warp(block.timestamp + 3601);

        vm.prank(user);
        vm.expectRevert("Verification proof has expired");
        gass.processReward(user, amount, "alice", sig, ts);
    }

    function test_processReward_doubleClaim_reverts() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _sign("alice", user, ts, amount);

        vm.prank(user);
        gass.processReward(user, amount, "alice", sig, ts);

        // Second claim for the same username should revert
        vm.prank(user);
        vm.expectRevert("Already distributed tokens to this developer");
        gass.processReward(user, amount, "alice", sig, ts);
    }

    function test_processReward_wrongAmount_reverts() public {
        uint256 ts = block.timestamp;
        // Sign for 1 ETH but submit 2 ETH
        bytes memory sig = _sign("alice", user, ts, 1 ether);

        vm.prank(user);
        vm.expectRevert("Invalid signature from Trusted Signer");
        gass.processReward(user, 2 ether, "alice", sig, ts);
    }

    function test_hasDistributionBeenProcessed_beforeClaim() public view {
        assertFalse(gass.hasDistributionBeenProcessed("alice"));
    }

    function test_hasDistributionBeenProcessed_afterClaim() public {
        uint256 ts = block.timestamp;
        bytes memory sig = _sign("alice", user, ts, amount);

        vm.prank(user);
        gass.processReward(user, amount, "alice", sig, ts);

        assertTrue(gass.hasDistributionBeenProcessed("alice"));
    }

    function test_setTrustedSigner_onlyOwner() public {
        address newSigner = address(0x1234);

        // Owner (this contract's deployer = address(this)) can change signer
        gass.setTrustedSigner(newSigner);
        assertEq(gass.trustedSigner(), newSigner);
    }

    function test_setTrustedSigner_nonOwner_reverts() public {
        address attacker = address(0xDEAD);
        vm.prank(attacker);
        vm.expectRevert("Not owner");
        gass.setTrustedSigner(attacker);
    }

    function test_owner_isDeployer() public view {
        assertEq(gass.owner(), address(this));
    }
}
