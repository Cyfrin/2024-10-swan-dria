// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {BatchToken} from "../core/BatchToken.sol";
import {KnowledgeRegistry} from "../core/KnowledgeRegistry.sol";
import {DatasetAccessRegistry} from "../core/DatasetAccessRegistry.sol";

/// @notice A dataset access token.
contract DatasetAccessToken is ERC721, ERC721Burnable {
    /// @notice BaseURI for TokenURI.
    string baseURI = "https://arweave.net/";
    /// @notice Knowledge id, corresponding to the address on Arweave.
    uint256 public immutable knowledgeId;
    /// @notice Knowledge registry of Dria.
    DatasetAccessRegistry public datasetAccessRegistry;

    constructor(DatasetAccessRegistry datasetAccessRegistry_, uint256 knowledgeId_, address owner_, uint256 supply_)
        ERC721("Dataset Access Token", "DAT")
    {
        datasetAccessRegistry = datasetAccessRegistry_;
        knowledgeId = knowledgeId_;

        // confirm that it is registered
        KnowledgeRegistry knowledgeRegistry = datasetAccessRegistry.knowledgeRegistry();
        require(knowledgeRegistry.isRegistered(knowledgeId_), "Knowledge not registered");

        for (uint256 i = 0; i < supply_; i++) {
            ERC721._mint(owner_, i);
        }
    }

    /// @notice Burn the given token and gain access to the dataset.
    /// @dev The caller must own the token, and should have not burned a token before.
    /// This is enforced because there is no need to burn the token again
    /// because the access key has already been created. If the user really wants
    /// to burn the token, they can send it to the zero address.
    function burn(uint256 tokenId) public override {
        ERC721Burnable.burn(tokenId);
        datasetAccessRegistry.requestAccess(msg.sender);
    }

    /// @notice Returns the token URI.
    function tokenURI(uint256) public view virtual override returns (string memory) {
        return string(abi.encodePacked(baseURI, knowledgeId));
    }

    /// @notice Set the base URI for the token URI.
    function setBaseURI(string memory baseURI_) public {
        baseURI = baseURI_;
    }
}
