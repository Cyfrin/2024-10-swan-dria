// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {LLMOracleCoordinator} from "../llm/LLMOracleCoordinator.sol";

contract LLMOracleCoordinatorV2 is LLMOracleCoordinator {
    function upgraded() public view virtual returns (bool) {
        return true;
    }
}
