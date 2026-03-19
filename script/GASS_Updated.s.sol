// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {GASS_Updated} from "../src/GASS_Updated.sol";
import {GASSToken} from "../src/GASSToken.sol";

contract GASS_UpdatedScript is Script {
    function setUp() public {}

    function run() public {
        address trustedSigner = vm.envAddress("ADMIN_PUBLIC_KEY");
        vm.startBroadcast();

        // 1. Deploy the GASS ERC-20 token
        GASSToken token = new GASSToken();
        console.log("GASSToken deployed at:", address(token));

        // 2. Deploy the GASS rewards contract
        GASS_Updated gass = new GASS_Updated(trustedSigner, address(token));
        console.log("GASS_Updated deployed at:", address(gass));
        console.log("trustedSigner:", gass.trustedSigner());

        // 3. Wire up the Rules Engine
        gass.setRulesEngineAddress(0x6189A916E3f190Bf3cE6247b7A0dE862d1De8387);
        console.log("Rules Engine:", gass.rulesEngineAddress());

        // 4. Fund the GASS contract with 10,000 GASS tokens for rewards
        uint256 rewardPool = 10_000 * 10 ** 18;
        token.transfer(address(gass), rewardPool);
        console.log("Funded GASS contract with 10,000 GASS");
        console.log("GASS contract token balance:", gass.tokenBalance());

        vm.stopBroadcast();
    }
}
