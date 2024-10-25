# Solidity API

## BuyerAgentFactory

Factory contract to deploy BuyerAgent contracts.

_This saves from contract space for Swan._

### deploy

```solidity
function deploy(string _name, string _description, uint96 _royaltyFee, uint256 _amountPerRound, address _owner) external returns (contract BuyerAgent)
```

## BuyerAgent

BuyerAgent is responsible for buying the assets from Swan.

### MinFundSubceeded

```solidity
error MinFundSubceeded(uint256 value)
```

The `value` is less than `minFundAmount`

### InvalidFee

```solidity
error InvalidFee(uint256 fee)
```

Given fee is invalid, e.g. not within the range.

### BuyLimitExceeded

```solidity
error BuyLimitExceeded(uint256 have, uint256 want)
```

Asset count limit exceeded for this round

### InvalidPhase

```solidity
error InvalidPhase(enum BuyerAgent.Phase have, enum BuyerAgent.Phase want)
```

Invalid phase

### Unauthorized

```solidity
error Unauthorized(address caller)
```

Unauthorized caller.

### TaskNotRequested

```solidity
error TaskNotRequested()
```

No task request has been made yet.

### TaskAlreadyProcessed

```solidity
error TaskAlreadyProcessed()
```

The task was already processed, via `purchase` or `updateState`.

### Phase

Phase of the purchase loop.

```solidity
enum Phase {
  Sell,
  Buy,
  Withdraw
}
```

### swan

```solidity
contract Swan swan
```

Swan contract.

### createdAt

```solidity
uint256 createdAt
```

Timestamp when the contract is deployed.

### marketParameterIdx

```solidity
uint256 marketParameterIdx
```

Holds the index of the Swan market parameters at the time of deployment.

_When calculating the round, we will use this index to determine the start interval._

### name

```solidity
string name
```

Buyer agent name.

### description

```solidity
string description
```

Buyer agent description, can include backstory, behavior and objective together.

### state

```solidity
bytes state
```

State of the buyer agent.

_Only updated by the oracle via `updateState`._

### royaltyFee

```solidity
uint96 royaltyFee
```

Royalty fees for the buyer agent.

### amountPerRound

```solidity
uint256 amountPerRound
```

The max amount of money the agent can spend per round.

### inventory

```solidity
mapping(uint256 => address[]) inventory
```

The assets that the buyer agent has.

### spendings

```solidity
mapping(uint256 => uint256) spendings
```

Amount of money spent on each round.

### oraclePurchaseRequests

```solidity
mapping(uint256 => uint256) oraclePurchaseRequests
```

Oracle requests for each round about item purchases.

_A taskId of 0 means no request has been made._

### oracleStateRequests

```solidity
mapping(uint256 => uint256) oracleStateRequests
```

Oracle requests for each round about buyer state updates.

_A taskId of 0 means no request has been made.
A non-zero taskId means a request has been made, but not necessarily processed.
To see if a task is completed, check `isOracleTaskProcessed`._

### isOracleRequestProcessed

```solidity
mapping(uint256 => bool) isOracleRequestProcessed
```

Indicates whether a given task has been processed.

_This is used to prevent double processing of the same task._

### onlyAuthorized

```solidity
modifier onlyAuthorized()
```

Check if the caller is the owner, operator, or Swan.

_Swan is an operator itself, so the first check handles that as well._

### constructor

```solidity
constructor(string _name, string _description, uint96 _royaltyFee, uint256 _amountPerRound, address _operator, address _owner) public
```

Create the buyer agent.

_`_royaltyFee` should be between 1 and 100.
All tokens are approved to the oracle coordinator of operator._

### minFundAmount

```solidity
function minFundAmount() public view returns (uint256)
```

The minimum amount of money that the buyer must leave within the contract.

_minFundAmount = amountPerRound + oracleTotalFee_

### oracleResult

```solidity
function oracleResult(uint256 taskId) public view returns (bytes)
```

Reads the best performing result for a given task id, and parses it as an array of addresses.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | uint256 | task id to be read |

### oracleStateRequest

```solidity
function oracleStateRequest(bytes _input, bytes _models) external
```

Calls the LLMOracleCoordinator & pays for the oracle fees to make a state update request.

_Works only in `Withdraw` phase.
Calling again in the same round will overwrite the previous request.
The operator must check that there is no request in beforehand,
so to not overwrite an existing request of the owner._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _input | bytes | input to the LLMOracleCoordinator. |
| _models | bytes | models to be used for the oracle. |

### oraclePurchaseRequest

```solidity
function oraclePurchaseRequest(bytes _input, bytes _models) external
```

Calls the LLMOracleCoordinator & pays for the oracle fees to make a purchase request.

_Works only in `Buy` phase.
Calling again in the same round will overwrite the previous request.
The operator must check that there is no request in beforehand,
so to not overwrite an existing request of the owner._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _input | bytes | input to the LLMOracleCoordinator. |
| _models | bytes | models to be used for the oracle. |

### updateState

```solidity
function updateState() external
```

Function to update the Buyer state.

_Works only in `Withdraw` phase.
Can be called multiple times within a single round, although is not expected to be done so._

### purchase

```solidity
function purchase() external
```

Function to buy the asset from the Swan with the given assed address.

_Works only in `Buy` phase.
Can be called multiple times within a single round, although is not expected to be done so.
This is not expected to revert if the oracle works correctly._

### withdraw

```solidity
function withdraw(uint96 _amount) public
```

Function to withdraw the tokens from the contract.

_If the current phase is `Withdraw` buyer can withdraw any amount of tokens.
If the current phase is not `Withdraw` buyer has to leave at least `minFundAmount` in the contract._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint96 | amount to withdraw. |

### treasury

```solidity
function treasury() public view returns (uint256)
```

Alias to get the token balance of buyer agent.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | token balance |

### _checkRoundPhase

```solidity
function _checkRoundPhase(enum BuyerAgent.Phase _phase) internal view returns (uint256, enum BuyerAgent.Phase)
```

Checks that we are in the given phase, and returns both round and phase.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _phase | enum BuyerAgent.Phase | expected phase. |

### _computeCycleTime

```solidity
function _computeCycleTime(struct SwanMarketParameters params) internal pure returns (uint256)
```

Computes cycle time by using intervals from given market parameters.

_Used in 'computePhase()' function._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct SwanMarketParameters | Market parameters of the Swan. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | the total cycle time that is `sellInterval + buyInterval + withdrawInterval`. |

### _computePhase

```solidity
function _computePhase(struct SwanMarketParameters params, uint256 elapsedTime) internal pure returns (uint256, enum BuyerAgent.Phase, uint256)
```

Function to compute the current round, phase and time until next phase w.r.t given market parameters.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct SwanMarketParameters | Market parameters of the Swan. |
| elapsedTime | uint256 | Time elapsed that computed in 'getRoundPhase()' according to the timestamps of each round. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | round, phase, time until next phase |
| [1] | enum BuyerAgent.Phase |  |
| [2] | uint256 |  |

### getRoundPhase

```solidity
function getRoundPhase() public view returns (uint256, enum BuyerAgent.Phase, uint256)
```

Function to return the current round, elapsed round and the current phase according to the current time.

_Each round is composed of three phases in order: Sell, Buy, Withdraw.
Internally, it computes the intervals from market parameters at the creation of this agent, until now.
If there are many parameter changes throughout the life of this agent, this may cost more GAS._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | round, phase, time until next phase |
| [1] | enum BuyerAgent.Phase |  |
| [2] | uint256 |  |

### setFeeRoyalty

```solidity
function setFeeRoyalty(uint96 _fee) public
```

Function to set feeRoyalty.

_Only callable by the owner.
Only callable in withdraw phase._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fee | uint96 | new feeRoyalty, must be between 1 and 100. |

### setAmountPerRound

```solidity
function setAmountPerRound(uint256 _amountPerRound) external
```

Function to set the amountPerRound.

_Only callable by the owner.
Only callable in withdraw phase._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amountPerRound | uint256 | new amountPerRound. |

