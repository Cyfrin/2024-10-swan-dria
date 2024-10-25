// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Factory contract to deploy SwanAsset tokens.
/// @dev This saves from contract space for Swan.
contract SwanAssetFactory {
    /// @notice Deploys a new SwanAsset token.
    function deploy(string memory _name, string memory _symbol, bytes memory _description, address _owner)
        external
        returns (SwanAsset)
    {
        return new SwanAsset(_name, _symbol, _description, _owner, msg.sender);
    }
}

/// @notice SwanAsset is an ERC721 token with a single token supply.
contract SwanAsset is ERC721, Ownable {
    /// @notice Creation time of the token
    uint256 public createdAt;
    /// @notice Description of the token
    bytes public description;

    /// @notice Constructor sets properties of the token.
    constructor(
        string memory _name,
        string memory _symbol,
        bytes memory _description,
        address _owner,
        address _operator
    ) ERC721(_name, _symbol) Ownable(_owner) {
        description = _description;
        createdAt = block.timestamp;

        // owner is minted the token immediately
        ERC721._mint(_owner, 1);

        // Swan (operator) is approved to by the owner immediately.
        ERC721._setApprovalForAll(_owner, _operator, true);
    }
}
