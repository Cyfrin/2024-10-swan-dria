# Solidity API

## DatasetAccessToken

A dataset access token.

### baseURI

```solidity
string baseURI
```

BaseURI for TokenURI.

### knowledgeId

```solidity
uint256 knowledgeId
```

Knowledge id, corresponding to the address on Arweave.

### datasetAccessRegistry

```solidity
contract DatasetAccessRegistry datasetAccessRegistry
```

Knowledge registry of Dria.

### constructor

```solidity
constructor(contract DatasetAccessRegistry datasetAccessRegistry_, uint256 knowledgeId_, address owner_, uint256 supply_) public
```

### burn

```solidity
function burn(uint256 tokenId) public
```

Burn the given token and gain access to the dataset.

_The caller must own the token, and should have not burned a token before.
This is enforced because there is no need to burn the token again
because the access key has already been created. If the user really wants
to burn the token, they can send it to the zero address._

### tokenURI

```solidity
function tokenURI(uint256) public view virtual returns (string)
```

Returns the token URI.

### setBaseURI

```solidity
function setBaseURI(string baseURI_) public
```

Set the base URI for the token URI.

