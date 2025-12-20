// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import "src/RulesEngineIntegration.sol";

/**
 * @title GASS - Github Activity Scoring System
 * @dev A token distribution system that uses the Forte Rules Engine to allocate rewards
 * based on developer activity metrics from the O2 Oracle. This can be used for airdrops
 * and other token distribution mechanisms that reward active contributors.
 *
 * This updated version includes signature verification to ensure only the actual
 * owner of a GitHub account can claim rewards.
 */
contract GASS_Updated is RulesEngineClientCustom {
    // Events for different distribution tiers
    event TokensDistributed(address to, uint256 amount, string githubUsername);
    event LimitedDistribution(address to, uint256 amount, string githubUsername, uint256 lastUpdated);
    event StandardDistribution(address to, uint256 amount, string githubUsername);
    event BonusDistribution(address to, uint256 amount, string githubUsername);

    // O2 Oracle address
    address public constant O2_ORACLE_ADDRESS = 0x5441D1C780E82959d48dcE6af9E36Dbe8f1992B2;

    // Mapping to track processed distributions
    mapping(string => bool) public hasReceivedDistribution;

    // Maximum age of verification proof in seconds (1 hour)
    uint256 public constant MAX_PROOF_AGE = 3600;

    /**
     * @dev Distribute tokens to a developer based on their activity metrics
     * This function is modified by the Rules Engine to check metrics in the O2 Oracle
     * and apply different distribution tiers based on the policy conditions.
     * It also verifies that the caller owns the GitHub account by checking a signature.
     *
     * @param to The address to receive the tokens
     * @param amount The base token amount (may be modified by policy)
     * @param githubUsername The GitHub username to look up in the O2 Oracle
     * @param verificationProof Signature proving ownership of both GitHub account and wallet
     * @param verificationTimestamp Timestamp when the verification proof was created
     * @return success Whether the distribution was processed successfully
     */
    function processReward(
        address to,
        uint256 amount,
        string calldata githubUsername,
        string calldata verificationProof,
        uint256 verificationTimestamp
    )
        external
        checkRulesBeforeprocessReward(to, amount, githubUsername)
        returns (bool success)
    {
        // Prevent double distributions
        require(!hasReceivedDistribution[githubUsername], "Already distributed tokens to this developer");

        // Verify the proof is recent
        require(block.timestamp - verificationTimestamp <= MAX_PROOF_AGE, "Verification proof has expired");

        // Verify the signature
        require(
            verifySignature(
                constructMessage(githubUsername, to, verificationTimestamp),
                verificationProof,
                to
            ),
            "Invalid verification proof"
        );

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
     * @dev Construct the message that should have been signed
     * @param githubUsername The GitHub username
     * @param walletAddress The wallet address claiming the reward
     * @param timestamp The timestamp when the proof was created
     * @return The message string
     */
    function constructMessage(
        string calldata githubUsername,
        address walletAddress,
        uint256 timestamp
    )
        internal
        pure
        returns (string memory)
    {
        return string(
            abi.encodePacked(
                "I confirm that I am the GitHub user \"",
                githubUsername,
                "\" and the owner of wallet ",
                addressToString(walletAddress),
                ". Timestamp: ",
                uint256ToString(timestamp)
            )
        );
    }

    /**
     * @dev Verify a signature to ensure it was signed by the expected address
     * @param message The message that was signed
     * @param signature The signature in hex string format
     * @param expectedSigner The address that should have signed the message
     * @return isValid Whether the signature is valid
     */
    function verifySignature(
        string memory message,
        string memory signature,
        address expectedSigner
    )
        internal
        pure
        returns (bool isValid)
    {
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", uint256ToString(bytes(message).length), message));
        bytes memory signatureBytes = hexStringToBytes(signature);

        require(signatureBytes.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signatureBytes, 32))
            s := mload(add(signatureBytes, 64))
            v := byte(0, mload(add(signatureBytes, 96)))
        }

        // Adjust v if needed (some wallets use 0/1 instead of 27/28)
        if (v < 27) {
            v += 27;
        }

        // Recover the signer address
        address recoveredAddress = ecrecover(messageHash, v, r, s);

        return recoveredAddress == expectedSigner;
    }

    /**
     * @dev Convert an address to a string
     * @param addr The address to convert
     * @return The address as a string
     */
    function addressToString(address addr) internal pure returns (string memory) {
        bytes memory addressBytes = abi.encodePacked(addr);
        bytes memory stringBytes = new bytes(42);

        stringBytes[0] = '0';
        stringBytes[1] = 'x';

        for (uint256 i = 0; i < 20; i++) {
            uint8 leftNibble = uint8(addressBytes[i]) >> 4;
            uint8 rightNibble = uint8(addressBytes[i]) & 0xf;

            stringBytes[2 + i * 2] = leftNibble < 10 ?
                bytes1(uint8(leftNibble + 48)) : bytes1(uint8(leftNibble + 87));
            stringBytes[2 + i * 2 + 1] = rightNibble < 10 ?
                bytes1(uint8(rightNibble + 48)) : bytes1(uint8(rightNibble + 87));
        }

        return string(stringBytes);
    }

    /**
     * @dev Convert a uint256 to a string
     * @param value The uint256 to convert
     * @return The uint256 as a string
     */
    function uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }

    /**
     * @dev Convert a hex string to bytes
     * @param hexString The hex string to convert
     * @return The bytes representation
     */
    function hexStringToBytes(string memory hexString) internal pure returns (bytes memory) {
        bytes memory hexStringBytes = bytes(hexString);

        // Remove '0x' prefix if present
        uint256 startIndex = 0;
        if (hexStringBytes.length >= 2 && hexStringBytes[0] == '0' && (hexStringBytes[1] == 'x' || hexStringBytes[1] == 'X')) {
            startIndex = 2;
        }

        require((hexStringBytes.length - startIndex) % 2 == 0, "Hex string must have an even length");

        bytes memory result = new bytes((hexStringBytes.length - startIndex) / 2);

        for (uint256 i = 0; i < result.length; i++) {
            uint8 highNibble = hexCharToNibble(hexStringBytes[startIndex + i * 2]);
            uint8 lowNibble = hexCharToNibble(hexStringBytes[startIndex + i * 2 + 1]);
            result[i] = bytes1((highNibble << 4) | lowNibble);
        }

        return result;
    }

    /**
     * @dev Convert a hex character to its nibble value
     * @param c The hex character
     * @return The nibble value (0-15)
     */
    function hexCharToNibble(bytes1 c) internal pure returns (uint8) {
        if (c >= 0x30 && c <= 0x39) {
            return uint8(c) - 0x30; // '0' to '9'
        }
        if (c >= 0x61 && c <= 0x66) {
            return uint8(c) - 0x61 + 10; // 'a' to 'f'
        }
        if (c >= 0x41 && c <= 0x46) {
            return uint8(c) - 0x41 + 10; // 'A' to 'F'
        }
        revert("Invalid hex character");
    }
}
