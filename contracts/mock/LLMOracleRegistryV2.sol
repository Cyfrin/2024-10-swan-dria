// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {LLMOracleRegistry} from "../llm/LLMOracleRegistry.sol";

contract LLMOracleRegistryV2 is LLMOracleRegistry {
    function upgraded() public view virtual returns (bool) {
        return true;
    }
}
