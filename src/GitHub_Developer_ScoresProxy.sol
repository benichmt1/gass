// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title GitHub_Developer_ScoresProxy
 * @dev Custom proxy implementation that ensures the owner gets DEFAULT_ADMIN_ROLE
 * during initialization. This design ensures initialization data is properly passed
 * to the implementation contract without inheritance conflicts.
 */
contract GitHub_Developer_ScoresProxy is ERC1967Proxy {
    constructor(address implementation, address admin, address operator, address feeCollector) ERC1967Proxy(
        implementation,
        // This encodes the initialize function call so the implementation contract gives
        // the admin the DEFAULT_ADMIN_ROLE when the proxy is deployed
        abi.encodeWithSignature(
            "initialize(address,address,address)",
            admin,
            operator,
            feeCollector
        )
    ) {}

    /**
     * @dev Delegates the current call to the implementation contract
     */
    function _fallback() internal virtual override {
        super._fallback();
    }
}
