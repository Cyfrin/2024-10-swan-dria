// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {BatchToken} from "./BatchToken.sol";

/// @notice The knowledge registry is a pre-deployed contract that handles the
/// registration of knowledge on a decentralized storage.
/// The knowledge identifiers are expected to be 32-bytes.
contract KnowledgeRegistry is OwnableUpgradeable, UUPSUpgradeable {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a knowledge is registered.
    event Registered(address indexed owner, uint256 indexed knowledge);
    /// @notice Emitted when a relation is added.
    event RelationSet(uint256 indexed knowledge, bytes32 indexed name, address target);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice A knowledge is already registered.
    error KnowledgeExists(uint256 knowledge);

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Knowledge to relation respecting the name.
    mapping(uint256 knowledge => mapping(bytes32 name => address target)) public relations;
    /// @notice Owner address for each knowledge.
    mapping(uint256 knowledge => address owner) public owners;
    /// @notice Knowledges registered per owner.
    mapping(address owner => uint256[] knowledges) public knowledges;

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Locks the contract, preventing any future re-initialization.
    /// @dev [See more](https://docs.openzeppelin.com/contracts/5.x/api/proxy#Initializable-_disableInitializers--).
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /*//////////////////////////////////////////////////////////////
                                  LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Function that should revert when `msg.sender` is not authorized to upgrade the contract.
    /// @dev Called by and upgradeToAndCall.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Initialize the contract.
    function initialize() public initializer {
        __Ownable_init(msg.sender);
    }

    /// @notice Registers a new knowledge to Dria.
    /// @dev Reverts if knowledge is already registered.
    function registerKnowledge(address user, uint256 knowledge) external onlyOwner {
        if (isRegistered(knowledge)) {
            revert KnowledgeExists(knowledge);
        }

        knowledges[user].push(knowledge);
        owners[knowledge] = user;

        emit Registered(user, knowledge);
    }

    /// @notice Sets a relation to a knowledge.
    function setRelation(uint256 knowledge, address target, bytes32 name) external onlyOwner {
        relations[knowledge][name] = target;
        emit RelationSet(knowledge, name, target);
    }

    /// @notice Removes a relation from a knowledge.
    function removeRelation(uint256 knowledge, bytes32 name) external onlyOwner {
        relations[knowledge][name] = address(0);
    }

    /// @notice Checks if a knowledge is registered.
    function isRegistered(uint256 knowledge) public view returns (bool) {
        return owners[knowledge] != address(0);
    }

    /// @notice Returns the list of knowledges registered by an owner.
    function getKnowledges(address user) public view returns (uint256[] memory) {
        return knowledges[user];
    }
}
