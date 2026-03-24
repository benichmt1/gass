// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import "src/RulesEngineIntegration.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GASS - Github Activity Scoring System (Updated & Secured)
 * @dev A token distribution system that uses the Forte Rules Engine to allocate rewards.
 * 
 * V2 Security Update:
 * - Uses a Trusted Signer pattern (Backend API) to verify GitHub ownership off-chain.
 * - Prevents spoofing by verifying that the 'claim permit' was signed by the Trusted Signer.
 */
contract GASS_Updated is RulesEngineClientCustom {
    // Events for different distribution tiers
    event TokensDistributed(address to, uint256 amount, string githubUsername);
    event LimitedDistribution(address to, uint256 amount, string githubUsername, uint256 lastUpdated);
    event StandardDistribution(address to, uint256 amount, string githubUsername);
    event BonusDistribution(address to, uint256 amount, string githubUsername);

    // O2 Oracle address
    address public constant O2_ORACLE_ADDRESS = 0xa23F689466F1D6f93b0B598aAEf390Db2CA3614F;

    // Owner address (deployer)
    address public owner;

    // Trusted Signer Address (Backend API Key)
    address public trustedSigner;

    // GASS ERC-20 token to distribute
    address public tokenAddress;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _trustedSigner, address _tokenAddress) {
        require(_trustedSigner  != address(0), "Zero signer");
        require(_tokenAddress   != address(0), "Zero token");
        owner        = msg.sender;
        trustedSigner = _trustedSigner;
        tokenAddress  = _tokenAddress;
    }

    function setTokenAddress(address _tokenAddress) external onlyOwner {
        require(_tokenAddress != address(0), "Zero token");
        tokenAddress = _tokenAddress;
    }

    function tokenBalance() external view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    function setRulesEngineAddress(address rulesEngine) public override onlyOwner {
        rulesEngineAddress = rulesEngine;
    }

    function setCallingContractAdmin(address callingContractAdmin) external override onlyOwner {
        IRulesEngine(rulesEngineAddress).grantCallingContractRole(address(this), callingContractAdmin);
    }

    // Mapping to track processed distributions
    mapping(string => bool) public hasReceivedDistribution;

    // Maximum age of verification proof in seconds (1 hour)
    uint256 public constant MAX_PROOF_AGE = 3600;

    /**
     * @dev Distribute tokens to a developer based on their activity metrics
     * 
     * @param to The address to receive the tokens
     * @param amount The token amount (determined by backend, verified by signature)
     * @param githubUsername The GitHub username
     * @param signature Signature from the Trusted Signer approving this claim
     * @param verificationTimestamp Timestamp when the verification proof was created
     */
    function processReward(
        address to,
        uint256 amount,
        string calldata githubUsername,
        bytes calldata signature,
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

        // Verify the signature from the Trusted Signer
        bytes32 messageHash = keccak256(
            abi.encodePacked(githubUsername, to, verificationTimestamp, amount)
        );
        
        require(
            verifySignature(messageHash, signature),
            "Invalid signature from Trusted Signer"
        );

        // Mark as processed
        hasReceivedDistribution[githubUsername] = true;

        // Transfer GASS tokens to the recipient
        require(
            IERC20(tokenAddress).transfer(to, amount),
            "Token transfer failed"
        );

        // Emit event to show successful distribution
        emit TokensDistributed(to, amount, githubUsername);

        return true;
    }

    /**
     * @dev Check if a developer has already received their token distribution
     */
    function hasDistributionBeenProcessed(string calldata githubUsername)
        external
        view
        returns (bool distributed)
    {
        return hasReceivedDistribution[githubUsername];
    }

    /**
     * @dev Set the trusted signer address (Owner only)
     */
    function setTrustedSigner(address _signer) external onlyOwner {
        trustedSigner = _signer;
    }

    /**
     * @dev Verify a signature to ensure it was signed by the Trusted Signer
     */
    function verifySignature(
        bytes32 messageHash,
        bytes memory signature
    )
        internal
        view
        returns (bool isValid)
    {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        return recoverSigner(ethSignedMessageHash, signature) == trustedSigner;
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature)
        internal
        pure
        returns (address)
    {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}

