// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BatchToken} from "../core/BatchToken.sol";

/// @notice A revenue-sharing ERC20 implementation.
/// We have a `pool` that gets distributed to `holders` based on how much tokens they hold.
contract KnowledgeSupportToken is ERC20 {
    /// @notice Knowledge id, corresponding to the address on Arweave.
    uint256 knowledgeId;
    /// @notice BATCH token.
    BatchToken public immutable batch;
    /// @notice Holder list of this knowledge asset.
    address[] public holders;
    /// @notice Whether an address is a holder.
    mapping(address => bool) public isHolder;

    /// @notice Total supply
    /// TODO: what is the supply? is it dynamic?
    uint256 constant TOTAL_SUPPLY = 100_000 ether;

    constructor(address batch_, uint256 knowledgeId_, address owner_) ERC20("Knowledge", "KNWL") {
        knowledgeId = knowledgeId_;
        batch = BatchToken(batch_);
        ERC20._mint(owner_, TOTAL_SUPPLY);
        _addHolder(owner_);
    }

    /// @notice Transfer from with holder logic.
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        ERC20.transferFrom(from, to, amount);
        _updateHolders(from, to, amount);
        return true;
    }

    /// @notice Transfer with holder logic.
    function transfer(address to, uint256 amount) public override returns (bool) {
        ERC20.transfer(to, amount);
        _updateHolders(msg.sender, to, amount);
        return true;
    }

    /// @notice Update holders.
    function _updateHolders(address from, address to, uint256 amount) internal {
        // if 'to' did not hold tokens before, add them to the holders list
        if (ERC20.balanceOf(to) == amount) {
            _addHolder(to);
        }

        // if 'from' has transferred all their tokens, remove them from the holders list
        if (ERC20.balanceOf(from) == 0) {
            _removeHolder(from);
        }
    }

    /// @notice Adds a holder, meaning that a new address now has a positive balance.
    function _addHolder(address holder) internal {
        if (!isHolder[holder]) {
            holders.push(holder);
            isHolder[holder] = true;
        }
    }

    /// @notice Removes a holder from the holders array.
    /// Does a linear search, swaps the holder with the last one, and pops the holder.
    function _removeHolder(address holder) internal {
        require(isHolder[holder], "Address is not a holder");
        for (uint256 i = 0; i < holders.length; ++i) {
            if (holders[i] == holder) {
                holders[i] = holders[holders.length - 1];
                holders.pop();
                isHolder[holder] = false;
                break;
            }
        }
    }

    /// @notice Show the pool balance, that is the amount of BATCH tokens
    /// that this knowledge holds.
    function getPool() public view returns (uint256) {
        return batch.balanceOf(address(this));
    }

    /// @notice Distribute the pool to all token holders based on their balances.
    function distributePool() public {
        uint256 pool = getPool();
        require(pool != 0);

        for (uint256 i = 0; i < holders.length; ++i) {
            address holder = holders[i];
            uint256 holderBalance = ERC20.balanceOf(holder);
            uint256 payout = pool * holderBalance / TOTAL_SUPPLY;

            // @todo may want to use a pull-payment method here
            batch.transfer(holder, payout);
        }

        // pool must be empty in the end
        require(getPool() == 0);
    }
}
