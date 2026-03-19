// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./IRulesEngine.sol";

/**
 * @title RulesEngineIntegration
 * @dev Integrates with Forte Rules Engine v0.9.2.
 *      Uses checkPolicies(bytes) — RE looks up msg.sender to find applied policies.
 */
abstract contract RulesEngineClientCustom {
    address public rulesEngineAddress;

    function setRulesEngineAddress(address rulesEngine) public virtual {
        rulesEngineAddress = rulesEngine;
    }

    function setCallingContractAdmin(address callingContractAdmin) external {
        IRulesEngine(rulesEngineAddress).grantCallingContractRole(address(this), callingContractAdmin);
    }

    function _invokeRulesEngine(bytes memory _encoded) internal {
        if (rulesEngineAddress != address(0)) IRulesEngine(rulesEngineAddress).checkPolicies(_encoded);
    }

    modifier checkRulesBeforetransferWithRowId(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _invokeRulesEngine(encoded);
        _;
    }

    modifier checkRulesAftertransferWithRowId(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _;
        _invokeRulesEngine(encoded);
    }

    modifier checkRulesBeforeclaimReward(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _invokeRulesEngine(encoded);
        _;
    }

    modifier checkRulesAfterclaimReward(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _;
        _invokeRulesEngine(encoded);
    }

    modifier checkRulesBeforeprocessReward(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _invokeRulesEngine(encoded);
        _;
    }

    modifier checkRulesAfterprocessReward(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _;
        _invokeRulesEngine(encoded);
    }

    modifier checkRulesBeforegiveReward(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _invokeRulesEngine(encoded);
        _;
    }

    modifier checkRulesAftergiveReward(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _;
        _invokeRulesEngine(encoded);
    }

    modifier checkRulesBeforeprocessRewardIfExists(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _invokeRulesEngine(encoded);
        _;
    }

    modifier checkRulesAfterprocessRewardIfExists(address to, uint256 value, string memory rowId) {
        bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, rowId);
        _;
        _invokeRulesEngine(encoded);
    }
}
