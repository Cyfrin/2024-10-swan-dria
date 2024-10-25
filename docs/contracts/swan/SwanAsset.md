# Solidity API

## SwanAssetFactory

Factory contract to deploy SwanAsset tokens.

_This saves from contract space for Swan._

### deploy

```solidity
function deploy(string _name, string _symbol, bytes _description, address _owner) external returns (contract SwanAsset)
```

Deploys a new SwanAsset token.

## SwanAsset

SwanAsset is an ERC721 token with a single token supply.

### createdAt

```solidity
uint256 createdAt
```

Creation time of the token

### description

```solidity
bytes description
```

Description of the token

### constructor

```solidity
constructor(string _name, string _symbol, bytes _description, address _owner, address _operator) public
```

Constructor sets properties of the token.

