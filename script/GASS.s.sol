// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {GASS} from "../src/GASS.sol";

contract GASSScript is Script {
    GASS public gassContract;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy the contract
        gassContract = new GASS();

        // Log the contract address
        console.log("GASS (Github Activity Scoring System) deployed at:", address(gassContract));

        // Set the Rules Engine address
        gassContract.setRulesEngineAddress(0x4E448907B4B8d5949D4A6C67f34419dBb29690bD);
        console.log("Rules Engine address set to:", gassContract.rulesEngineAddress());

        vm.stopBroadcast();
    }
}
