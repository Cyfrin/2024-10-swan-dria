# Solidity API

## SwanBuyerPurchaseOracleProtocol

```solidity
bytes32 SwanBuyerPurchaseOracleProtocol
```

## SwanBuyerStateOracleProtocol

```solidity
bytes32 SwanBuyerStateOracleProtocol
```

## Swan

### InvalidStatus

```solidity
error InvalidStatus(enum Swan.AssetStatus have, enum Swan.AssetStatus want)
```

Invalid asset status.

### Unauthorized

```solidity
error Unauthorized(address caller)
```

Caller is not authorized for the operation, e.g. not a contract owner or listing owner.

### RoundNotFinished

```solidity
error RoundNotFinished(address asset, uint256 round)
```

The given asset is still in the given round.

_Most likely coming from `relist` function, where the asset cant be
relisted in the same round that it was listed in._

### AssetLimitExceeded

```solidity
error AssetLimitExceeded(uint256 limit)
```

Asset count limit exceeded for this round

### AssetListed

```solidity
event AssetListed(address owner, address asset, uint256 price)
```

`asset` is created & listed for sale.

### AssetRelisted

```solidity
event AssetRelisted(address owner, address buyer, address asset, uint256 price)
```

Asset relisted by it's `owner`.

_This may happen if a listed asset is not sold in the current round, and is relisted in a new round._

### AssetSold

```solidity
event AssetSold(address owner, address buyer, address asset, uint256 price)
```

A `buyer` purchased an Asset.

### BuyerCreated

```solidity
event BuyerCreated(address owner, address buyer)
```

A new buyer agent is created.

_`owner` is the owner of the buyer agent.
`buyer` is the address of the buyer agent._

### AssetStatus

Status of an asset. All assets are listed as soon as they are listed.

_Unlisted: cannot be purchased in the current round.
Listed: can be purchase in the current round.
Sold: asset is sold.
It is important that `Unlisted` is only the default and is not set explicitly.
This allows to understand that if an asset is `Listed` but the round has past, it was not sold.
The said fact is used within the `relist` logic._

```solidity
enum AssetStatus {
  Unlisted,
  Listed,
  Sold
}
```

### AssetListing

Holds the listing information.

_`createdAt` is the timestamp of the Asset creation.
`royaltyFee` is the royaltyFee of the buyerAgent.
`price` is the price of the Asset.
`seller` is the address of the creator of the Asset.
`buyer` is the address of the buyerAgent.
`round` is the round in which the Asset is created.
`status` is the status of the Asset._

```solidity
struct AssetListing {
  uint256 createdAt;
  uint96 royaltyFee;
  uint256 price;
  address seller;
  address buyer;
  uint256 round;
  enum Swan.AssetStatus status;
}
```

### listings

```solidity
mapping(address => struct Swan.AssetListing) listings
```

To keep track of the assets for purchase.

### assetsPerBuyerRound

```solidity
mapping(address => mapping(uint256 => address[])) assetsPerBuyerRound
```

Keeps track of assets per buyer & round.

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

Upgrades to contract with a new implementation.

_Only callable by the owner._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newImplementation | address | address of the new implementation |

### initialize

```solidity
function initialize(struct SwanMarketParameters _marketParameters, struct LLMOracleTaskParameters _oracleParameters, address _coordinator, address _token, address _buyerAgentFactory, address _swanAssetFactory) public
```

Initialize the contract.

### list

```solidity
function list(string _name, string _symbol, bytes _desc, uint256 _price, address _buyer) external
```

Creates a new Asset.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _name | string | name of the token. |
| _symbol | string | symbol of the token. |
| _desc | bytes | description of the token. |
| _price | uint256 | price of the token. |
| _buyer | address | address of the buyer. |

### relist

```solidity
function relist(address _asset, address _buyer, uint256 _price) external
```

Relist the asset for another round and/or another buyer and/or another price.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _asset | address | address of the asset. |
| _buyer | address | new buyerAgent for the asset. |
| _price | uint256 | new price of the token. |

### transferRoyalties

```solidity
function transferRoyalties(struct Swan.AssetListing asset) internal
```

Function to transfer the royalties to the seller & Dria.

### purchase

```solidity
function purchase(address _asset) external
```

Executes the purchase of a listing for a buyer for the given asset.

_Must be called by the buyer of the given asset._

### getListingPrice

```solidity
function getListingPrice(address _asset) external view returns (uint256)
```

Returns the asset status with the given asset address.

_Active: If the asset has not been purchased or the next round has not started.
Inactive: If the assets's purchaseRound has passed or delisted by the creator of the asset.
Sold: If the asset has already been purchased by the buyer._

### getListedAssets

```solidity
function getListedAssets(address _buyer, uint256 _round) external view returns (address[])
```

Returns the number of assets with the given buyer and round.

_Assets can be assumed to be_

### getListing

```solidity
function getListing(address _asset) external view returns (struct Swan.AssetListing)
```

Returns the asset listing with the given asset address.

### createBuyer

```solidity
function createBuyer(string _name, string _description, uint96 _feeRoyalty, uint256 _amountPerRound) external returns (contract BuyerAgent)
```

Creates a new buyer agent.

_Emits a `BuyerCreated` event._

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract BuyerAgent | address of the new buyer agent. |

