# Solidity API

## SwanMarketParameters

Collection of market-related parameters.

_Prevents stack-too-deep.
TODO: use 256-bit tight-packing here_

```solidity
struct SwanMarketParameters {
  uint256 withdrawInterval;
  uint256 sellInterval;
  uint256 buyInterval;
  uint256 platformFee;
  uint256 maxAssetCount;
  uint256 timestamp;
}
```

## SwanManager

### marketParameters

```solidity
struct SwanMarketParameters[] marketParameters
```

Market parameters such as intervals and fees.

### oracleParameters

```solidity
struct LLMOracleTaskParameters oracleParameters
```

Oracle parameters such as fees.

### buyerAgentFactory

```solidity
contract BuyerAgentFactory buyerAgentFactory
```

Factory contract to deploy Buyer Agents.

### swanAssetFactory

```solidity
contract SwanAssetFactory swanAssetFactory
```

Factory contract to deploy SwanAsset tokens.

### coordinator

```solidity
contract LLMOracleCoordinator coordinator
```

LLM Oracle Coordinator.

### token

```solidity
contract ERC20 token
```

The token to be used for fee payments.

### isOperator

```solidity
mapping(address => bool) isOperator
```

Operator addresses that can take actions on behalf of Buyer agents,
such as calling `purchase`, or `updateState` for them.

### constructor

```solidity
constructor() public
```

Locks the contract, preventing any future re-initialization.

_[See more](https://docs.openzeppelin.com/contracts/5.x/api/proxy#Initializable-_disableInitializers--)._

### getMarketParameters

```solidity
function getMarketParameters() external view returns (struct SwanMarketParameters[])
```

Returns the market parameters in memory.

### getOracleParameters

```solidity
function getOracleParameters() external view returns (struct LLMOracleTaskParameters)
```

Returns the oracle parameters in memory.

### setMarketParameters

```solidity
function setMarketParameters(struct SwanMarketParameters _marketParameters) external
```

Pushes a new market parameters to the marketParameters array.

_Only callable by owner._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _marketParameters | struct SwanMarketParameters | new market parameters |

### setOracleParameters

```solidity
function setOracleParameters(struct LLMOracleTaskParameters _oracleParameters) external
```

Set the oracle parameters.

_Only callable by owner._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oracleParameters | struct LLMOracleTaskParameters | new oracle parameters |

### getOracleFee

```solidity
function getOracleFee() external view returns (uint256)
```

Returns the total fee required to make an oracle request.

_This is mainly required by the buyer to calculate its minimum fund amount, so that it can pay the fee._

### setFactories

```solidity
function setFactories(address _buyerAgentFactory, address _swanAssetFactory) external
```

Set the factories for Buyer Agents and Swan Assets.

_Only callable by owner._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _buyerAgentFactory | address | new BuyerAgentFactory address |
| _swanAssetFactory | address | new SwanAssetFactory address |

### addOperator

```solidity
function addOperator(address _operator) external
```

Adds an operator that can take actions on behalf of Buyer agents.

_Only callable by owner.
Has no effect if the operator is already authorized._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _operator | address | new operator address |

### removeOperator

```solidity
function removeOperator(address _operator) external
```

Removes an operator, so that they are no longer authorized.

_Only callable by owner.
Has no effect if the operator is already not authorized._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _operator | address | operator address to remove |

### getCurrentMarketParameters

```solidity
function getCurrentMarketParameters() public view returns (struct SwanMarketParameters)
```

Returns the current market parameters.

_Current market parameters = Last element in the marketParameters array_

