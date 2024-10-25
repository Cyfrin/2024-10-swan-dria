// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {DatasetAccessRegistry} from "../core/DatasetAccessRegistry.sol";

contract DatasetAccessRegistryV2 is DatasetAccessRegistry {
    function upgraded() public view virtual returns (bool) {
        return true;
    }
}
