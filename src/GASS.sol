// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import "src/RulesEngineIntegration.sol";

/**
 * @title GASS - Github Activity Scoring System
 * @dev A token distribution system that uses the Forte Rules Engine to allocate rewards
 * based on developer activity metrics from the O2 Oracle. This can be used for airdrops
 * and other token distribution mechanisms that reward active contributors.
 */
contract GASS is RulesEngineClientCustom {
    // Events for different distribution tiers
    event TokensDistributed(address to, uint256 amount, string githubUsername);
    event LimitedDistribution(address to, uint256 amount, string githubUsername, uint256 lastUpdated);
    event StandardDistribution(address to, uint256 amount, string githubUsername);
    event BonusDistribution(address to, uint256 amount, string githubUsername);

    // O2 Oracle address
    address public constant O2_ORACLE_ADDRESS = 0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2;

    // Mapping to track processed distributions
    mapping(string => bool) public hasReceivedDistribution;

    /**
     * @dev Distribute tokens to a developer based on their activity metrics
     * This function is modified by the Rules Engine to check metrics in the O2 Oracle
     * and apply different distribution tiers based on the policy conditions
     *
     * @param to The address to receive the tokens
     * @param amount The base token amount (may be modified by policy)
     * @param githubUsername The GitHub username to look up in the O2 Oracle
     * @return success Whether the distribution was processed successfully
     */
    function processReward(address to, uint256 amount, string calldata githubUsername)
        external
        checkRulesBeforeprocessReward(to, amount, githubUsername)
        returns (bool success)
    {
        // Prevent double distributions
        require(!hasReceivedDistribution[githubUsername], "Already distributed tokens to this developer");

        // Mark as processed
        hasReceivedDistribution[githubUsername] = true;

        // Emit event to show successful distribution
        emit TokensDistributed(to, amount, githubUsername);

        return true;
    }

    /**
     * @dev Check if a developer has already received their token distribution
     * @param githubUsername The GitHub username to check
     * @return distributed Whether tokens have been distributed
     */
    function hasDistributionBeenProcessed(string calldata githubUsername)
        external
        view
        returns (bool distributed)
    {
        return hasReceivedDistribution[githubUsername];
    }
}
