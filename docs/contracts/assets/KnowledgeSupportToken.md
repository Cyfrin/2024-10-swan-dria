# Solidity API

## KnowledgeSupportToken

A revenue-sharing ERC20 implementation.
We have a `pool` that gets distributed to `holders` based on how much tokens they hold.

### knowledgeId

```solidity
uint256 knowledgeId
```

Knowledge id, corresponding to the address on Arweave.

### batch

```solidity
contract BatchToken batch
```

BATCH token.

### holders

```solidity
address[] holders
```

Holder list of this knowledge asset.

### isHolder

```solidity
mapping(address => bool) isHolder
```

Whether an address is a holder.

### TOTAL_SUPPLY

```solidity
uint256 TOTAL_SUPPLY
```

Total supply
TODO: what is the supply? is it dynamic?

### constructor

```solidity
constructor(address batch_, uint256 knowledgeId_, address owner_) public
```

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 amount) public returns (bool)
```

Transfer from with holder logic.

### transfer

```solidity
function transfer(address to, uint256 amount) public returns (bool)
```

Transfer with holder logic.

### _updateHolders

```solidity
function _updateHolders(address from, address to, uint256 amount) internal
```

Update holders.

### _addHolder

```solidity
function _addHolder(address holder) internal
```

Adds a holder, meaning that a new address now has a positive balance.

### _removeHolder

```solidity
function _removeHolder(address holder) internal
```

Removes a holder from the holders array.
Does a linear search, swaps the holder with the last one, and pops the holder.

### getPool

```solidity
function getPool() public view returns (uint256)
```

Show the pool balance, that is the amount of BATCH tokens
that this knowledge holds.

### distributePool

```solidity
function distributePool() public
```

Distribute the pool to all token holders based on their balances.

