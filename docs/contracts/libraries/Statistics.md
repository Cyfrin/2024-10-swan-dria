# Solidity API

## Statistics

Simple statistic library for uint256 arrays, numbers are treat as fixed-precision floats.

### avg

```solidity
function avg(uint256[] data) internal pure returns (uint256 ans)
```

Compute the mean of the data.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| data | uint256[] | The data to compute the mean for. |

### variance

```solidity
function variance(uint256[] data) internal pure returns (uint256 ans, uint256 mean)
```

Compute the variance of the data.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| data | uint256[] | The data to compute the variance for. |

### stddev

```solidity
function stddev(uint256[] data) internal pure returns (uint256 ans, uint256 mean)
```

Compute the standard deviation of the data.

_Computes variance, and takes the square root._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| data | uint256[] | The data to compute the standard deviation for. |

### sqrt

```solidity
function sqrt(uint256 x) internal pure returns (uint256 y)
```

Compute the square root of a number.

_Uses Babylonian method._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| x | uint256 | The number to compute the square root for. |

