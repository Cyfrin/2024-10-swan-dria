import { expect } from "chai";
import type { BuyerAgent, ERC20, LLMOracleCoordinator, LLMOracleRegistry, Swan } from "../../typechain-types";
import type { LLMOracleTaskParametersStruct } from "../../typechain-types/contracts/llm/LLMOracleCoordinator";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { encodeBytes32String, keccak256, solidityPacked } from "ethers";
import { OracleKind } from "../types/enums";
import { ethers } from "hardhat";

type AgentParameters = {
  name: string;
  description: string;
  royaltyFee: number;
  amountPerRound: bigint;
  owner: HardhatEthersSigner;
};

// Protocol name given to Oracle requests.
export const ORACLE_PROTOCOL = encodeBytes32String("test/0.0.1");

// Computes `SHA3(taskId, input, requester, responder, nonce)` until the resulting hash is less than the difficulty.
export function mineNonce(
  difficulty: bigint,
  requester: string,
  responder: string,
  input: string,
  taskId: bigint
): bigint {
  const uint256max = BigInt("0x" + "F".repeat(64));
  const target = uint256max >> difficulty;

  // eslint-disable-next-line no-constant-condition
  for (let nonce = BigInt(0); true; nonce++) {
    const message = solidityPacked(
      ["uint256", "bytes", "address", "address", "uint256"],
      [taskId, input, requester, responder, nonce]
    );
    const digest = keccak256(message);

    if (BigInt(digest) < target) {
      return nonce;
    }
  }
}

export async function safeRequest(
  coordinator: LLMOracleCoordinator,
  token: ERC20,
  requester: HardhatEthersSigner,
  taskId: bigint,
  input: string,
  models: string,
  parameters: LLMOracleTaskParametersStruct
) {
  const [totalFee, generatorFee, validatorFee] = await coordinator.getFee(parameters);

  // approve fees & make the request
  await token.connect(requester).approve(await coordinator.getAddress(), totalFee);
  await expect(coordinator.connect(requester).request(ORACLE_PROTOCOL, input, models, parameters))
    .to.emit(coordinator, "Request")
    .withArgs(taskId, requester.address, ORACLE_PROTOCOL);

  const taskRequest = await coordinator.requests(taskId);
  expect(taskRequest.requester).to.equal(requester.address);
  // TODO: check parameters
  expect(taskRequest.input).to.equal(input);
  expect(taskRequest.models).to.equal(models);
  expect(taskRequest.generatorFee).to.equal(generatorFee);
  expect(taskRequest.validatorFee).to.equal(validatorFee);
}

// Responds to a task and checks the response.
export async function safeRespond(
  coordinator: LLMOracleCoordinator,
  generator: HardhatEthersSigner,
  output: string,
  metadata: string,
  taskId: bigint,
  responseId: bigint
) {
  const taskRequest = await coordinator.requests(taskId);
  const nonce = mineNonce(
    taskRequest.parameters.difficulty,
    taskRequest.requester,
    generator.address,
    taskRequest.input,
    taskId
  );

  await expect(coordinator.connect(generator).respond(taskId, nonce, output, metadata))
    .to.emit(coordinator, "Response")
    .withArgs(taskId, generator.address);

  const taskResponse = await coordinator.responses(taskId, responseId);
  expect(taskResponse.responder).to.equal(generator.address);
  expect(taskResponse.nonce).to.equal(nonce);
  expect(taskResponse.output).to.equal(output);
}

// Responds to a generation and checks the validation.
export async function safeValidate(
  coordinator: LLMOracleCoordinator,
  validator: HardhatEthersSigner,
  scores: bigint[],
  metadata: string,
  taskId: bigint,
  validationId: bigint
) {
  const taskRequest = await coordinator.requests(taskId);
  const nonce = mineNonce(
    taskRequest.parameters.difficulty,
    taskRequest.requester,
    validator.address,
    taskRequest.input,
    taskId
  );

  await expect(coordinator.connect(validator).validate(taskId, nonce, scores, metadata))
    .to.emit(coordinator, "Validation")
    .withArgs(taskId, validator.address);

  const taskValidation = await coordinator.validations(taskId, validationId);
  expect(taskValidation.validator).to.equal(validator.address);
  expect(taskValidation.nonce).to.equal(nonce);
}

export async function registerOracles(
  token: ERC20,
  registry: LLMOracleRegistry,
  generators: HardhatEthersSigner[],
  validators: HardhatEthersSigner[],
  stakes: { generatorStakeAmount: bigint; validatorStakeAmount: bigint }
) {
  for (const generator of generators) {
    await token.connect(generator).approve(await registry.getAddress(), stakes.generatorStakeAmount);
    await expect(registry.connect(generator).register(OracleKind.Generator))
      .to.emit(registry, "Registered")
      .withArgs(generator.address, OracleKind.Generator);
  }

  for (const validator of validators) {
    await token.connect(validator).approve(await registry.getAddress(), stakes.validatorStakeAmount);
    await expect(registry.connect(validator).register(OracleKind.Validator))
      .to.emit(registry, "Registered")
      .withArgs(validator.address, OracleKind.Validator);
  }
}

/**
 * Transfer tokens to recipients
 * @param token toke contract instance
 * @param recipients recipients to transfer tokens to, along with their amounts
 * @example
 *
 * const recipients = ["0x1234", 100n] as const;
 * await transferTokens(token.connect(sender), [recipients]);
 */
export async function transferTokens(token: ERC20, recipients: [string, bigint][]) {
  for (const [address, amount] of recipients) {
    await token.transfer(address, amount);
    expect(await token.balanceOf(address)).to.be.greaterThanOrEqual(amount);
  }
}

export async function listAssets(
  swan: Swan,
  buyerAgent: BuyerAgent,
  creators: [HardhatEthersSigner, bigint][],
  name: string,
  symbol: string,
  description: string,
  round: bigint
) {
  // list assets
  for (const [creator, val] of creators) {
    await swan.connect(creator).list(name, symbol, description, val, await buyerAgent.getAddress());
  }

  // get the listed assets
  const assets = await swan.getListedAssets(await buyerAgent.getAddress(), round);
  expect(assets.length).to.equal(creators.length);
}

export async function createBuyers(swan: Swan, buyerAgentParams: AgentParameters[]): Promise<BuyerAgent[]> {
  const buyerAgents: BuyerAgent[] = [];

  for (let i = 0; i < buyerAgentParams.length; i++) {
    // create a buyer agent via swan
    const tx = await swan
      .connect(buyerAgentParams[i].owner)
      .createBuyer(
        buyerAgentParams[i].name,
        buyerAgentParams[i].description,
        buyerAgentParams[i].royaltyFee,
        buyerAgentParams[i].amountPerRound
      );

    const receipt = await tx.wait();

    // get the event from transaction receipt
    const buyerAgentCreatedEvent = receipt?.logs.filter((log) => {
      if ("topics" in log && log.topics.length > 0) {
        return log.topics[0] === swan.interface.getEvent("BuyerCreated").topicHash;
      }
      return false;
    });

    // get the buyer agent address from the event by decoding logs
    if (buyerAgentCreatedEvent) {
      const [buyerAgentOwner, buyerAgentAddress] = swan.interface.decodeEventLog(
        "BuyerCreated",
        buyerAgentCreatedEvent[0].data,
        buyerAgentCreatedEvent[0].topics
      );

      // get the buyer agent contract from the address
      const buyerAgent = (await ethers.getContractAt("BuyerAgent", buyerAgentAddress)) as BuyerAgent;

      // check the agent owner is correct
      expect(buyerAgentOwner).to.equal(buyerAgentParams[i].owner.address);
      expect(buyerAgentOwner).to.equal(await buyerAgent.owner());

      // check the agent params created correctly
      expect(await buyerAgent.name()).to.equal(buyerAgentParams[i].name);
      expect(await buyerAgent.description()).to.equal(buyerAgentParams[i].description);
      expect(await buyerAgent.royaltyFee()).to.equal(buyerAgentParams[i].royaltyFee);
      expect(await buyerAgent.amountPerRound()).to.equal(buyerAgentParams[i].amountPerRound);

      // push the buyer agent contract to the array
      buyerAgents.push(buyerAgent);
    }
  }
  return buyerAgents;
}
