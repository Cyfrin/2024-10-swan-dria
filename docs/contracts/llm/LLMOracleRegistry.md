# Solidity API

## LLMOracleKind

The type of Oracle.

```solidity
enum LLMOracleKind {
  Generator,
  Validator
}
```

## LLMOracleRegistry

Holds the addresses that are eligible to respond to LLM requests.

_There may be several types of oracle kinds, and each require their own stake._

### Registered

```solidity
event Registered(address, enum LLMOracleKind kind)
```

The Oracle response to an LLM generation request.

### Unregistered

```solidity
event Unregistered(address, enum LLMOracleKind kind)
```

The Oracle response to an LLM generation request.

### NotRegistered

```solidity
error NotRegistered(address)
```

The user is not registered.

### AlreadyRegistered

```solidity
error AlreadyRegistered(address)
```

The user is already registered.

### InsufficientFunds

```solidity
error InsufficientFunds()
```

Insufficient stake amount during registration.

### generatorStakeAmount

```solidity
uint256 generatorStakeAmount
```

Stake amount to be registered as an Oracle that can serve generation requests.

### validatorStakeAmount

```solidity
uint256 validatorStakeAmount
```

Stake amount to be registered as an Oracle that can serve validation requests.

### registrations

```solidity
mapping(address => mapping(enum LLMOracleKind => uint256)) registrations
```

Registrations per address & kind. If amount is 0, it is not registered.

### token

```solidity
contract ERC20 token
```

Token used for staking.

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
function initialize(uint256 _generatorStakeAmount, uint256 _validatorStakeAmount, address _token) public
```

_Sets the owner to be the deployer, sets initial stake amount._

### register

```solidity
function register(enum LLMOracleKind kind) public
```

Register an Oracle.

_Reverts if the user is already registered or has insufficient funds._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| kind | enum LLMOracleKind | The kind of Oracle to unregister. |

### unregister

```solidity
function unregister(enum LLMOracleKind kind) public returns (uint256 amount)
```

Remove registration of an Oracle.

_Reverts if the user is not registered._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| kind | enum LLMOracleKind | The kind of Oracle to unregister. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount of stake approved back. |

### setStakeAmounts

```solidity
function setStakeAmounts(uint256 _generatorStakeAmount, uint256 _validatorStakeAmount) public
```

Set the stake amount required to register as an Oracle.

_Only allowed by the owner._

### getStakeAmount

```solidity
function getStakeAmount(enum LLMOracleKind kind) public view returns (uint256)
```

Returns the stake amount required to register as an Oracle w.r.t given kind.

### isRegistered

```solidity
function isRegistered(address user, enum LLMOracleKind kind) public view returns (bool)
```

Check if an Oracle is registered.

