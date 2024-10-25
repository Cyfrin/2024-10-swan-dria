# Solidity API

## LLMOracleTaskParameters

Collection of oracle task-related parameters.

_Prevents stack-too-deep with tight-packing.
TODO: use 256-bit tight-packing here_

```solidity
struct LLMOracleTaskParameters {
  uint8 difficulty;
  uint40 numGenerations;
  uint40 numValidations;
}
```

## LLMOracleTask

An umbrella interface that captures task-related structs and enums.

### TaskStatus

Task status.

_`None`: Task has not been created yet. (default)
`PendingGeneration`: Task is waiting for Oracle generation responses.
`PendingValidation`: Task is waiting for validation by validator Oracles.
`Completed`: The task has been completed.
With validation, the flow is `None -> PendingGeneration -> PendingValidation -> Completed`.
Without validation, the flow is `None -> PendingGeneration -> Completed`._

```solidity
enum TaskStatus {
  None,
  PendingGeneration,
  PendingValidation,
  Completed
}
```

### TaskRequest

A task request for LLM generation.

_Fees are stored here as well in case fee changes occur within the duration of a task._

```solidity
struct TaskRequest {
  address requester;
  bytes32 protocol;
  struct LLMOracleTaskParameters parameters;
  enum LLMOracleTask.TaskStatus status;
  uint256 generatorFee;
  uint256 validatorFee;
  uint256 platformFee;
  bytes input;
  bytes models;
}
```

### TaskResponse

A task response to an LLM generation request.

```solidity
struct TaskResponse {
  address responder;
  uint256 nonce;
  uint256 score;
  bytes output;
  bytes metadata;
}
```

### TaskValidation

A task validation for a response.

```solidity
struct TaskValidation {
  address validator;
  uint256 nonce;
  uint256[] scores;
  bytes metadata;
}
```

