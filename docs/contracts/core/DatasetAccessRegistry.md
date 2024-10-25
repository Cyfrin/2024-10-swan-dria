# Solidity API

## DatasetAccessRegistry

This registry stores the access keys for datasets.

### RELATION_NAME

```solidity
bytes32 RELATION_NAME
```

_Relation name._

### AccessRequest

```solidity
event AccessRequest(address user, uint256 knowledgeId)
```

_A Burn event from a dataset token is registered as an AccessRequest, assuming
that the requesting user had already burned it.

This event is picked up by Dria, and the public key of transaction owner is recovered from the
transaction signature. The public key is then used to encrypt the access key, which is stored
in this contract._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of the user requesting access. |
| knowledgeId | uint256 | id of the knowledge. |

### AccessResponse

```solidity
event AccessResponse(address user, uint256 knowledgeId)
```

_As Dria sets the access key, the user is notified of the successful access via this event._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | address of the user requesting access. |
| knowledgeId | uint256 | id of the knowledge. |

### UnknownRelation

```solidity
error UnknownRelation(address target)
```

Called by an unknown target.

### UnregisteredKnowledge

```solidity
error UnregisteredKnowledge(uint256 knowledgeId)
```

Access request for an unregistered knowledge.

### AccessKeyExists

```solidity
error AccessKeyExists(address user, uint256 knowledgeId)
```

Access request for an unregistered knowledge.

### knowledgeRegistry

```solidity
contract KnowledgeRegistry knowledgeRegistry
```

Knowledge registry of Dria.

### accessKeys

```solidity
mapping(address => mapping(uint256 => bytes)) accessKeys
```

Encrypted access keys.

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
function initialize(contract KnowledgeRegistry knowledgeRegistry_) public
```

Initialize the contract.

### requestAccess

```solidity
function requestAccess(address user) public
```

Request access to a dataset via its Burner NFT.

_There are some conditions for this:

1. The call must be coming from a DatasetAccessToken.
2. The knowledgeId of the dataset must be registered.
3. The caller contract must be a relation to the knowledgeId on the registry, with the name "Dataset"._

### setAccessKey

```solidity
function setAccessKey(bytes accessKey, uint256 knowledgeId, address knowledgeOwner) external
```

Set the access key for a knowledge.

_Can only be called by the owner._

