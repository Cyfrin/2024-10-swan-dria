// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @notice The type of Oracle.
enum LLMOracleKind {
    Generator,
    Validator
}

/// @title LLM Oracle Registry
/// @notice Holds the addresses that are eligible to respond to LLM requests.
/// @dev There may be several types of oracle kinds, and each require their own stake.
contract LLMOracleRegistry is OwnableUpgradeable, UUPSUpgradeable {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice The Oracle response to an LLM generation request.
    event Registered(address indexed, LLMOracleKind kind);

    /// @notice The Oracle response to an LLM generation request.
    event Unregistered(address indexed, LLMOracleKind kind);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice The user is not registered.
    error NotRegistered(address);

    /// @notice The user is already registered.
    error AlreadyRegistered(address);

    /// @notice Insufficient stake amount during registration.
    error InsufficientFunds();

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Stake amount to be registered as an Oracle that can serve generation requests.
    uint256 public generatorStakeAmount;

    /// @notice Stake amount to be registered as an Oracle that can serve validation requests.
    uint256 public validatorStakeAmount;

    /// @notice Registrations per address & kind. If amount is 0, it is not registered.
    mapping(address oracle => mapping(LLMOracleKind => uint256 amount)) public registrations;

    /// @notice Token used for staking.
    ERC20 public token;

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

    /// @notice Function that should revert when `msg.sender` is not authorized to upgrade the contract.
    /// @dev Called by and upgradeToAndCall.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @dev Sets the owner to be the deployer, sets initial stake amount.
    function initialize(uint256 _generatorStakeAmount, uint256 _validatorStakeAmount, address _token)
        public
        initializer
    {
        __Ownable_init(msg.sender);
        generatorStakeAmount = _generatorStakeAmount;
        validatorStakeAmount = _validatorStakeAmount;
        token = ERC20(_token);
    }

    /*//////////////////////////////////////////////////////////////
                                  LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Register an Oracle.
    /// @dev Reverts if the user is already registered or has insufficient funds.
    /// @param kind The kind of Oracle to unregister.
    function register(LLMOracleKind kind) public {
        uint256 amount = getStakeAmount(kind);

        // ensure the user is not already registered
        if (isRegistered(msg.sender, kind)) {
            revert AlreadyRegistered(msg.sender);
        }

        // ensure the user has enough allowance to stake
        if (token.allowance(msg.sender, address(this)) < amount) {
            revert InsufficientFunds();
        }
        token.transferFrom(msg.sender, address(this), amount);

        // register the user
        registrations[msg.sender][kind] = amount;
        emit Registered(msg.sender, kind);
    }

    /// @notice Remove registration of an Oracle.
    /// @dev Reverts if the user is not registered.
    /// @param kind The kind of Oracle to unregister.
    /// @return amount Amount of stake approved back.
    function unregister(LLMOracleKind kind) public returns (uint256 amount) {
        amount = registrations[msg.sender][kind];

        // ensure the user is registered
        if (amount == 0) {
            revert NotRegistered(msg.sender);
        }

        // unregister the user
        delete registrations[msg.sender][kind];
        emit Unregistered(msg.sender, kind);

        // approve its stake back
        token.approve(msg.sender, token.allowance(address(this), msg.sender) + amount);
    }

    /// @notice Set the stake amount required to register as an Oracle.
    /// @dev Only allowed by the owner.
    function setStakeAmounts(uint256 _generatorStakeAmount, uint256 _validatorStakeAmount) public onlyOwner {
        generatorStakeAmount = _generatorStakeAmount;
        validatorStakeAmount = _validatorStakeAmount;
    }

    /// @notice Returns the stake amount required to register as an Oracle w.r.t given kind.
    function getStakeAmount(LLMOracleKind kind) public view returns (uint256) {
        return kind == LLMOracleKind.Generator ? generatorStakeAmount : validatorStakeAmount;
    }

    /// @notice Check if an Oracle is registered.
    function isRegistered(address user, LLMOracleKind kind) public view returns (bool) {
        return registrations[user][kind] != 0;
    }
}
