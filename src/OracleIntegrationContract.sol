// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;
import "src/RulesEngineIntegration.sol";

/**
 * @title OracleIntegrationContract
 * @dev A contract that integrates with the Forte Rules Engine and O2 Oracle
 */
contract OracleIntegrationContract is RulesEngineClientCustom {
    // Events for demonstration
    event TransferWithRowId(address to, uint256 value, string rowId);
    
    /**
     * @dev This function will be modified by the Rules Engine to check the quality score
     * The Rules Engine will call the O2 Oracle and use the result in its policy condition
     */
    function transferWithRowId(address to, uint256 value, string calldata rowId) external checkRulesBeforetransferWithRowId(to, value, rowId) returns (bool) {
        // Emit event to show we're checking this row
        emit TransferWithRowId(to, value, rowId);
        
        return true;
    }
}
