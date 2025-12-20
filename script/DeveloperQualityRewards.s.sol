// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {DeveloperQualityRewards} from "../src/DeveloperQualityRewards.sol";

contract DeveloperQualityRewardsScript is Script {
    DeveloperQualityRewards public rewardsContract;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy the contract
        rewardsContract = new DeveloperQualityRewards();
        
        // Log the contract address
        console.log("DeveloperQualityRewards deployed at:", address(rewardsContract));
        
        // Set the Rules Engine address
        rewardsContract.setRulesEngineAddress(0x4E448907B4B8d5949D4A6C67f34419dBb29690bD);
        console.log("Rules Engine address set to:", rewardsContract.rulesEngineAddress());
        
        vm.stopBroadcast();
    }
}
