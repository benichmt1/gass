// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import "src/RulesEngineIntegration.sol";

/**
 * @title FinalO2Contract
 * @dev A contract that uses the Forte Rules Engine to check if a row exists in the O2 Oracle
 * using the correct foreign call syntax
 */
contract FinalO2Contract is RulesEngineClientCustom {
    // Events for demonstration and tracking
    event RewardProcessed(address to, uint256 value, string rowId);
    event LimitedReward(address to, uint256 value, string rowId, uint256 lastUpdated);

    // O2 Oracle address
    address public constant O2_ORACLE_ADDRESS = 0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2;

    // Mapping to track processed rewards
    mapping(string => bool) public hasProcessedReward;

    /**
     * @dev Process a reward for a developer
     * This function will be modified by the Rules Engine to check if the row exists in the O2 Oracle
     * using the correct foreign call syntax
     */
    function processReward(address to, uint256 value, string calldata rowId)
        external
        checkRulesBeforeprocessReward(to, value, rowId)
        returns (bool)
    {
        // Prevent double processing
        require(!hasProcessedReward[rowId], "Reward already processed for this developer");

        // Mark as processed
        hasProcessedReward[rowId] = true;

        // Emit event to show successful processing
        emit RewardProcessed(to, value, rowId);

        return true;
    }

    /**
     * @dev Check if a developer's reward has already been processed
     */
    function hasProcessedRewardForDeveloper(string calldata rowId) external view returns (bool) {
        return hasProcessedReward[rowId];
    }
}
