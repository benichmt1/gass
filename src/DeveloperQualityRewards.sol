// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import "src/RulesEngineIntegration.sol";

/**
 * @title DeveloperQualityRewards
 * @dev A contract that uses the Forte Rules Engine to distribute rewards based on developer quality metrics
 * from the O2 Oracle. The rewards are tiered based on quality score, last updated time, and review count.
 */
contract DeveloperQualityRewards is RulesEngineClientCustom {
    // Events for different reward tiers
    event RewardProcessed(address to, uint256 value, string githubUsername);
    event LimitedReward(address to, uint256 value, string githubUsername, uint256 lastUpdated);
    event NormalReward(address to, uint256 value, string githubUsername);
    event DoubleReward(address to, uint256 value, string githubUsername);

    // O2 Oracle address
    address public constant O2_ORACLE_ADDRESS = 0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2;

    // Mapping to track processed rewards
    mapping(string => bool) public hasProcessedReward;

    /**
     * @dev Process a reward for a developer based on their quality metrics
     * This function is modified by the Rules Engine to check quality metrics in the O2 Oracle
     * and apply different reward tiers based on the policy conditions
     * 
     * @param to The address to receive the reward
     * @param value The base reward value (may be modified by policy)
     * @param githubUsername The GitHub username to look up in the O2 Oracle
     * @return success Whether the reward was processed successfully
     */
    function processReward(address to, uint256 value, string calldata githubUsername)
        external
        checkRulesBeforeprocessReward(to, value, githubUsername)
        returns (bool success)
    {
        // Prevent double processing
        require(!hasProcessedReward[githubUsername], "Reward already processed for this developer");

        // Mark as processed
        hasProcessedReward[githubUsername] = true;

        // Emit event to show successful processing
        emit RewardProcessed(to, value, githubUsername);

        return true;
    }

    /**
     * @dev Check if a developer's reward has already been processed
     * @param githubUsername The GitHub username to check
     * @return processed Whether the reward has been processed
     */
    function hasProcessedRewardForDeveloper(string calldata githubUsername) 
        external 
        view 
        returns (bool processed) 
    {
        return hasProcessedReward[githubUsername];
    }
}
