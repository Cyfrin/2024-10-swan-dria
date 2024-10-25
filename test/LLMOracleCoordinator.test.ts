import { expect } from "chai";
import { ethers } from "hardhat";
import type { ERC20, LLMOracleCoordinator, LLMOracleRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther } from "ethers";
import { deployLLMFixture, deployTokenFixture } from "./fixtures/deploy";
import { registerOracles, safeRequest, safeRespond, safeValidate } from "./helpers";
import { OracleKind, TaskStatus } from "./types/enums";
import { transferTokens } from "./helpers";

/**
 * Test scenario:
 *
 * There are 3 generators, only 2 responses required in total.
 *
 * - Generator #1 responds to the request
 * - Generator #1 fails to respond again because it already responded
 * - Generator #2 responds to the request
 * - Generator #3 tries to respond (should fail because generation phase has ended)
 */
describe("LLMOracleCoordinator", function () {
  let dria: HardhatEthersSigner;
  let requester: HardhatEthersSigner;
  let generators: HardhatEthersSigner[];
  let validators: HardhatEthersSigner[];
  let dummy: HardhatEthersSigner; // just an outsider

  let coordinator: LLMOracleCoordinator;
  let registry: LLMOracleRegistry;
  let token: ERC20;

  let coordinatorAddress: string;
  let registryAddress: string;

  let taskId = 0n; // this will be updated throughout the test

  /// mock LLM input & output
  const input = "0x" + Buffer.from("What is 2 + 2?").toString("hex");
  const output = "0x" + Buffer.from("2 + 2 equals 4.").toString("hex");
  const models = "0x" + Buffer.from("gpt-4o-mini").toString("hex");
  const metadata = "0x"; // empty metadata
  const difficulty = 2;
  const SUPPLY = parseEther("1000");

  const STAKES = {
    generatorStakeAmount: parseEther("0.01"),
    validatorStakeAmount: parseEther("0.01"),
  };

  const FEES = {
    platformFee: parseEther("0.001"),
    generationFee: parseEther("0.002"),
    validationFee: parseEther("0.0003"),
  };

  this.beforeAll(async function () {
    // assign roles, full = oracle that can do both generation & validation
    const [deployer, dum, req1, gen1, gen2, gen3, val1, val2] = await ethers.getSigners();
    dria = deployer;
    requester = req1;
    dummy = dum;
    generators = [gen1, gen2, gen3];
    validators = [val1, val2];

    token = await deployTokenFixture(deployer, SUPPLY);

    ({ registry, coordinator } = await deployLLMFixture(dria, token, STAKES, FEES));

    const requesterFunds = parseEther("1");
    await transferTokens(token, [
      [requester.address, requesterFunds],

      // each oracle should have at least the stake amount
      ...generators.map<[string, bigint]>((oracle) => [oracle.address, STAKES.generatorStakeAmount]),
      ...validators.map<[string, bigint]>((oracle) => [oracle.address, STAKES.validatorStakeAmount]),
    ]);

    registryAddress = await registry.getAddress();
    coordinatorAddress = await coordinator.getAddress();
  });

  it("should register oracles", async function () {
    await registerOracles(token, registry, generators, validators, STAKES);
  });

  describe("without validation", function () {
    const [numGenerations, numValidations] = [2, 0];
    let generatorAllowancesBefore: bigint[];

    this.beforeAll(async () => {
      taskId++;
      generatorAllowancesBefore = await Promise.all(
        generators.map((g) => token.allowance(coordinatorAddress, g.address))
      );
    });

    it("should make a request", async function () {
      await safeRequest(coordinator, token, requester, taskId, input, models, {
        difficulty,
        numGenerations,
        numValidations,
      });
    });

    it("should NOT respond if not a registered Oracle", async function () {
      const generator = dummy;

      await expect(safeRespond(coordinator, generator, output, metadata, taskId, 0n))
        .to.revertedWithCustomError(coordinator, "NotRegistered")
        .withArgs(generator.address);
    });

    it("should respond (1/2) to a request only once", async function () {
      // using the first generator
      const generator = generators[0];
      await safeRespond(coordinator, generator, output, metadata, taskId, 0n);

      // should NOT respond again
      await expect(safeRespond(coordinator, generator, output, metadata, taskId, 0n))
        .to.be.revertedWithCustomError(coordinator, "AlreadyResponded")
        .withArgs(taskId, generator.address);
    });

    it("should respond (2/2)", async function () {
      // use the second generator
      const generator = generators[1];
      await safeRespond(coordinator, generator, output, metadata, taskId, 1n);
    });

    it("should NOT respond if task is not pending generation", async function () {
      // this time we use the other generator
      const generator = generators[2];

      await expect(safeRespond(coordinator, generator, output, metadata, taskId, 2n))
        .to.revertedWithCustomError(coordinator, "InvalidTaskStatus")
        .withArgs(taskId, TaskStatus.Completed, TaskStatus.PendingGeneration);
    });

    it("should NOT respond to a non-existent request", async function () {
      const generator = generators[0];
      const nonExistentTaskId = 999n;

      await expect(safeRespond(coordinator, generator, output, metadata, nonExistentTaskId, 0n))
        .to.revertedWithCustomError(coordinator, "InvalidTaskStatus")
        .withArgs(nonExistentTaskId, TaskStatus.None, TaskStatus.PendingGeneration);
    });

    it("should see rewards", async function () {
      const task = await coordinator.requests(taskId);

      // no validation here, just generators
      for (let i = 0; i < numGenerations; i++) {
        const allowance = await token.allowance(coordinatorAddress, generators[i].address);
        expect(allowance - generatorAllowancesBefore[i]).to.equal(task.generatorFee);
      }
    });
  });

  describe("with validation", function () {
    const [numGenerations, numValidations] = [2, 2];
    const dummyScore = parseEther("0.9");
    const scores = Array.from({ length: numGenerations }, () => dummyScore);
    let generatorAllowancesBefore: bigint[];
    let validatorAllowancesBefore: bigint[];

    this.beforeAll(async () => {
      taskId++;

      generatorAllowancesBefore = await Promise.all(
        generators.map((g) => token.allowance(coordinatorAddress, g.address))
      );
      validatorAllowancesBefore = await Promise.all(
        validators.map((v) => token.allowance(coordinatorAddress, v.address))
      );
    });

    it("should make a request", async function () {
      await safeRequest(coordinator, token, requester, taskId, input, models, {
        difficulty,
        numGenerations,
        numValidations,
      });
    });

    it("should respond (1/2 & 2/2)", async function () {
      for (let i = 0; i < numGenerations; i++) {
        await safeRespond(coordinator, generators[i], output, metadata, taskId, BigInt(i));
      }
    });

    it("should NOT respond if task is not pending generation", async function () {
      // this time we use the other generator
      const generator = generators[2];

      await expect(safeRespond(coordinator, generator, output, metadata, taskId, 2n))
        .to.revertedWithCustomError(coordinator, "InvalidTaskStatus")
        .withArgs(taskId, TaskStatus.PendingValidation, TaskStatus.PendingGeneration);
    });

    it("should NOT validate if not a registered Oracle", async function () {
      const generator = dummy;

      await expect(safeValidate(coordinator, generator, scores, metadata, taskId, 0n))
        .to.revertedWithCustomError(coordinator, "NotRegistered")
        .withArgs(generator.address);
    });

    it("should validate (1/2) a generation only once", async function () {
      const validator = validators[0];
      await safeValidate(coordinator, validator, scores, metadata, taskId, 0n);

      // should NOT respond again
      await expect(safeValidate(coordinator, validator, scores, metadata, taskId, 0n))
        .to.be.revertedWithCustomError(coordinator, "AlreadyResponded")
        .withArgs(taskId, validator.address);
    });

    it("should validate (2/2)", async function () {
      const validator = validators[1];
      await safeValidate(coordinator, validator, scores, metadata, taskId, 1n);

      const request = await coordinator.requests(taskId);
      expect(request.status).to.equal(TaskStatus.Completed);
    });

    it("should see generation scores", async function () {
      for (let i = 0; i < numGenerations; i++) {
        const response = await coordinator.responses(taskId, BigInt(i));
        expect(response.score).to.deep.equal(dummyScore); // score was hardcoded within the test
      }
    });

    it("should see rewards", async function () {
      const task = await coordinator.requests(taskId);

      // generators should have received the generator fee
      for (let i = 0; i < numGenerations; i++) {
        const allowance = await token.allowance(coordinatorAddress, generators[i].address);
        expect(allowance - generatorAllowancesBefore[i]).to.equal(task.generatorFee);
      }

      // validators should have received the validator fee per generation
      for (let i = 0; i < numValidations; i++) {
        const allowance = await token.allowance(coordinatorAddress, validators[i].address);
        expect(allowance - validatorAllowancesBefore[i]).to.equal(task.validatorFee * BigInt(numGenerations));
      }
    });
  });

  describe("validation edge case: validator is generator", function () {
    const [numGenerations, numValidations] = [1, 1];
    const dummyScore = parseEther("0.9");
    const scores = Array.from({ length: numGenerations }, () => dummyScore);

    let oracle: HardhatEthersSigner;
    this.beforeAll(async () => {
      taskId++;

      // fund the first generator & register it as validator as well
      oracle = generators[0];
    });

    it("should register generator as validator as well", async function () {
      await token.connect(dria).transfer(oracle.address, STAKES.validatorStakeAmount);
      await token.connect(oracle).approve(registryAddress, STAKES.validatorStakeAmount);
      await expect(registry.connect(oracle).register(OracleKind.Validator))
        .to.emit(registry, "Registered")
        .withArgs(oracle.address, OracleKind.Validator);
    });

    it("should make a request", async function () {
      await safeRequest(coordinator, token, requester, taskId, input, models, {
        difficulty,
        numGenerations,
        numValidations,
      });
    });

    it("should respond as generator", async function () {
      await safeRespond(coordinator, oracle, output, metadata, taskId, 0n);
    });

    it("should NOT validate if already participated in generation", async function () {
      // a generator tries to act like a validator
      const validator = generators[0];

      await expect(safeValidate(coordinator, validator, scores, metadata, taskId, 0n))
        .to.be.revertedWithCustomError(coordinator, "AlreadyResponded")
        .withArgs(taskId, validator.address);
    });
  });
});
