import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ERC20, Swan, BuyerAgent, LLMOracleCoordinator, LLMOracleRegistry } from "../typechain-types";
import { deployTokenFixture, deploySwanFixture, deployFactoriesFixture } from "./fixtures/deploy";
import { Phase, AssetStatus } from "./types/enums";
import { expect } from "chai";
import { ethers } from "hardhat";
import { transferTokens, listAssets, safeRespond, registerOracles, safeValidate, createBuyers } from "./helpers";
import { parseEther, AbiCoder } from "ethers";
import { SwanMarketParametersStruct } from "../typechain-types/contracts/swan/Swan";
import { minutes } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

/**
 * Test scenario:
 *
 * 2 buyers, 5 assets
 * - Sell round #1: 5 assets are listed
 * - Buy round #1: 1 asset is bought
 * - Withdraw round #1
 * - Sell round #2: 1 asset is relisted
 *
 * Note that increasing the times within `beforeAll` does NOT work! It must be done within `it` following a sequence.
 */
describe("Swan", function () {
  let swan: Swan;
  let token: ERC20;
  let dria: HardhatEthersSigner;

  // oracle stuff
  let registry: LLMOracleRegistry;
  let coordinator: LLMOracleCoordinator;
  let generator: HardhatEthersSigner;
  let validator: HardhatEthersSigner;

  // buyers
  let buyer: HardhatEthersSigner;
  let buyerAgent: BuyerAgent;
  let buyerToFail: HardhatEthersSigner;
  let buyerAgentToFail: BuyerAgent;

  // sellers
  let seller: HardhatEthersSigner;
  let sellerToRelist: HardhatEthersSigner;

  // assets
  let assetToBuy: string;
  let assetToRelist: string;
  let assetToFail: string;

  const MARKET_PARAMETERS = {
    withdrawInterval: minutes(30),
    sellInterval: minutes(60),
    buyInterval: minutes(10),
    platformFee: 1n,
    maxAssetCount: 5n,
    timestamp: 0n,
  } satisfies SwanMarketParametersStruct;

  const STAKES = { generatorStakeAmount: parseEther("0.01"), validatorStakeAmount: parseEther("0.01") };
  const FEES = { platformFee: 1n, generationFee: parseEther("0.02"), validationFee: parseEther("0.1") };
  const ORACLE_PARAMETERS = { difficulty: 1, numGenerations: 1, numValidations: 1 };

  const DESC = ethers.encodeBytes32String("description of the asset");
  const [NAME, SYMBOL] = ["SWAN_ASSET_NAME", "SWAT"];

  const PRICE1 = parseEther("0.01");
  const PRICE2 = parseEther("0.02");
  const PRICE3 = parseEther("8.25");

  const STAKE_AMOUNT = parseEther("0.2");

  const AMOUNT_PER_ROUND = ethers.parseEther("2");
  const NEW_AMOUNT_PER_ROUND = 8n;

  const ROYALTY_FEE = 1;

  const FEE_AMOUNT2 = (PRICE2 * BigInt(ROYALTY_FEE)) / BigInt(100);
  const FEE_AMOUNT1 = (PRICE1 * BigInt(ROYALTY_FEE)) / BigInt(100);
  const FEE_AMOUNT3 = (PRICE3 * BigInt(ROYALTY_FEE)) / BigInt(100);

  this.beforeAll(async function () {
    [dria, buyer, buyerToFail, seller, sellerToRelist, generator, validator] = await ethers.getSigners();
  });

  it("should deploy swan", async function () {
    // deploy token to be able to deploy swan
    const supply = parseEther("1000");
    token = await deployTokenFixture(dria, supply);
    expect(await token.balanceOf(dria.address)).to.eq(supply);

    const currentTime = (await ethers.provider.getBlock("latest").then((block) => block?.timestamp)) as bigint;
    MARKET_PARAMETERS.timestamp = currentTime;

    ({ swan, registry, coordinator } = await deploySwanFixture(
      dria,
      token,
      STAKES,
      FEES,
      MARKET_PARAMETERS,
      ORACLE_PARAMETERS
    ));

    expect(await swan.owner()).to.eq(dria.address);
    expect(await swan.isOperator(dria.address)).to.be.true;
  });

  it("should create buyers", async function () {
    // prepare buyer agent parameters
    const buyerAgentParams = [
      {
        name: "BuyerAgent#1",
        description: "Description of BuyerAgent 1",
        royaltyFee: ROYALTY_FEE,
        amountPerRound: AMOUNT_PER_ROUND,
        owner: buyer,
      },
      {
        name: "BuyerAgent#2",
        description: "Description of BuyerAgent 2",
        royaltyFee: ROYALTY_FEE,
        amountPerRound: AMOUNT_PER_ROUND,
        owner: buyerToFail,
      },
    ];

    // get deployed buyer agents
    [buyerAgent, buyerAgentToFail] = await createBuyers(swan, buyerAgentParams);
  });

  it("should fund buyers & sellers", async function () {
    // fund buyers & sellers to create/buy assets
    await transferTokens(token, [
      [buyer.address, parseEther("3")],
      [buyerToFail.address, parseEther("3")],
      [seller.address, FEE_AMOUNT1 + FEE_AMOUNT2 + FEE_AMOUNT3 + FEE_AMOUNT1 + FEE_AMOUNT2],
      [sellerToRelist.address, FEE_AMOUNT2 + FEE_AMOUNT1],
      [generator.address, STAKE_AMOUNT],
      [validator.address, STAKE_AMOUNT],
    ]);

    // approve swan to spend tokens on behalf of sellers
    await token
      .connect(seller)
      .approve(await swan.getAddress(), BigInt(FEE_AMOUNT1 + FEE_AMOUNT2 + FEE_AMOUNT3 + FEE_AMOUNT1 + FEE_AMOUNT2));
    await token.connect(sellerToRelist).approve(await swan.getAddress(), FEE_AMOUNT2 + FEE_AMOUNT1);

    // send token to agent from agent owner
    await token.connect(buyer).transfer(await buyerAgent.getAddress(), parseEther("3"));
  });

  it("should register oracles", async function () {
    await registerOracles(token, registry, [generator], [validator], {
      generatorStakeAmount: STAKE_AMOUNT,
      validatorStakeAmount: STAKE_AMOUNT,
    });
  });

  describe("Sell phase #1: listing", () => {
    const currRound = 0n;

    it("should be in sell phase", async function () {
      const [round, phase] = await buyerAgent.getRoundPhase();
      expect(round).to.be.equal(currRound);
      expect(phase).to.be.equal(Phase.Sell);
    });

    it("should list 5 assets for the first round", async function () {
      await listAssets(
        swan,
        buyerAgent,
        [
          [seller, PRICE1],
          [seller, PRICE2],
          [seller, PRICE3],
          [sellerToRelist, PRICE2],
          [sellerToRelist, PRICE1],
        ],
        NAME,
        SYMBOL,
        DESC,
        0n
      );

      [assetToBuy, assetToRelist, assetToFail, ,] = await swan.getListedAssets(
        await buyerAgent.getAddress(),
        currRound
      );

      expect(await token.balanceOf(seller)).to.be.equal(FEE_AMOUNT1 + FEE_AMOUNT2);
      expect(await token.balanceOf(sellerToRelist)).to.be.equal(0);
    });

    it("should NOT allow to list an asset more than max asset count", async function () {
      // try to list an asset more than max asset count
      await expect(swan.connect(sellerToRelist).list(NAME, SYMBOL, DESC, PRICE1, await buyerAgent.getAddress()))
        .to.be.revertedWithCustomError(swan, "AssetLimitExceeded")
        .withArgs(MARKET_PARAMETERS.maxAssetCount);
    });

    it("should NOT allow to purchase in sell phase", async function () {
      // try to purchase an asset in sell phase
      await expect(buyerAgent.connect(buyer).purchase())
        .to.be.revertedWithCustomError(buyerAgent, "InvalidPhase")
        .withArgs(Phase.Sell, Phase.Buy);
    });

    it("should NOT allow to relist an asset in the same round", async function () {
      // try to relist an asset that you own within the same round
      await expect(swan.connect(seller).relist(assetToFail, buyerAgent, PRICE2))
        .to.be.revertedWithCustomError(swan, "RoundNotFinished")
        .withArgs(assetToFail, currRound);
    });
  });

  describe("Buy phase #1: purchasing", () => {
    const currRound = 0n;

    it("should be in buy phase", async function () {
      await time.increase(MARKET_PARAMETERS.sellInterval);
      const [round, phase] = await buyerAgent.getRoundPhase();
      expect(round).to.be.equal(currRound);
      expect(phase).to.be.equal(Phase.Buy);
    });

    it("should NOT allow to purchase by non-buyer", async function () {
      // try to purchase an asset by another buyer
      await expect(buyerAgent.connect(buyerToFail).purchase())
        .to.be.revertedWithCustomError(swan, "Unauthorized")
        .withArgs(buyerToFail.address);
    });

    it("should NOT allow to spend more than amountPerRound", async function () {
      // since there is no taskId yet, we will see 0 here
      // and we will have 1 after first request
      const taskId = 1;

      expect(await buyerAgent.oraclePurchaseRequests(currRound)).to.eq(0);
      await buyerAgent.connect(buyer).oraclePurchaseRequest("0x", "0x");
      expect(await buyerAgent.oraclePurchaseRequests(currRound)).to.eq(taskId);
      expect(await buyerAgent.isOracleRequestProcessed(taskId)).to.be.false;

      // set output to be more than amountPerRound
      const output = new AbiCoder().encode(["address[]"], [[assetToBuy, assetToFail]]);

      // respond & validate the oracle request
      await safeRespond(coordinator, generator, output, "0x", 1n, 0n);
      await safeValidate(coordinator, validator, [parseEther("1")], "0x", 1n, 0n);

      // try to purchase an asset with more than amountPerRound
      await expect(buyerAgent.connect(buyer).purchase()).to.be.revertedWithCustomError(buyerAgent, "BuyLimitExceeded");

      // task should still be not processed because it failed
      expect(await buyerAgent.isOracleRequestProcessed(taskId)).to.be.false;
    });

    it("should purchase an asset", async function () {
      // we already made a request before, so we have 1, and it will be 2
      const taskId = 2;

      expect(await buyerAgent.connect(buyer).oraclePurchaseRequests(currRound)).to.eq(taskId - 1);
      await buyerAgent.connect(buyer).oraclePurchaseRequest("0x", "0x");
      expect(await buyerAgent.connect(buyer).oraclePurchaseRequests(currRound)).to.eq(taskId);
      expect(await buyerAgent.isOracleRequestProcessed(taskId)).to.be.false;

      // asset price is smaller than `amountPerRound`, so we can purchase it
      const output = new AbiCoder().encode(["address[]"], [[assetToBuy]]);

      // respond & validate the oracle request
      await safeRespond(coordinator, generator, output, "0x", 2n, 0n);
      await safeValidate(coordinator, validator, [parseEther("1")], "0x", 2n, 0n);

      // purchase the asset
      expect(await buyerAgent.connect(buyer).purchase())
        .to.emit(swan, "AssetSold")
        .withArgs(seller, buyerAgent, assetToBuy, PRICE1);

      // task should be completed now
      expect(await buyerAgent.isOracleRequestProcessed(taskId)).to.be.true;
    });

    it("should NOT allow purchase that have already been purchased", async function () {
      await expect(buyerAgent.connect(buyer).purchase()).to.be.revertedWithCustomError(
        buyerAgent,
        "TaskAlreadyProcessed"
      );
    });
  });

  describe("Withdraw phase #1", () => {
    const currRound = 0n;

    it("should be in withdraw phase", async function () {
      await time.increase(MARKET_PARAMETERS.buyInterval);
      const [round, phase] = await buyerAgent.getRoundPhase();
      expect(round).to.be.equal(currRound);
      expect(phase).to.be.equal(Phase.Withdraw);
    });

    it("should update state", async function () {
      // since there is no taskId yet, we will see 0 here
      // and we will have 3 after first request because we already made two requests before
      const taskId = 3;

      expect(await buyerAgent.oracleStateRequests(currRound)).to.eq(0);
      await buyerAgent.connect(buyer).oracleStateRequest("0x", "0x");
      expect(await buyerAgent.oracleStateRequests(currRound)).to.eq(taskId);
      expect(await buyerAgent.isOracleRequestProcessed(taskId)).to.be.false;

      const newState = "0x" + Buffer.from("buyer is happy!").toString("hex");
      //  oracle request, response and validation
      await safeRespond(coordinator, generator, newState, "0x", 3n, 0n);
      await safeValidate(coordinator, validator, [parseEther("1")], "0x", 3n, 0n);

      // update state
      await buyerAgent.connect(buyer).updateState();
      expect(await buyerAgent.state()).to.eq(newState);

      // task should be completed now
      expect(await buyerAgent.isOracleRequestProcessed(taskId)).to.be.true;
    });

    it("should NOT allow update state again", async function () {
      await expect(buyerAgent.connect(buyer).updateState()).to.be.revertedWithCustomError(
        buyerAgent,
        "TaskAlreadyProcessed"
      );
    });

    it("should NOT allow list an asset on withdraw phase", async function () {
      await expect(
        swan.connect(seller).list(NAME, SYMBOL, DESC, PRICE1, await buyerAgent.getAddress())
      ).to.be.revertedWithCustomError(swan, "InvalidPhase");
    });

    it("should set amountPerRound", async function () {
      await buyerAgent.connect(buyer).setAmountPerRound(NEW_AMOUNT_PER_ROUND);
      expect(await buyerAgent.amountPerRound()).to.be.equal(NEW_AMOUNT_PER_ROUND);

      await buyerAgentToFail.connect(buyerToFail).setAmountPerRound(NEW_AMOUNT_PER_ROUND);
      expect(await buyerAgentToFail.amountPerRound()).to.be.equal(NEW_AMOUNT_PER_ROUND);
    });

    it("should NOT allow to create buyer with royalty > 100", async function () {
      const INVALID_ROYALTY_FEE = 150;
      await expect(swan.connect(buyer).createBuyer(NAME, DESC, INVALID_ROYALTY_FEE, AMOUNT_PER_ROUND))
        .to.be.revertedWithCustomError(buyerAgent, "InvalidFee")
        .withArgs(INVALID_ROYALTY_FEE);
    });

    it("should create new buyer", async function () {
      expect(await swan.connect(buyerToFail).createBuyer(NAME, DESC, ROYALTY_FEE, NEW_AMOUNT_PER_ROUND))
        .to.emit(swan, "BuyerCreated")
        .withArgs(await buyerAgentToFail.getAddress(), () => true);
    });

    it("should set factories", async function () {
      // deploy new buyerAgentFactory and swanAssetFactory & set them on swan
      const { buyerAgentFactory, swanAssetFactory } = await deployFactoriesFixture(dria);
      await swan.connect(dria).setFactories(await buyerAgentFactory.getAddress(), await swanAssetFactory.getAddress());

      expect(swanAssetFactory).to.equal(await swan.swanAssetFactory());
      expect(buyerAgentFactory).to.equal(await swan.buyerAgentFactory());
    });

    it("should NOT allow to relist an asset that already purchased", async function () {
      // get the purchased asset
      const listedAssetAddresses = await swan.getListedAssets(await buyerAgent.getAddress(), currRound);
      const asset = await swan.getListing(listedAssetAddresses[0]);

      // try to relist that asset
      await expect(swan.connect(seller).relist(listedAssetAddresses[0], buyerAgent, PRICE2))
        .to.be.revertedWithCustomError(swan, "InvalidStatus")
        .withArgs(asset.status, AssetStatus.Listed);
    });
  });

  describe("Sell phase #2: relisting", () => {
    const currRound = 1n; // incremented from 0

    it("should increase time to sell phase of second round", async function () {
      await time.increase(MARKET_PARAMETERS.withdrawInterval);
      const [round, phase, timeUntil] = await buyerAgent.getRoundPhase();
      expect(round).to.equal(currRound);
      expect(phase).to.equal(Phase.Sell);
      expect(timeUntil).to.be.greaterThan(0);
    });

    it("should NOT allow to relist an asset by non-owner", async function () {
      // try to relist an asset by non-owner of the asset
      await expect(swan.connect(sellerToRelist).relist(assetToRelist, buyerAgent, PRICE2))
        .to.be.revertedWithCustomError(swan, "Unauthorized")
        .withArgs(sellerToRelist.address);
    });

    it("should relist an asset", async function () {
      // relist an asset by asset owner
      await swan.connect(seller).relist(assetToRelist, buyerAgent, PRICE1);

      // get new listed asset
      const newListedAssetAddresses = await swan.getListedAssets(await buyerAgent.getAddress(), currRound);
      expect(newListedAssetAddresses.length).to.be.equal(1);

      const newListedAsset = await swan.getListing(newListedAssetAddresses[0]);
      expect(newListedAsset.price).to.be.equal(PRICE1);
      expect(newListedAsset.buyer).to.be.equal(buyerAgent);
    });
  });

  describe("Buy phase #2: ", () => {
    const currRound = 1n; // incremented from 0

    it("should increase time to buy phase of the next round", async function () {
      await time.increase(MARKET_PARAMETERS.sellInterval);
      const [round, phase, timeUntil] = await buyerAgent.getRoundPhase();
      expect(round).to.equal(currRound);
      expect(phase).to.equal(Phase.Buy);
      expect(timeUntil).to.be.greaterThan(0);
    });

    it("should NOT allow to relist an asset on buy phase", async function () {
      await expect(
        swan.connect(seller).list(NAME, SYMBOL, DESC, PRICE2, await buyerAgent.getAddress())
      ).to.be.revertedWithCustomError(swan, "InvalidPhase");
    });
  });

  describe("Withdraw phase #3", () => {
    const currRound = 2n; // incremented from 1
    const cycleTime =
      BigInt(MARKET_PARAMETERS.withdrawInterval) +
      BigInt(MARKET_PARAMETERS.buyInterval) +
      BigInt(MARKET_PARAMETERS.sellInterval);

    it("should increase time to withdraw phase of the next round", async function () {
      // go to withdraw phase of this current round
      await time.increase(MARKET_PARAMETERS.buyInterval);
      // skip a whole cycle
      await time.increase(cycleTime);

      // check the round and phase
      const [round, phase] = await buyerAgent.getRoundPhase();
      expect(round).to.equal(currRound);
      expect(phase).to.equal(Phase.Withdraw);
    });

    it("should NOT allow to relist an asset in withdraw phase", async function () {
      // try to relist an asset in withdraw phase.
      // we are doing this in withdraw phase of the next round,
      // because otherwise we would be seeing RoundNotFinished error
      await expect(swan.connect(seller).relist(assetToRelist, buyerAgent, PRICE1))
        .to.be.revertedWithCustomError(swan, "InvalidPhase")
        .withArgs(Phase.Withdraw, Phase.Sell);
    });
  });

  describe("Manager actions", () => {
    it("should set market parameters", async function () {
      const NEW_MARKET_PARAMETERS = {
        withdrawInterval: minutes(10),
        sellInterval: minutes(20),
        buyInterval: minutes(30),
        platformFee: 2n,
        maxAssetCount: 2n,
        timestamp: (await ethers.provider.getBlock("latest").then((block) => block?.timestamp)) as bigint,
      };

      await swan.connect(dria).setMarketParameters(NEW_MARKET_PARAMETERS);

      const newMarketParams = await swan.getCurrentMarketParameters();
      expect(newMarketParams.withdrawInterval).to.equal(NEW_MARKET_PARAMETERS.withdrawInterval);
      expect(newMarketParams.sellInterval).to.equal(NEW_MARKET_PARAMETERS.sellInterval);
      expect(newMarketParams.buyInterval).to.equal(NEW_MARKET_PARAMETERS.buyInterval);
      expect(newMarketParams.platformFee).to.equal(NEW_MARKET_PARAMETERS.platformFee);
      expect(newMarketParams.maxAssetCount).to.equal(NEW_MARKET_PARAMETERS.maxAssetCount);
    });

    it("should set oracle parameters", async function () {
      const NEW_ORACLE_PARAMETERS = {
        difficulty: 2,
        numGenerations: 3,
        numValidations: 5,
      };
      await swan.connect(dria).setOracleParameters(NEW_ORACLE_PARAMETERS);

      const oracleParameters = await swan.getOracleParameters();
      expect(oracleParameters.difficulty).to.equal(NEW_ORACLE_PARAMETERS.difficulty);
      expect(oracleParameters.numGenerations).to.equal(NEW_ORACLE_PARAMETERS.numGenerations);
      expect(oracleParameters.numValidations).to.equal(NEW_ORACLE_PARAMETERS.numValidations);
    });
  });
});
