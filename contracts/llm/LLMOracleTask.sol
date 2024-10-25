// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @notice Collection of oracle task-related parameters.
/// @dev Prevents stack-too-deep with tight-packing.
/// TODO: use 256-bit tight-packing here
struct LLMOracleTaskParameters {
    /// @notice Difficulty of the task.
    uint8 difficulty;
    /// @notice Number of generations.
    uint40 numGenerations;
    /// @notice Number of validations.
    uint40 numValidations;
}

/// @title LLM Oracle Task Interface
/// @notice An umbrella interface that captures task-related structs and enums.
interface LLMOracleTask {
    /// @notice Task status.
    /// @dev `None`: Task has not been created yet. (default)
    /// @dev `PendingGeneration`: Task is waiting for Oracle generation responses.
    /// @dev `PendingValidation`: Task is waiting for validation by validator Oracles.
    /// @dev `Completed`: The task has been completed.
    /// @dev With validation, the flow is `None -> PendingGeneration -> PendingValidation -> Completed`.
    /// @dev Without validation, the flow is `None -> PendingGeneration -> Completed`.
    enum TaskStatus {
        None,
        PendingGeneration,
        PendingValidation,
        Completed
    }

    /// @notice A task request for LLM generation.
    /// @dev Fees are stored here as well in case fee changes occur within the duration of a task.
    struct TaskRequest {
        /// @dev Requesting address, also responsible of the fee payment.
        address requester;
        /// @dev Protocol string, such as `dria/0.1.0`.
        bytes32 protocol;
        /// @dev Task parameters, e.g. difficulty and number of generations & validations.
        LLMOracleTaskParameters parameters;
        /// @dev Task status.
        TaskStatus status;
        /// @dev Fee paid to each generator per generation.
        uint256 generatorFee;
        /// @dev Fee paid to each validator per validated generation.
        uint256 validatorFee;
        /// @dev Fee paid to the platform
        uint256 platformFee;
        /// @dev Input data for the task, usually a human-readable string.
        bytes input;
        /// @dev Allowed model names for the task.
        bytes models;
    }

    /// @notice A task response to an LLM generation request.
    struct TaskResponse {
        /// @dev Responding Oracle address.
        address responder;
        /// @dev Proof-of-Work nonce for SHA3(taskId, input, requester, responder, nonce) < difficulty.
        uint256 nonce;
        /// @dev Final validation score assigned by validators, stays 0 if there is no validation.
        uint256 score;
        /// @dev Output data for the task, usually the direct output of LLM.
        bytes output;
        /// @dev Optional metadata for this generation.
        bytes metadata;
    }

    /// @notice A task validation for a response.
    struct TaskValidation {
        /// @dev Responding validator address.
        address validator;
        /// @dev Proof-of-Work nonce for SHA3(taskId, input, requester, responder, nonce) < difficulty.
        uint256 nonce;
        /// @dev Validation scores
        uint256[] scores;
        /// @dev Optional metadata for this validation.
        bytes metadata;
    }
}
