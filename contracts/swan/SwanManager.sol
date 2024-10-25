// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {LLMOracleCoordinator} from "../llm/LLMOracleCoordinator.sol";
import {LLMOracleTaskParameters} from "../llm/LLMOracleTask.sol";
import {BuyerAgentFactory, BuyerAgent} from "./BuyerAgent.sol";
import {SwanAssetFactory, SwanAsset} from "./SwanAsset.sol";

/// @notice Collection of market-related parameters.
/// @dev Prevents stack-too-deep.
/// TODO: use 256-bit tight-packing here
struct SwanMarketParameters {
    /// @notice The interval at which the buyerAgent can withdraw the funds.
    uint256 withdrawInterval;
    /// @notice The interval at which the creators can mint assets.
    uint256 sellInterval;
    /// @notice The interval at which the buyers can buy the assets.
    uint256 buyInterval;
    /// @notice A fee percentage taken from each listing's buyer fee.
    uint256 platformFee;
    /// @notice The maximum number of assets that can be listed per round.
    uint256 maxAssetCount;
    /// @notice Timestamp of the block that this market parameter was added.
    /// @dev Even if this is provided by the user, it will get overwritten by the internal `block.timestamp`.
    uint256 timestamp;
}

contract SwanManager is OwnableUpgradeable {
    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Market parameters such as intervals and fees.
    SwanMarketParameters[] marketParameters;
    /// @notice Oracle parameters such as fees.
    LLMOracleTaskParameters oracleParameters;

    /// @notice Factory contract to deploy Buyer Agents.
    BuyerAgentFactory public buyerAgentFactory;
    /// @notice Factory contract to deploy SwanAsset tokens.
    SwanAssetFactory public swanAssetFactory;
    /// @notice LLM Oracle Coordinator.
    LLMOracleCoordinator public coordinator;
    /// @notice The token to be used for fee payments.
    ERC20 public token;

    /// @notice Operator addresses that can take actions on behalf of Buyer agents,
    /// such as calling `purchase`, or `updateState` for them.
    mapping(address operator => bool) public isOperator;

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

    /// @notice Returns the market parameters in memory.
    function getMarketParameters() external view returns (SwanMarketParameters[] memory) {
        return marketParameters;
    }

    /// @notice Returns the oracle parameters in memory.
    function getOracleParameters() external view returns (LLMOracleTaskParameters memory) {
        return oracleParameters;
    }

    /// @notice Pushes a new market parameters to the marketParameters array.
    /// @dev Only callable by owner.
    /// @param _marketParameters new market parameters
    function setMarketParameters(SwanMarketParameters memory _marketParameters) external onlyOwner {
        require(_marketParameters.platformFee <= 100, "Platform fee cannot exceed 100%");
        _marketParameters.timestamp = block.timestamp;
        marketParameters.push(_marketParameters);
    }

    /// @notice Set the oracle parameters.
    /// @dev Only callable by owner.
    /// @param _oracleParameters new oracle parameters
    function setOracleParameters(LLMOracleTaskParameters calldata _oracleParameters) external onlyOwner {
        oracleParameters = _oracleParameters;
    }

    /// @notice Returns the total fee required to make an oracle request.
    /// @dev This is mainly required by the buyer to calculate its minimum fund amount, so that it can pay the fee.
    function getOracleFee() external view returns (uint256) {
        (uint256 totalFee,,) = coordinator.getFee(oracleParameters);
        return totalFee;
    }
    /// @notice Set the factories for Buyer Agents and Swan Assets.
    /// @dev Only callable by owner.
    /// @param _buyerAgentFactory new BuyerAgentFactory address
    /// @param _swanAssetFactory new SwanAssetFactory address

    function setFactories(address _buyerAgentFactory, address _swanAssetFactory) external onlyOwner {
        buyerAgentFactory = BuyerAgentFactory(_buyerAgentFactory);
        swanAssetFactory = SwanAssetFactory(_swanAssetFactory);
    }

    /*//////////////////////////////////////////////////////////////
                                OPERATORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Adds an operator that can take actions on behalf of Buyer agents.
    /// @dev Only callable by owner.
    /// @dev Has no effect if the operator is already authorized.
    /// @param _operator new operator address
    function addOperator(address _operator) external onlyOwner {
        isOperator[_operator] = true;
    }

    /// @notice Removes an operator, so that they are no longer authorized.
    /// @dev Only callable by owner.
    /// @dev Has no effect if the operator is already not authorized.
    /// @param _operator operator address to remove
    function removeOperator(address _operator) external onlyOwner {
        delete isOperator[_operator];
    }

    /// @notice Returns the current market parameters.
    /// @dev Current market parameters = Last element in the marketParameters array
    function getCurrentMarketParameters() public view returns (SwanMarketParameters memory) {
        return marketParameters[marketParameters.length - 1];
    }
}
