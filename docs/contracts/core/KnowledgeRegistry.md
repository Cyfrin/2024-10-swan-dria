# Solidity API

## KnowledgeRegistry

The knowledge registry is a pre-deployed contract that handles the
registration of knowledge on a decentralized storage.
The knowledge identifiers are expected to be 32-bytes.

### Registered

```solidity
event Registered(address owner, uint256 knowledge)
```

Emitted when a knowledge is registered.

### RelationSet

```solidity
event RelationSet(uint256 knowledge, bytes32 name, address target)
```

Emitted when a relation is added.

### KnowledgeExists

```solidity
error KnowledgeExists(uint256 knowledge)
```

A knowledge is already registered.

### relations

```solidity
mapping(uint256 => mapping(bytes32 => address)) relations
```

Knowledge to relation respecting the name.

### owners

```solidity
mapping(uint256 => address) owners
```

Owner address for each knowledge.

### knowledges

```solidity
mapping(address => uint256[]) knowledges
```

Knowledges registered per owner.

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
function initialize() public
```

Initialize the contract.

### registerKnowledge

```solidity
function registerKnowledge(address user, uint256 knowledge) external
```

Registers a new knowledge to Dria.

_Reverts if knowledge is already registered._

### setRelation

```solidity
function setRelation(uint256 knowledge, address target, bytes32 name) external
```

Sets a relation to a knowledge.

### removeRelation

```solidity
function removeRelation(uint256 knowledge, bytes32 name) external
```

Removes a relation from a knowledge.

### isRegistered

```solidity
function isRegistered(uint256 knowledge) public view returns (bool)
```

Checks if a knowledge is registered.

### getKnowledges

```solidity
function getKnowledges(address user) public view returns (uint256[])
```

Returns the list of knowledges registered by an owner.

