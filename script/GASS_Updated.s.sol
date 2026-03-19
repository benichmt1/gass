// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {GASS_Updated} from "../src/GASS_Updated.sol";

contract GASS_UpdatedScript is Script {
    GASS_Updated public gassContract;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Get trusted signer from env
        address trustedSigner = vm.envAddress("ADMIN_PUBLIC_KEY");
        console.log("Deploying with trusted signer:", trustedSigner);

        // Deploy the updated contract
        gassContract = new GASS_Updated(trustedSigner);

        // Log the contract address
        console.log("GASS_Updated (Github Activity Scoring System with Verification) deployed at:", address(gassContract));

        // Set the Rules Engine address
        gassContract.setRulesEngineAddress(0x6189A916E3f190Bf3cE6247b7A0dE862d1De8387);
        console.log("Rules Engine address set to:", gassContract.rulesEngineAddress());

        vm.stopBroadcast();
    }
}
