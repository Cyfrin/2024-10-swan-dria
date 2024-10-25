import { expect } from "chai";
import { ethers } from "hardhat";
import type { ERC20, LLMOracleRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { LLMOracleRegistryDeployer } from "./fixtures";
import { transferTokens } from "./helpers";
import { OracleKind } from "./types/enums";
import { parseEther } from "ethers";
import { deployTokenFixture } from "./fixtures/deploy";

describe("LLMOracleRegistry", function () {
  let oracleRegistry: LLMOracleRegistry;
  let oracleRegistryAddress: string;

  const GENERATOR_STAKE = ethers.parseEther("0.1");
  const VALIDATOR_STAKE = ethers.parseEther("0.1");
  const SUPPLY = parseEther("1000");

  let token: ERC20;
  let dria: HardhatEthersSigner;
  let oracle: HardhatEthersSigner;

  this.beforeAll(async function () {
    [dria, oracle] = await ethers.getSigners();

    // deploy and transfer tokens
    token = await deployTokenFixture(dria, SUPPLY);
    await transferTokens(token, [[oracle.address, GENERATOR_STAKE + VALIDATOR_STAKE]]);

    // deploy registry
    oracleRegistry = await loadFixture(
      LLMOracleRegistryDeployer(dria, token, {
        generatorStakeAmount: GENERATOR_STAKE,
        validatorStakeAmount: VALIDATOR_STAKE,
      })
    );
    oracleRegistryAddress = await oracleRegistry.getAddress();
  });

  it("should be deployed correctly", async function () {
    expect(await oracleRegistry.generatorStakeAmount()).to.equal(GENERATOR_STAKE);
    expect(await oracleRegistry.validatorStakeAmount()).to.equal(VALIDATOR_STAKE);
    expect(await oracleRegistry.token()).to.equal(await token.getAddress());
    expect(await oracleRegistry.owner()).to.equal(await dria.getAddress());
  });

  it("should NOT register with insufficient stake", async function () {
    // oracle has the funds but has not approved them
    await expect(oracleRegistry.connect(oracle).register(OracleKind.Generator)).to.revertedWithCustomError(
      oracleRegistry,
      "InsufficientFunds"
    );
  });

  it("should approve the stakes to registry", async function () {
    const amount = GENERATOR_STAKE + VALIDATOR_STAKE;
    await token.connect(oracle).approve(oracleRegistryAddress, amount);
    const allowance = await token.allowance(oracle, oracleRegistryAddress);
    expect(allowance).to.equal(amount);
  });

  it("should register generator oracle", async function () {
    await expect(oracleRegistry.connect(oracle).register(OracleKind.Generator))
      .to.emit(oracleRegistry, "Registered")
      .withArgs(oracle.address, OracleKind.Generator);
    expect(await oracleRegistry.isRegistered(oracle.address, OracleKind.Generator)).to.equal(true);

    // we have not yet registered as a validator
    expect(await oracleRegistry.isRegistered(oracle.address, OracleKind.Validator)).to.equal(false);
  });

  it("should NOT register again as generator", async function () {
    await expect(oracleRegistry.connect(oracle).register(OracleKind.Generator))
      .to.revertedWithCustomError(oracleRegistry, "AlreadyRegistered")
      .withArgs(oracle.address);
  });

  it("should register validator oracle", async function () {
    await expect(oracleRegistry.connect(oracle).register(OracleKind.Validator))
      .to.emit(oracleRegistry, "Registered")
      .withArgs(oracle.address, OracleKind.Validator);

    expect(await oracleRegistry.isRegistered(oracle.address, OracleKind.Validator)).to.equal(true);
  });

  it("should unregister generator oracle", async function () {
    // approval from registry should be zero at first
    expect(await token.allowance(oracleRegistryAddress, oracle.address)).to.equal(0);

    // first unregister as generator
    await expect(oracleRegistry.connect(oracle).unregister(OracleKind.Generator))
      .to.emit(oracleRegistry, "Unregistered")
      .withArgs(oracle.address, OracleKind.Generator);
    expect(await token.allowance(oracleRegistryAddress, oracle.address)).to.equal(GENERATOR_STAKE);
    expect(await oracleRegistry.isRegistered(oracle.address, OracleKind.Generator)).to.equal(false);

    // then unregister as validator
    await expect(oracleRegistry.connect(oracle).unregister(OracleKind.Validator))
      .to.emit(oracleRegistry, "Unregistered")
      .withArgs(oracle.address, OracleKind.Validator);
    expect(await token.allowance(oracleRegistryAddress, oracle.address)).to.equal(GENERATOR_STAKE + VALIDATOR_STAKE);
    expect(await oracleRegistry.isRegistered(oracle.address, OracleKind.Validator)).to.equal(false);
  });

  it("should NOT unregister the same generator oracle", async function () {
    await expect(oracleRegistry.connect(oracle).unregister(OracleKind.Generator))
      .to.revertedWithCustomError(oracleRegistry, "NotRegistered")
      .withArgs(oracle.address);
  });

  it("should withdraw stakes after unregistering", async function () {
    const balanceBefore = await token.balanceOf(oracle.address);

    // transfer the stakes back
    await token.connect(oracle).transferFrom(oracleRegistryAddress, oracle.address, GENERATOR_STAKE + VALIDATOR_STAKE);

    const balanceAfter = await token.balanceOf(oracle.address);
    expect(balanceAfter - balanceBefore).to.equal(GENERATOR_STAKE + VALIDATOR_STAKE);
  });
});
