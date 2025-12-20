// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {FinalO2Contract} from "../src/FinalO2Contract.sol";

contract FinalO2Script is Script {
    FinalO2Contract public finalO2Contract;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        // Deploy the contract
        finalO2Contract = new FinalO2Contract();
        
        // Log the contract address
        console.log("FinalO2Contract deployed at:", address(finalO2Contract));
        
        // Set the Rules Engine address
        finalO2Contract.setRulesEngineAddress(0x4E448907B4B8d5949D4A6C67f34419dBb29690bD);
        console.log("Rules Engine address set to:", finalO2Contract.rulesEngineAddress());
        
        vm.stopBroadcast();
    }
}
