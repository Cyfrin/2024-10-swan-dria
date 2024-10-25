// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {LLMOracleRegistry, LLMOracleKind} from "./LLMOracleRegistry.sol";
import {LLMOracleTask, LLMOracleTaskParameters} from "./LLMOracleTask.sol";
import {LLMOracleManager} from "./LLMOracleManager.sol";
import {Statistics} from "../libraries/Statistics.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title LLM Oracle Coordinator
/// @notice Responsible for coordinating the Oracle responses to LLM generation requests.
contract LLMOracleCoordinator is LLMOracleTask, LLMOracleManager, UUPSUpgradeable {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Indicates a generation request for LLM.
    /// @dev `protocol` is a short 32-byte string (e.g., "dria/1.0.0").
    /// @dev Using the protocol topic, listeners can filter by protocol.
    event Request(uint256 indexed taskId, address indexed requester, bytes32 indexed protocol);

    /// @notice Indicates a single Oracle response for a request.
    event Response(uint256 indexed taskId, address indexed responder);

    /// @notice Indicates a single Oracle response for a request.
    event Validation(uint256 indexed taskId, address indexed validator);

    /// @notice Indicates the status change of an LLM generation request.
    event StatusUpdate(
        uint256 indexed taskId, bytes32 indexed protocol, TaskStatus statusBefore, TaskStatus statusAfter
    );

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Not enough funds were provided for the task.
    error InsufficientFees(uint256 have, uint256 want);

    /// @notice Unexpected status for this task.
    error InvalidTaskStatus(uint256 taskId, TaskStatus have, TaskStatus want);

    /// @notice The given nonce is not a valid proof-of-work.
    error InvalidNonce(uint256 taskId, uint256 nonce);

    /// @notice The provided validation does not have a score for all responses.
    error InvalidValidation(uint256 taskId, address validator);

    /// @notice The oracle is not registered.
    error NotRegistered(address oracle);

    /// @notice The oracle has already responded to this task.
    error AlreadyResponded(uint256 taskId, address oracle);

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The Oracle Registry.
    LLMOracleRegistry public registry;
    /// @notice The token to be used for fee payments.
    ERC20 public feeToken;

    /// @notice The task ID counter.
    /// @dev TaskId starts from 1, as 0 is reserved.
    /// @dev 0 can be used in to check that a request/response/validation has not been made.
    uint256 public nextTaskId;
    /// @notice LLM generation requests.
    mapping(uint256 taskId => TaskRequest) public requests;
    /// @notice LLM generation responses.
    mapping(uint256 taskId => TaskResponse[]) public responses;
    /// @notice LLM generation response validations.
    mapping(uint256 taskId => TaskValidation[]) public validations;

    /*//////////////////////////////////////////////////////////////
                                 MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Reverts if `msg.sender` is not a registered oracle.
    modifier onlyRegistered(LLMOracleKind kind) {
        if (!registry.isRegistered(msg.sender, kind)) {
            revert NotRegistered(msg.sender);
        }
        _;
    }

    /// @notice Reverts if the task status is not `status`.
    modifier onlyAtStatus(uint256 taskId, TaskStatus status) {
        if (requests[taskId].status != status) {
            revert InvalidTaskStatus(taskId, requests[taskId].status, status);
        }
        _;
    }

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
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // `onlyOwner` modifier does the auth here
    }

    /// @notice Initialize the contract.
    /// @notice Sets the Oracle Registry & Oracle Fee Manager.
    /// @param _oracleRegistry The Oracle Registry contract address.
    /// @param _feeToken The token (ERC20) to be used for fee payments (usually $BATCH).
    /// @param _platformFee The initial platform fee for each LLM generation.
    /// @param _generationFee The initial base fee for LLM generation.
    /// @param _validationFee The initial base fee for response validation.
    function initialize(
        address _oracleRegistry,
        address _feeToken,
        uint256 _platformFee,
        uint256 _generationFee,
        uint256 _validationFee
    ) public initializer {
        __Ownable_init(msg.sender);
        __LLMOracleManager_init(_platformFee, _generationFee, _validationFee);
        registry = LLMOracleRegistry(_oracleRegistry);
        feeToken = ERC20(_feeToken);
        nextTaskId = 1;
    }

    /*//////////////////////////////////////////////////////////////
                                  LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Request LLM generation.
    /// @dev Input must be non-empty.
    /// @dev Reverts if contract has not enough allowance for the fee.
    /// @dev Reverts if difficulty is out of range.
    /// @param protocol The protocol string, should be a short 32-byte string (e.g., "dria/1.0.0").
    /// @param input The input data for the LLM generation.
    /// @param parameters The task parameters
    /// @return task id
    function request(
        bytes32 protocol,
        bytes memory input,
        bytes memory models,
        LLMOracleTaskParameters calldata parameters
    ) public onlyValidParameters(parameters) returns (uint256) {
        (uint256 totalfee, uint256 generatorFee, uint256 validatorFee) = getFee(parameters);

        // check allowance requirements
        uint256 allowance = feeToken.allowance(msg.sender, address(this));
        if (allowance < totalfee) {
            revert InsufficientFees(allowance, totalfee);
        }

        // ensure there is enough balance
        uint256 balance = feeToken.balanceOf(msg.sender);
        if (balance < totalfee) {
            revert InsufficientFees(balance, totalfee);
        }

        // transfer tokens
        feeToken.transferFrom(msg.sender, address(this), totalfee);

        // increment the task id for later tasks & emit task request event
        uint256 taskId = nextTaskId;
        unchecked {
            ++nextTaskId;
        }
        emit Request(taskId, msg.sender, protocol);

        // push request & emit status update for the task
        requests[taskId] = TaskRequest({
            requester: msg.sender,
            protocol: protocol,
            input: input,
            parameters: parameters,
            status: TaskStatus.PendingGeneration,
            generatorFee: generatorFee,
            validatorFee: validatorFee,
            platformFee: platformFee,
            models: models
        });
        emit StatusUpdate(taskId, protocol, TaskStatus.None, TaskStatus.PendingGeneration);

        return taskId;
    }

    /// @notice Respond to an LLM generation.
    /// @dev Output must be non-empty.
    /// @dev Reverts if the task is not pending generation.
    /// @dev Reverts if the responder is not registered.
    /// @dev Reverts if the responder has already responded to this task.
    /// @dev Reverts if the nonce is not a valid proof-of-work.
    /// @param taskId The task ID to respond to.
    /// @param nonce The proof-of-work nonce.
    /// @param output The output data for the LLM generation.
    /// @param metadata Optional metadata for this output.
    function respond(uint256 taskId, uint256 nonce, bytes calldata output, bytes calldata metadata)
        public
        onlyRegistered(LLMOracleKind.Generator)
        onlyAtStatus(taskId, TaskStatus.PendingGeneration)
    {
        TaskRequest storage task = requests[taskId];

        // ensure responder to be unique for this task
        for (uint256 i = 0; i < responses[taskId].length; i++) {
            if (responses[taskId][i].responder == msg.sender) {
                revert AlreadyResponded(taskId, msg.sender);
            }
        }

        // check nonce (proof-of-work)
        assertValidNonce(taskId, task, nonce);

        // push response
        TaskResponse memory response =
            TaskResponse({responder: msg.sender, nonce: nonce, output: output, metadata: metadata, score: 0});
        responses[taskId].push(response);

        // emit response events
        emit Response(taskId, msg.sender);

        // send rewards to the generator if there is no validation
        if (task.parameters.numValidations == 0) {
            _increaseAllowance(msg.sender, task.generatorFee);
        }

        // check if we have received enough responses & update task status
        bool isCompleted = responses[taskId].length == uint256(task.parameters.numGenerations);
        if (isCompleted) {
            if (task.parameters.numValidations == 0) {
                // no validations required, task is completed
                task.status = TaskStatus.Completed;
                emit StatusUpdate(taskId, task.protocol, TaskStatus.PendingGeneration, TaskStatus.Completed);
            } else {
                // now we are waiting for validations
                task.status = TaskStatus.PendingValidation;
                emit StatusUpdate(taskId, task.protocol, TaskStatus.PendingGeneration, TaskStatus.PendingValidation);
            }
        }
    }

    /// @notice Validate requests for a given taskId.
    /// @dev Reverts if the task is not pending validation.
    /// @dev Reverts if the number of scores is not equal to the number of generations.
    /// @dev Reverts if any score is greater than the maximum score.
    /// @param taskId The ID of the task to validate.
    /// @param nonce The proof-of-work nonce.
    /// @param scores The validation scores for each generation.
    /// @param metadata Optional metadata for this validation.
    function validate(uint256 taskId, uint256 nonce, uint256[] calldata scores, bytes calldata metadata)
        public
        onlyRegistered(LLMOracleKind.Validator)
        onlyAtStatus(taskId, TaskStatus.PendingValidation)
    {
        TaskRequest storage task = requests[taskId];

        // ensure there is a score for each generation
        if (scores.length != task.parameters.numGenerations) {
            revert InvalidValidation(taskId, msg.sender);
        }

        // ensure validator did not participate in generation
        for (uint256 i = 0; i < task.parameters.numGenerations; i++) {
            if (responses[taskId][i].responder == msg.sender) {
                revert AlreadyResponded(taskId, msg.sender);
            }
        }

        // ensure validator to be unique for this task
        for (uint256 i = 0; i < validations[taskId].length; i++) {
            if (validations[taskId][i].validator == msg.sender) {
                revert AlreadyResponded(taskId, msg.sender);
            }
        }

        // check nonce (proof-of-work)
        assertValidNonce(taskId, task, nonce);

        // update validation scores
        validations[taskId].push(
            TaskValidation({scores: scores, nonce: nonce, metadata: metadata, validator: msg.sender})
        );

        // emit validation event
        emit Validation(taskId, msg.sender);

        // update completion status
        bool isCompleted = validations[taskId].length == task.parameters.numValidations;
        if (isCompleted) {
            task.status = TaskStatus.Completed;
            emit StatusUpdate(taskId, task.protocol, TaskStatus.PendingValidation, TaskStatus.Completed);

            // finalize validation scores
            finalizeValidation(taskId);
        }
    }

    /// @notice Checks that proof-of-work is valid for a given task with taskId and nonce.
    /// @dev Reverts if the nonce is not a valid proof-of-work.
    /// @param taskId The ID of the task to check proof-of-work.
    /// @param task The task (in storage) to validate.
    /// @param nonce The candidate proof-of-work nonce.
    function assertValidNonce(uint256 taskId, TaskRequest storage task, uint256 nonce) internal view {
        bytes memory message = abi.encodePacked(taskId, task.input, task.requester, msg.sender, nonce);
        if (uint256(keccak256(message)) > type(uint256).max >> uint256(task.parameters.difficulty)) {
            revert InvalidNonce(taskId, nonce);
        }
    }

    /// @notice Compute the validation scores for a given task.
    /// @dev Reverts if the task has no validations.
    /// @param taskId The ID of the task to compute scores for.
    function finalizeValidation(uint256 taskId) private {
        TaskRequest storage task = requests[taskId];

        // compute score for each generation
        for (uint256 g_i = 0; g_i < task.parameters.numGenerations; g_i++) {
            // get the scores for this generation, i.e. the g_i-th element of each validation
            uint256[] memory scores = new uint256[](task.parameters.numValidations);
            for (uint256 v_i = 0; v_i < task.parameters.numValidations; v_i++) {
                scores[v_i] = validations[taskId][v_i].scores[g_i];
            }

            // compute the mean and standard deviation
            (uint256 _stddev, uint256 _mean) = Statistics.stddev(scores);

            // compute the score for this generation as the "inner-mean"
            // and send rewards to validators that are within the range
            uint256 innerSum = 0;
            uint256 innerCount = 0;
            for (uint256 v_i = 0; v_i < task.parameters.numValidations; ++v_i) {
                uint256 score = scores[v_i];
                if ((score >= _mean - _stddev) && (score <= _mean + _stddev)) {
                    innerSum += score;
                    innerCount++;

                    // send validation fee to the validator
                    _increaseAllowance(validations[taskId][v_i].validator, task.validatorFee);
                }
            }

            // set score for this generation as the average of inner scores
            uint256 inner_score = innerCount == 0 ? 0 : innerSum / innerCount;
            responses[taskId][g_i].score = inner_score;
        }

        // now, we have the scores for each generation
        // compute stddev for these and pick the ones above a threshold
        uint256[] memory generationScores = new uint256[](task.parameters.numGenerations);
        for (uint256 g_i = 0; g_i < task.parameters.numGenerations; g_i++) {
            generationScores[g_i] = responses[taskId][g_i].score;
        }

        // compute the mean and standard deviation
        (uint256 stddev, uint256 mean) = Statistics.stddev(generationScores);
        for (uint256 g_i = 0; g_i < task.parameters.numGenerations; g_i++) {
            // ignore lower outliers
            if (generationScores[g_i] >= mean - generationDeviationFactor * stddev) {
                _increaseAllowance(responses[taskId][g_i].responder, task.generatorFee);
            }
        }
    }

    /// @notice Withdraw the platform fees & along with remaining fees within the contract.
    function withdrawPlatformFees() public onlyOwner {
        feeToken.transfer(owner(), feeToken.balanceOf(address(this)));
    }

    /// @notice Returns the responses to a given taskId.
    /// @param taskId The ID of the task to get responses for.
    /// @return The responses for the given taskId.
    function getResponses(uint256 taskId) public view returns (TaskResponse[] memory) {
        return responses[taskId];
    }

    /// @notice Returns the validations to a given taskId.
    /// @param taskId The ID of the task to get validations for.
    /// @return The validations for the given taskId.
    function getValidations(uint256 taskId) public view returns (TaskValidation[] memory) {
        return validations[taskId];
    }

    /// Increases the allowance by setting the approval to the sum of the current allowance and the additional amount.
    /// @param spender spender address
    /// @param amount additional amount of allowance
    function _increaseAllowance(address spender, uint256 amount) internal {
        feeToken.approve(spender, feeToken.allowance(address(this), spender) + amount);
    }

    /// @notice Returns the best performing result of the given task.
    /// @dev For invalid task IDs, the status check will fail.
    /// @param taskId The ID of the task to get the result for.
    /// @return The best performing response w.r.t validation scores.
    function getBestResponse(uint256 taskId) external view returns (TaskResponse memory) {
        TaskResponse[] storage taskResponses = responses[taskId];

        // ensure that task is completed
        if (requests[taskId].status != LLMOracleTask.TaskStatus.Completed) {
            revert InvalidTaskStatus(taskId, requests[taskId].status, LLMOracleTask.TaskStatus.Completed);
        }

        // pick the result with the highest validation score
        TaskResponse storage result = taskResponses[0];
        uint256 highestScore = result.score;
        for (uint256 i = 1; i < taskResponses.length; i++) {
            if (taskResponses[i].score > highestScore) {
                highestScore = taskResponses[i].score;
                result = taskResponses[i];
            }
        }

        return result;
    }
}
