// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import "src/RulesEngineIntegration.sol";

/**
 * @title GASS - Github Activity Scoring System with JWT Verification
 * @dev A token distribution system that uses the Forte Rules Engine to allocate rewards
 * based on developer activity metrics from the O2 Oracle. This version uses a verification
 * token from Dynamic to ensure only the actual owner of a GitHub account can claim rewards.
 */
contract GASS_JWT is RulesEngineClientCustom {
    // Events for different distribution tiers
    event TokensDistributed(address to, uint256 amount, string githubUsername);
    event LimitedDistribution(address to, uint256 amount, string githubUsername, uint256 lastUpdated);
    event StandardDistribution(address to, uint256 amount, string githubUsername);
    event BonusDistribution(address to, uint256 amount, string githubUsername);

    // O2 Oracle address
    address public constant O2_ORACLE_ADDRESS = 0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2;

    // Mapping to track processed distributions
    mapping(string => bool) public hasReceivedDistribution;
    
    // Mapping to track verification tokens
    mapping(string => bool) public usedVerificationTokens;
    
    // Maximum age of verification token in seconds (1 hour)
    uint256 public constant MAX_TOKEN_AGE = 3600;

    /**
     * @dev Distribute tokens to a developer based on their activity metrics
     * This function is modified by the Rules Engine to check metrics in the O2 Oracle
     * and apply different distribution tiers based on the policy conditions.
     * It also verifies that the caller owns the GitHub account using a verification token.
     *
     * @param to The address to receive the tokens
     * @param amount The base token amount (may be modified by policy)
     * @param githubUsername The GitHub username to look up in the O2 Oracle
     * @param verificationToken Token from the backend API verifying GitHub ownership
     * @param verificationTimestamp Timestamp when the verification token was created
     * @return success Whether the distribution was processed successfully
     */
    function processReward(
        address to, 
        uint256 amount, 
        string calldata githubUsername,
        string calldata verificationToken,
        uint256 verificationTimestamp
    )
        external
        checkRulesBeforeprocessReward(to, amount, githubUsername)
        returns (bool success)
    {
        // Prevent double distributions
        require(!hasReceivedDistribution[githubUsername], "Already distributed tokens to this developer");
        
        // Verify the token is recent
        require(block.timestamp - verificationTimestamp <= MAX_TOKEN_AGE, "Verification token has expired");
        
        // Verify the token hasn't been used before
        bytes32 tokenHash = keccak256(abi.encodePacked(verificationToken));
        require(!usedVerificationTokens[bytes32ToString(tokenHash)], "Verification token already used");
        
        // Mark the token as used
        usedVerificationTokens[bytes32ToString(tokenHash)] = true;

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
    
    /**
     * @dev Convert a bytes32 to a string
     * @param value The bytes32 to convert
     * @return The bytes32 as a string
     */
    function bytes32ToString(bytes32 value) internal pure returns (string memory) {
        bytes memory bytesArray = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            bytesArray[i*2] = bytes1(uint8(uint256(value) / (2**(8*(31 - i)))));
            bytesArray[i*2+1] = bytes1(uint8(uint256(value) % 256));
        }
        return string(bytesArray);
    }
}
