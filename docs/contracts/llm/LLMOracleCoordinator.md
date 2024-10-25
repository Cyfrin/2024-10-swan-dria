# Solidity API

## LLMOracleCoordinator

Responsible for coordinating the Oracle responses to LLM generation requests.

### Request

```solidity
event Request(uint256 taskId, address requester, bytes32 protocol)
```

Indicates a generation request for LLM.

_`protocol` is a short 32-byte string (e.g., "dria/1.0.0").
Using the protocol topic, listeners can filter by protocol._

### Response

```solidity
event Response(uint256 taskId, address responder)
```

Indicates a single Oracle response for a request.

### Validation

```solidity
event Validation(uint256 taskId, address validator)
```

Indicates a single Oracle response for a request.

### StatusUpdate

```solidity
event StatusUpdate(uint256 taskId, bytes32 protocol, enum LLMOracleTask.TaskStatus statusBefore, enum LLMOracleTask.TaskStatus statusAfter)
```

Indicates the status change of an LLM generation request.

### InsufficientFees

```solidity
error InsufficientFees(uint256 have, uint256 want)
```

Not enough funds were provided for the task.

### InvalidTaskStatus

```solidity
error InvalidTaskStatus(uint256 taskId, enum LLMOracleTask.TaskStatus have, enum LLMOracleTask.TaskStatus want)
```

Unexpected status for this task.

### InvalidNonce

```solidity
error InvalidNonce(uint256 taskId, uint256 nonce)
```

The given nonce is not a valid proof-of-work.

### InvalidValidation

```solidity
error InvalidValidation(uint256 taskId, address validator)
```

The provided validation does not have a score for all responses.

### NotRegistered

```solidity
error NotRegistered(address oracle)
```

The oracle is not registered.

### AlreadyResponded

```solidity
error AlreadyResponded(uint256 taskId, address oracle)
```

The oracle has already responded to this task.

### registry

```solidity
contract LLMOracleRegistry registry
```

The Oracle Registry.

### feeToken

```solidity
contract ERC20 feeToken
```

The token to be used for fee payments.

### nextTaskId

```solidity
uint256 nextTaskId
```

The task ID counter.

_TaskId starts from 1, as 0 is reserved.
0 can be used in to check that a request/response/validation has not been made._

### requests

```solidity
mapping(uint256 => struct LLMOracleTask.TaskRequest) requests
```

LLM generation requests.

### responses

```solidity
mapping(uint256 => struct LLMOracleTask.TaskResponse[]) responses
```

LLM generation responses.

### validations

```solidity
mapping(uint256 => struct LLMOracleTask.TaskValidation[]) validations
```

LLM generation response validations.

### onlyRegistered

```solidity
modifier onlyRegistered(enum LLMOracleKind kind)
```

Reverts if `msg.sender` is not a registered oracle.

### onlyAtStatus

```solidity
modifier onlyAtStatus(uint256 taskId, enum LLMOracleTask.TaskStatus status)
```

Reverts if the task status is not `status`.

### constructor

```solidity
constructor() public
```

Locks the contract, preventing any future re-initialization.

_[See more](https://docs.openzeppelin.com/contracts/5.x/api/proxy#Initializable-_disableInitializers--)._

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

Function that should revert when `msg.sender` is not authorized to upgrade the contract.

_Called by and upgradeToAndCall._

### initialize

```solidity
function initialize(address _oracleRegistry, address _feeToken, uint256 _platformFee, uint256 _generationFee, uint256 _validationFee) public
```

Initialize the contract.
Sets the Oracle Registry & Oracle Fee Manager.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oracleRegistry | address | The Oracle Registry contract address. |
| _feeToken | address | The token (ERC20) to be used for fee payments (usually $BATCH). |
| _platformFee | uint256 | The initial platform fee for each LLM generation. |
| _generationFee | uint256 | The initial base fee for LLM generation. |
| _validationFee | uint256 | The initial base fee for response validation. |

### request

```solidity
function request(bytes32 protocol, bytes input, bytes models, struct LLMOracleTaskParameters parameters) public returns (uint256)
```

Request LLM generation.

_Input must be non-empty.
Reverts if contract has not enough allowance for the fee.
Reverts if difficulty is out of range._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| protocol | bytes32 | The protocol string, should be a short 32-byte string (e.g., "dria/1.0.0"). |
| input | bytes | The input data for the LLM generation. |
| models | bytes |  |
| parameters | struct LLMOracleTaskParameters | The task parameters |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | task id |

### respond

```solidity
function respond(uint256 taskId, uint256 nonce, bytes output, bytes metadata) public
```

Respond to an LLM generation.

_Output must be non-empty.
Reverts if the task is not pending generation.
Reverts if the responder is not registered.
Reverts if the responder has already responded to this task.
Reverts if the nonce is not a valid proof-of-work._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | uint256 | The task ID to respond to. |
| nonce | uint256 | The proof-of-work nonce. |
| output | bytes | The output data for the LLM generation. |
| metadata | bytes | Optional metadata for this output. |

### validate

```solidity
function validate(uint256 taskId, uint256 nonce, uint256[] scores, bytes metadata) public
```

Validate requests for a given taskId.

_Reverts if the task is not pending validation.
Reverts if the number of scores is not equal to the number of generations.
Reverts if any score is greater than the maximum score._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | uint256 | The ID of the task to validate. |
| nonce | uint256 | The proof-of-work nonce. |
| scores | uint256[] | The validation scores for each generation. |
| metadata | bytes | Optional metadata for this validation. |

### assertValidNonce

```solidity
function assertValidNonce(uint256 taskId, struct LLMOracleTask.TaskRequest task, uint256 nonce) internal view
```

Checks that proof-of-work is valid for a given task with taskId and nonce.

_Reverts if the nonce is not a valid proof-of-work._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | uint256 | The ID of the task to check proof-of-work. |
| task | struct LLMOracleTask.TaskRequest | The task (in storage) to validate. |
| nonce | uint256 | The candidate proof-of-work nonce. |

### withdrawPlatformFees

```solidity
function withdrawPlatformFees() public
```

Withdraw the platform fees & along with remaining fees within the contract.

### getResponses

```solidity
function getResponses(uint256 taskId) public view returns (struct LLMOracleTask.TaskResponse[])
```

Returns the responses to a given taskId.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | uint256 | The ID of the task to get responses for. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct LLMOracleTask.TaskResponse[] | The responses for the given taskId. |

### getValidations

```solidity
function getValidations(uint256 taskId) public view returns (struct LLMOracleTask.TaskValidation[])
```

Returns the validations to a given taskId.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | uint256 | The ID of the task to get validations for. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct LLMOracleTask.TaskValidation[] | The validations for the given taskId. |

### _increaseAllowance

```solidity
function _increaseAllowance(address spender, uint256 amount) internal
```

Increases the allowance by setting the approval to the sum of the current allowance and the additional amount.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | spender address |
| amount | uint256 | additional amount of allowance |

### getBestResponse

```solidity
function getBestResponse(uint256 taskId) external view returns (struct LLMOracleTask.TaskResponse)
```

Returns the best performing result of the given task.

_For invalid task IDs, the status check will fail._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | uint256 | The ID of the task to get the result for. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct LLMOracleTask.TaskResponse | The best performing response w.r.t validation scores. |

