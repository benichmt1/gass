// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {GASS_Updated} from "../src/GASS_Updated.sol";

contract GASS_UpdatedScript is Script {
    GASS_Updated public gassContract;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy the updated contract
        gassContract = new GASS_Updated();

        // Log the contract address
        console.log("GASS_Updated (Github Activity Scoring System with Verification) deployed at:", address(gassContract));

        // Set the Rules Engine address
        gassContract.setRulesEngineAddress(0x4E448907B4B8d5949D4A6C67f34419dBb29690bD);
        console.log("Rules Engine address set to:", gassContract.rulesEngineAddress());

        vm.stopBroadcast();
    }
}
