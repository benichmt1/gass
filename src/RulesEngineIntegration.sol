// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@thrackle-io/forte-rules-engine/src/client/RulesEngineClient.sol";

/**
 * @title RulesEngineIntegration
 * @dev This file is used to integrate with the Forte Rules Engine.
 *      It defines an abstract contract that extends the `RulesEngineClient` contract, providing a placeholder
 *      for modifiers that are generated and injected programmatically.
 */
abstract contract RulesEngineClientCustom is RulesEngineClient {
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
