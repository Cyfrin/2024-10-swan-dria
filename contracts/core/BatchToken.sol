// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice BATCH token is the main utility token of Dria L2.
contract BatchToken is ERC20 {
    constructor(address recipient_, uint256 supply_) ERC20("Batch Token", "BATCH") {
        ERC20._mint(recipient_, supply_);
    }
}
