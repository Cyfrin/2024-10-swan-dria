// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {LLMOracleTaskParameters} from "./LLMOracleTask.sol";

/// @title LLM Oracle Manager
/// @notice Holds the configuration for the LLM Oracle, such as allowed bounds on difficulty,
/// number of generations & validations, and fee settings.

contract LLMOracleManager is OwnableUpgradeable {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Given parameter is out of range.
    error InvalidParameterRange(uint256 have, uint256 min, uint256 max);

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice A fixed fee paid for the platform.
    uint256 public platformFee;
    /// @notice The base fee factor for a generation of LLM generation.
    /// @dev When scaled with difficulty & number of generations, we denote it as `generatorFee`.
    uint256 public generationFee;
    /// @notice The base fee factor for a generation of LLM validation.
    /// @dev When scaled with difficulty & number of validations, we denote it as `validatorFee`.
    uint256 public validationFee;

    /// @notice The deviation factor for the validation scores.
    uint64 public validationDeviationFactor;
    /// @notice The deviation factor for the generation scores.
    uint64 public generationDeviationFactor;

    /// @notice Minimums for oracle parameters.
    LLMOracleTaskParameters minimumParameters;
    /// @notice Maximums for oracle parameters.
    LLMOracleTaskParameters maximumParameters;

    /*//////////////////////////////////////////////////////////////
                                UPGRADABLE
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize the contract.
    function __LLMOracleManager_init(uint256 _platformFee, uint256 _generationFee, uint256 _validationFee)
        internal
        onlyInitializing
    {
        minimumParameters = LLMOracleTaskParameters({difficulty: 1, numGenerations: 1, numValidations: 0});
        maximumParameters = LLMOracleTaskParameters({difficulty: 10, numGenerations: 10, numValidations: 10});

        validationDeviationFactor = 2;
        generationDeviationFactor = 1;

        setFees(_platformFee, _generationFee, _validationFee);
    }

    /*//////////////////////////////////////////////////////////////
                                  LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Modifier to check if the given parameters are within the allowed range.
    modifier onlyValidParameters(LLMOracleTaskParameters calldata parameters) {
        if (
            parameters.difficulty < minimumParameters.difficulty || parameters.difficulty > maximumParameters.difficulty
        ) {
            revert InvalidParameterRange(
                parameters.difficulty, minimumParameters.difficulty, maximumParameters.difficulty
            );
        }

        if (
            parameters.numGenerations < minimumParameters.numGenerations
                || parameters.numGenerations > maximumParameters.numGenerations
        ) {
            revert InvalidParameterRange(
                parameters.numGenerations, minimumParameters.numGenerations, maximumParameters.numGenerations
            );
        }

        if (
            parameters.numValidations < minimumParameters.numValidations
                || parameters.numValidations > maximumParameters.numValidations
        ) {
            revert InvalidParameterRange(
                parameters.numValidations, minimumParameters.numValidations, maximumParameters.numValidations
            );
        }
        _;
    }

    /// @notice Update Oracle fees.
    /// @dev To keep a fee unchanged, provide the same value.
    /// @param _platformFee The new platform fee
    /// @param _generationFee The new generation fee
    /// @param _validationFee The new validation fee
    function setFees(uint256 _platformFee, uint256 _generationFee, uint256 _validationFee) public onlyOwner {
        platformFee = _platformFee;
        generationFee = _generationFee;
        validationFee = _validationFee;
    }

    /// @notice Get the total fee for a given task setting.
    /// @param parameters The task parameters.
    /// @return totalFee The total fee for the task.
    /// @return generatorFee The fee paid to each generator per generation.
    /// @return validatorFee The fee paid to each validator per validated generation.
    function getFee(LLMOracleTaskParameters calldata parameters)
        public
        view
        returns (uint256 totalFee, uint256 generatorFee, uint256 validatorFee)
    {
        uint256 diff = (2 << uint256(parameters.difficulty));
        generatorFee = diff * generationFee;
        validatorFee = diff * validationFee;
        totalFee =
            platformFee + (parameters.numGenerations * (generatorFee + (parameters.numValidations * validatorFee)));
    }

    /// @notice Update Oracle parameters bounds.
    /// @dev Provide the same value to keep it unchanged.
    /// @param minimums The new minimum parameters.
    /// @param maximums The new maximum parameters.
    function setParameters(LLMOracleTaskParameters calldata minimums, LLMOracleTaskParameters calldata maximums)
        public
        onlyOwner
    {
        minimumParameters = minimums;
        maximumParameters = maximums;
    }

    /// @notice Update deviation factors.
    /// @dev Provide the same value to keep it unchanged.
    /// @param _generationDeviationFactor The new generation deviation factor.
    /// @param _validationDeviationFactor The new validation deviation factor.
    function setDeviationFactors(uint64 _generationDeviationFactor, uint64 _validationDeviationFactor)
        public
        onlyOwner
    {
        generationDeviationFactor = _generationDeviationFactor;
        validationDeviationFactor = _validationDeviationFactor;
    }
}
