// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {LLMOracleCoordinator} from "../llm/LLMOracleCoordinator.sol";
import {LLMOracleTaskParameters} from "../llm/LLMOracleTask.sol";
import {BuyerAgentFactory, BuyerAgent} from "./BuyerAgent.sol";
import {SwanAssetFactory, SwanAsset} from "./SwanAsset.sol";
import {SwanManager, SwanMarketParameters} from "./SwanManager.sol";

// Protocol strings for Swan, checked in the Oracle.
bytes32 constant SwanBuyerPurchaseOracleProtocol = "swan-buyer-purchase/0.1.0";
bytes32 constant SwanBuyerStateOracleProtocol = "swan-buyer-state/0.1.0";

contract Swan is SwanManager, UUPSUpgradeable {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Invalid asset status.
    error InvalidStatus(AssetStatus have, AssetStatus want);

    /// @notice Caller is not authorized for the operation, e.g. not a contract owner or listing owner.
    error Unauthorized(address caller);

    /// @notice The given asset is still in the given round.
    /// @dev Most likely coming from `relist` function, where the asset cant be
    /// relisted in the same round that it was listed in.
    error RoundNotFinished(address asset, uint256 round);

    /// @notice Asset count limit exceeded for this round
    error AssetLimitExceeded(uint256 limit);

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice `asset` is created & listed for sale.
    event AssetListed(address indexed owner, address indexed asset, uint256 price);

    /// @notice Asset relisted by it's `owner`.
    /// @dev This may happen if a listed asset is not sold in the current round, and is relisted in a new round.
    event AssetRelisted(address indexed owner, address indexed buyer, address indexed asset, uint256 price);

    /// @notice A `buyer` purchased an Asset.
    event AssetSold(address indexed owner, address indexed buyer, address indexed asset, uint256 price);

    /// @notice A new buyer agent is created.
    /// @dev `owner` is the owner of the buyer agent.
    /// @dev `buyer` is the address of the buyer agent.
    event BuyerCreated(address indexed owner, address indexed buyer);

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Status of an asset. All assets are listed as soon as they are listed.
    /// @dev Unlisted: cannot be purchased in the current round.
    /// @dev Listed: can be purchase in the current round.
    /// @dev Sold: asset is sold.
    /// @dev It is important that `Unlisted` is only the default and is not set explicitly.
    /// This allows to understand that if an asset is `Listed` but the round has past, it was not sold.
    /// The said fact is used within the `relist` logic.
    enum AssetStatus {
        Unlisted,
        Listed,
        Sold
    }

    /// @notice Holds the listing information.
    /// @dev `createdAt` is the timestamp of the Asset creation.
    /// @dev `royaltyFee` is the royaltyFee of the buyerAgent.
    /// @dev `price` is the price of the Asset.
    /// @dev `seller` is the address of the creator of the Asset.
    /// @dev `buyer` is the address of the buyerAgent.
    /// @dev `round` is the round in which the Asset is created.
    /// @dev `status` is the status of the Asset.
    struct AssetListing {
        uint256 createdAt;
        uint96 royaltyFee;
        uint256 price;
        address seller; // TODO: we can use asset.owner() instead of seller
        address buyer;
        uint256 round;
        AssetStatus status;
    }

    /// @notice To keep track of the assets for purchase.
    mapping(address asset => AssetListing) public listings;
    /// @notice Keeps track of assets per buyer & round.
    mapping(address buyer => mapping(uint256 round => address[])) public assetsPerBuyerRound;

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
                                UPGRADABLE
    //////////////////////////////////////////////////////////////*/

    /// @notice Upgrades to contract with a new implementation.
    /// @dev Only callable by the owner.
    /// @param newImplementation address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // `onlyOwner` modifier does the auth here
    }

    /// @notice Initialize the contract.
    function initialize(
        SwanMarketParameters calldata _marketParameters,
        LLMOracleTaskParameters calldata _oracleParameters,
        // contracts
        address _coordinator,
        address _token,
        address _buyerAgentFactory,
        address _swanAssetFactory
    ) public initializer {
        __Ownable_init(msg.sender);

        require(_marketParameters.platformFee <= 100, "Platform fee cannot exceed 100%");

        // market & oracle parameters
        marketParameters.push(_marketParameters);
        oracleParameters = _oracleParameters;

        // contracts
        coordinator = LLMOracleCoordinator(_coordinator);
        token = ERC20(_token);
        buyerAgentFactory = BuyerAgentFactory(_buyerAgentFactory);
        swanAssetFactory = SwanAssetFactory(_swanAssetFactory);

        // swan is an operator
        isOperator[address(this)] = true;
        // owner is an operator
        isOperator[msg.sender] = true;
    }

    /*//////////////////////////////////////////////////////////////
                                  LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Creates a new Asset.
    /// @param _name name of the token.
    /// @param _symbol symbol of the token.
    /// @param _desc description of the token.
    /// @param _price price of the token.
    /// @param _buyer address of the buyer.
    function list(string calldata _name, string calldata _symbol, bytes calldata _desc, uint256 _price, address _buyer)
        external
    {
        BuyerAgent buyer = BuyerAgent(_buyer);
        (uint256 round, BuyerAgent.Phase phase,) = buyer.getRoundPhase();

        // buyer must be in the sell phase
        if (phase != BuyerAgent.Phase.Sell) {
            revert BuyerAgent.InvalidPhase(phase, BuyerAgent.Phase.Sell);
        }
        // asset count must not exceed `maxAssetCount`
        if (getCurrentMarketParameters().maxAssetCount == assetsPerBuyerRound[_buyer][round].length) {
            revert AssetLimitExceeded(getCurrentMarketParameters().maxAssetCount);
        }

        // all is well, create the asset & its listing
        address asset = address(swanAssetFactory.deploy(_name, _symbol, _desc, msg.sender));
        listings[asset] = AssetListing({
            createdAt: block.timestamp,
            royaltyFee: buyer.royaltyFee(),
            price: _price,
            seller: msg.sender,
            status: AssetStatus.Listed,
            buyer: _buyer,
            round: round
        });

        // add this to list of listings for the buyer for this round
        assetsPerBuyerRound[_buyer][round].push(asset);

        // transfer royalties
        transferRoyalties(listings[asset]);

        emit AssetListed(msg.sender, asset, _price);
    }

    /// @notice Relist the asset for another round and/or another buyer and/or another price.
    /// @param  _asset address of the asset.
    /// @param  _buyer new buyerAgent for the asset.
    /// @param  _price new price of the token.
    function relist(address _asset, address _buyer, uint256 _price) external {
        AssetListing storage asset = listings[_asset];

        // only the seller can relist the asset
        if (asset.seller != msg.sender) {
            revert Unauthorized(msg.sender);
        }

        // asset must be listed
        if (asset.status != AssetStatus.Listed) {
            revert InvalidStatus(asset.status, AssetStatus.Listed);
        }

        // relist can only happen after the round of its listing has ended
        // we check this via the old buyer, that is the existing asset.buyer
        //
        // note that asset is unlisted here, but is not bought at all
        //
        // perhaps it suffices to check `==` here, since buyer round
        // is changed incrementially
        (uint256 oldRound,,) = BuyerAgent(asset.buyer).getRoundPhase();
        if (oldRound <= asset.round) {
            revert RoundNotFinished(_asset, asset.round);
        }

        // now we move on to the new buyer
        BuyerAgent buyer = BuyerAgent(_buyer);
        (uint256 round, BuyerAgent.Phase phase,) = buyer.getRoundPhase();

        // buyer must be in sell phase
        if (phase != BuyerAgent.Phase.Sell) {
            revert BuyerAgent.InvalidPhase(phase, BuyerAgent.Phase.Sell);
        }

        // buyer must not have more than `maxAssetCount` many assets
        uint256 count = assetsPerBuyerRound[_buyer][round].length;
        if (count >= getCurrentMarketParameters().maxAssetCount) {
            revert AssetLimitExceeded(count);
        }

        // create listing
        listings[_asset] = AssetListing({
            createdAt: block.timestamp,
            royaltyFee: buyer.royaltyFee(),
            price: _price,
            seller: msg.sender,
            status: AssetStatus.Listed,
            buyer: _buyer,
            round: round
        });

        // add this to list of listings for the buyer for this round
        assetsPerBuyerRound[_buyer][round].push(_asset);

        // transfer royalties
        transferRoyalties(listings[_asset]);

        emit AssetRelisted(msg.sender, _buyer, _asset, _price);
    }

    /// @notice Function to transfer the royalties to the seller & Dria.
    function transferRoyalties(AssetListing storage asset) internal {
        // calculate fees
        uint256 buyerFee = (asset.price * asset.royaltyFee) / 100;
        uint256 driaFee = (buyerFee * getCurrentMarketParameters().platformFee) / 100;

        // first, Swan receives the entire fee from seller
        // this allows only one approval from the seller's side
        token.transferFrom(asset.seller, address(this), buyerFee);

        // send the buyer's portion to them
        token.transfer(asset.buyer, buyerFee - driaFee);

        // then it sends the remaining to Swan owner
        token.transfer(owner(), driaFee);
    }

    /// @notice Executes the purchase of a listing for a buyer for the given asset.
    /// @dev Must be called by the buyer of the given asset.
    function purchase(address _asset) external {
        AssetListing storage listing = listings[_asset];

        // asset must be listed to be purchased
        if (listing.status != AssetStatus.Listed) {
            revert InvalidStatus(listing.status, AssetStatus.Listed);
        }

        // can only the buyer can purchase the asset
        if (listing.buyer != msg.sender) {
            revert Unauthorized(msg.sender);
        }

        // update asset status to be sold
        listing.status = AssetStatus.Sold;

        // transfer asset from seller to Swan, and then from Swan to buyer
        // this ensure that only approval to Swan is enough for the sellers
        SwanAsset(_asset).transferFrom(listing.seller, address(this), 1);
        SwanAsset(_asset).transferFrom(address(this), listing.buyer, 1);

        // transfer money
        token.transferFrom(listing.buyer, address(this), listing.price);
        token.transfer(listing.seller, listing.price);

        emit AssetSold(listing.seller, msg.sender, _asset, listing.price);
    }

    /// @notice Returns the asset status with the given asset address.
    /// @dev Active: If the asset has not been purchased or the next round has not started.
    /// @dev Inactive: If the assets's purchaseRound has passed or delisted by the creator of the asset.
    /// @dev Sold: If the asset has already been purchased by the buyer.
    function getListingPrice(address _asset) external view returns (uint256) {
        return listings[_asset].price;
    }

    /// @notice Returns the number of assets with the given buyer and round.
    /// @dev Assets can be assumed to be
    function getListedAssets(address _buyer, uint256 _round) external view returns (address[] memory) {
        return assetsPerBuyerRound[_buyer][_round];
    }

    /// @notice Returns the asset listing with the given asset address.
    function getListing(address _asset) external view returns (AssetListing memory) {
        return listings[_asset];
    }

    /// @notice Creates a new buyer agent.
    /// @dev Emits a `BuyerCreated` event.
    /// @return address of the new buyer agent.
    function createBuyer(
        string calldata _name,
        string calldata _description,
        uint96 _feeRoyalty,
        uint256 _amountPerRound
    ) external returns (BuyerAgent) {
        BuyerAgent agent = buyerAgentFactory.deploy(_name, _description, _feeRoyalty, _amountPerRound, msg.sender);
        emit BuyerCreated(msg.sender, address(agent));

        return agent;
    }
}
