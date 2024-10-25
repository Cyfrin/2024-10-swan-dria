// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {KnowledgeRegistry} from "../core/KnowledgeRegistry.sol";
import {DatasetAccessToken} from "../assets/DatasetAccessToken.sol";

/// @notice This registry stores the access keys for datasets.
contract DatasetAccessRegistry is UUPSUpgradeable, OwnableUpgradeable {
    /// @dev Relation name.
    bytes32 public constant RELATION_NAME = bytes32("Dataset");

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @dev A Burn event from a dataset token is registered as an AccessRequest, assuming
    /// that the requesting user had already burned it.
    ///
    /// This event is picked up by Dria, and the public key of transaction owner is recovered from the
    /// transaction signature. The public key is then used to encrypt the access key, which is stored
    /// in this contract.
    ///
    /// @param user address of the user requesting access.
    /// @param knowledgeId id of the knowledge.
    event AccessRequest(address indexed user, uint256 indexed knowledgeId);

    /// @dev As Dria sets the access key, the user is notified of the successful access via this event.
    /// @param user address of the user requesting access.
    /// @param knowledgeId id of the knowledge.
    event AccessResponse(address indexed user, uint256 indexed knowledgeId);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Called by an unknown target.
    error UnknownRelation(address target);
    /// @notice Access request for an unregistered knowledge.
    error UnregisteredKnowledge(uint256 knowledgeId);
    /// @notice Access request for an unregistered knowledge.
    error AccessKeyExists(address user, uint256 knowledgeId);

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Knowledge registry of Dria.
    KnowledgeRegistry public knowledgeRegistry;
    /// @notice Encrypted access keys.
    mapping(address user => mapping(uint256 knowledge => bytes key)) public accessKeys;

    /// @notice Locks the contract, preventing any future re-initialization.
    /// @dev [See more](https://docs.openzeppelin.com/contracts/5.x/api/proxy#Initializable-_disableInitializers--).
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Function that should revert when `msg.sender` is not authorized to upgrade the contract.
    /// @dev Called by and upgradeToAndCall.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Initialize the contract.
    function initialize(KnowledgeRegistry knowledgeRegistry_) public initializer {
        __Ownable_init(msg.sender);
        knowledgeRegistry = knowledgeRegistry_;
    }

    /// @notice Request access to a dataset via its Burner NFT.
    /// @dev There are some conditions for this:
    ///
    /// 1. The call must be coming from a DatasetAccessToken.
    /// 2. The knowledgeId of the dataset must be registered.
    /// 3. The caller contract must be a relation to the knowledgeId on the registry, with the name "Dataset".
    function requestAccess(address user) public {
        DatasetAccessToken token = DatasetAccessToken(msg.sender);

        // get knowledge id from the calling contract
        uint256 knowledgeId = token.knowledgeId();

        // ensure that there is NOT an access key for this already
        if (accessKeys[user][knowledgeId].length != 0) {
            revert AccessKeyExists(user, knowledgeId);
        }

        // ensure that the knowledge is registered
        // this check is not expected to fail, as the token should would not be
        /// deployed & minted if the knowledge was not registered in the first place
        if (!knowledgeRegistry.isRegistered(knowledgeId)) {
            revert UnregisteredKnowledge(knowledgeId);
        }

        // ensure that it is a valid relation in the knowledge registry
        address relation = knowledgeRegistry.relations(knowledgeId, RELATION_NAME);
        if (relation != msg.sender) {
            revert UnknownRelation(msg.sender);
        }

        emit AccessRequest(user, knowledgeId);
    }

    /// @notice Set the access key for a knowledge.
    /// @dev Can only be called by the owner.
    function setAccessKey(bytes memory accessKey, uint256 knowledgeId, address knowledgeOwner) external onlyOwner {
        accessKeys[knowledgeOwner][knowledgeId] = accessKey;
    }
}
