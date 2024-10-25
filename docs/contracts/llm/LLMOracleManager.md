# Solidity API

## LLMOracleManager

Holds the configuration for the LLM Oracle, such as allowed bounds on difficulty,
number of generations & validations, and fee settings.

### InvalidParameterRange

```solidity
error InvalidParameterRange(uint256 have, uint256 min, uint256 max)
```

Given parameter is out of range.

### platformFee

```solidity
uint256 platformFee
```

A fixed fee paid for the platform.

### generationFee

```solidity
uint256 generationFee
```

The base fee factor for a generation of LLM generation.

_When scaled with difficulty & number of generations, we denote it as `generatorFee`._

### validationFee

```solidity
uint256 validationFee
```

The base fee factor for a generation of LLM validation.

_When scaled with difficulty & number of validations, we denote it as `validatorFee`._

### validationDeviationFactor

```solidity
uint64 validationDeviationFactor
```

The deviation factor for the validation scores.

### generationDeviationFactor

```solidity
uint64 generationDeviationFactor
```

The deviation factor for the generation scores.

### minimumParameters

```solidity
struct LLMOracleTaskParameters minimumParameters
```

Minimums for oracle parameters.

### maximumParameters

```solidity
struct LLMOracleTaskParameters maximumParameters
```

Maximums for oracle parameters.

### __LLMOracleManager_init

```solidity
function __LLMOracleManager_init(uint256 _platformFee, uint256 _generationFee, uint256 _validationFee) internal
```

Initialize the contract.

### onlyValidParameters

```solidity
modifier onlyValidParameters(struct LLMOracleTaskParameters parameters)
```

Modifier to check if the given parameters are within the allowed range.

### setFees

```solidity
function setFees(uint256 _platformFee, uint256 _generationFee, uint256 _validationFee) public
```

Update Oracle fees.

_To keep a fee unchanged, provide the same value._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _platformFee | uint256 | The new platform fee |
| _generationFee | uint256 | The new generation fee |
| _validationFee | uint256 | The new validation fee |

### getFee

```solidity
function getFee(struct LLMOracleTaskParameters parameters) public view returns (uint256 totalFee, uint256 generatorFee, uint256 validatorFee)
```

Get the total fee for a given task setting.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| parameters | struct LLMOracleTaskParameters | The task parameters. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalFee | uint256 | The total fee for the task. |
| generatorFee | uint256 | The fee paid to each generator per generation. |
| validatorFee | uint256 | The fee paid to each validator per validated generation. |

### setParameters

```solidity
function setParameters(struct LLMOracleTaskParameters minimums, struct LLMOracleTaskParameters maximums) public
```

Update Oracle parameters bounds.

_Provide the same value to keep it unchanged._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| minimums | struct LLMOracleTaskParameters | The new minimum parameters. |
| maximums | struct LLMOracleTaskParameters | The new maximum parameters. |

### setDeviationFactors

```solidity
function setDeviationFactors(uint64 _generationDeviationFactor, uint64 _validationDeviationFactor) public
```

Update deviation factors.

_Provide the same value to keep it unchanged._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _generationDeviationFactor | uint64 | The new generation deviation factor. |
| _validationDeviationFactor | uint64 | The new validation deviation factor. |

