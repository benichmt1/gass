// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {OracleIntegrationContract} from "../src/OracleIntegrationContract.sol";

contract OracleIntegrationScript is Script {
    OracleIntegrationContract public example;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy the contract
        example = new OracleIntegrationContract();
        
        vm.stopBroadcast();
    }
}
