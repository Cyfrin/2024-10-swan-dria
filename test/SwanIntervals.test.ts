import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ERC20, Swan, BuyerAgent } from "../typechain-types";
import { deployTokenFixture, deploySwanFixture } from "./fixtures/deploy";
import { expect } from "chai";
import { ethers } from "hardhat";
import { transferTokens, createBuyers } from "./helpers";
import { parseEther } from "ethers";
import { SwanMarketParametersStruct } from "../typechain-types/contracts/swan/Swan";
import { minutes } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

// helper function to skip cycles w.r.t market parameters
async function skipCycles(param: SwanMarketParametersStruct, numCycles: number) {
  const cycleTime = BigInt(param.withdrawInterval) + BigInt(param.sellInterval) + BigInt(param.buyInterval);
  await time.increase(cycleTime * BigInt(numCycles));
}

/**
 *
 * Scenaro is as follows: b1, b2, b3 indicates the `createdAt` of the respective BuyerAgent,
 * and the symbols below are:
 * - `$`: start time
 * - `|`: parameter change
 * - `>`: end time
 *
 * The timeline is as follows:
 *
 * ```
 * $--b1--------------|------b2-----------|----------b3------>
 * ```
 *
 * Making a new update should increment the round number for each buyer.
 */
describe("SwanIntervals", function () {
  let swan: Swan;
  let token: ERC20;
  let owner: HardhatEthersSigner;

  async function createAndFundBuyer(num: number) {
    const [buyer] = await createBuyers(swan, [
      {
        name: `BuyerAgent${num}`,
        description: `Description of BuyerAgent ${num}`,
        royaltyFee: 1,
        amountPerRound: ethers.parseEther("0.5"),
        owner,
      },
    ]);

    await transferTokens(token, [[owner.address, parseEther("3")]]);
    return buyer;
  }

  // buyer agents
  // deployed at the start
  let buyerFirst: BuyerAgent;
  // deployed after the first update, before the second
  let buyerMid: BuyerAgent;
  // deployed after the second update
  let buyerLast: BuyerAgent;

  // initial market parameters, cycle time is 100 minutes
  const MARKET_PARAMS_INITIAL = {
    withdrawInterval: minutes(30),
    sellInterval: minutes(60),
    buyInterval: minutes(10),
    platformFee: 1n,
    maxAssetCount: 5n,
    timestamp: 0n, // will be overwritten by contract
  } satisfies SwanMarketParametersStruct;

  // decreased market parameters, cycle time is 50 minutes
  const MARKET_PARAMS_DECREASED = {
    withdrawInterval: minutes(10),
    sellInterval: minutes(20),
    buyInterval: minutes(20),
    platformFee: 1n,
    maxAssetCount: 5n,
    timestamp: 0n, // will be overwritten by contract
  } satisfies SwanMarketParametersStruct;

  // increased market parameters, cycle time is 330 minutes
  const MARKET_PARAMS_INCREASED = {
    withdrawInterval: minutes(2),
    sellInterval: minutes(130),
    buyInterval: minutes(200),
    platformFee: 1n,
    maxAssetCount: 5n,
    timestamp: 0n, // will be overwritten by contract
  } satisfies SwanMarketParametersStruct;

  const STAKES = { generatorStakeAmount: parseEther("0.01"), validatorStakeAmount: parseEther("0.01") };
  const FEES = { platformFee: 1n, generationFee: parseEther("0.02"), validationFee: parseEther("0.1") };
  const ORACLE_PARAMETERS = { difficulty: 1, numGenerations: 1, numValidations: 1 };

  this.beforeAll(async function () {
    [owner] = await ethers.getSigners();
  });

  it("should deploy swan", async function () {
    // deploy token to be able to deploy swan
    const supply = parseEther("1000");
    token = await deployTokenFixture(owner, supply);
    expect(await token.balanceOf(owner.address)).to.eq(supply);

    ({ swan } = await deploySwanFixture(owner, token, STAKES, FEES, MARKET_PARAMS_INITIAL, ORACLE_PARAMETERS));

    expect(await swan.owner()).to.eq(owner.address);
    expect(await swan.isOperator(owner.address)).to.be.true;
  });

  it("should create & fund first buyer", async function () {
    buyerFirst = await createAndFundBuyer(1);
  });

  describe("initial market parameters", () => {
    const PARAMS = MARKET_PARAMS_INITIAL;

    it("should have correct market parameters", async function () {
      // there is only one parameter right now
      expect((await swan.getMarketParameters()).length).to.equal(1);

      const newMarketParams = await swan.getCurrentMarketParameters();
      expect(newMarketParams.sellInterval).to.equal(PARAMS.sellInterval);
      expect(newMarketParams.buyInterval).to.equal(PARAMS.buyInterval);
      expect(newMarketParams.withdrawInterval).to.equal(PARAMS.withdrawInterval);
    });

    it("should be in round 0 (first buyer)", async function () {
      const [round] = await buyerFirst.getRoundPhase();
      expect(round).to.be.equal(0n);
    });

    it("should increase 5 cycles", async function () {
      await skipCycles(PARAMS, 5);
    });

    it("should be in round 5 (first buyer)", async function () {
      const [round] = await buyerFirst.getRoundPhase();
      expect(round).to.equal(5n);
    });
  });

  describe("decreased market parameters", () => {
    const PARAMS = MARKET_PARAMS_DECREASED;

    it("should update market parameters", async function () {
      await swan.setMarketParameters(PARAMS);

      // there are two parameters now, initial + decreased
      expect((await swan.getMarketParameters()).length).to.equal(2);

      const newMarketParams = await swan.getCurrentMarketParameters();
      expect(newMarketParams.sellInterval).to.equal(PARAMS.sellInterval);
      expect(newMarketParams.buyInterval).to.equal(PARAMS.buyInterval);
      expect(newMarketParams.withdrawInterval).to.equal(PARAMS.withdrawInterval);
    });

    it("should be in round 6 (first buyer)", async function () {
      const [round] = await buyerFirst.getRoundPhase();
      expect(round).to.be.equal(6n); // 5 + 1 due to new update
    });

    it("should create & fund middle buyer", async function () {
      buyerMid = await createAndFundBuyer(2);
    });

    it("should be in round 0 (middle buyer)", async function () {
      const [round] = await buyerMid.getRoundPhase();
      expect(round).to.be.equal(0n);
    });

    it("should increase 7 cycles", async function () {
      await skipCycles(PARAMS, 7);
    });

    it("should be in round 13 (first buyer)", async function () {
      const [round] = await buyerFirst.getRoundPhase();
      expect(round).to.be.equal(13n);
    });

    it("should be in round 7 (middle buyer)", async function () {
      const [round] = await buyerMid.getRoundPhase();
      expect(round).to.be.equal(7n);
    });
  });

  describe("increased market parameters", () => {
    const PARAMS = MARKET_PARAMS_INCREASED;

    it("should update market parameters", async function () {
      await swan.setMarketParameters(PARAMS);

      // there are three parameters now, initial + decreased + increased
      expect((await swan.getMarketParameters()).length).to.equal(3);

      const newMarketParams = await swan.getCurrentMarketParameters();
      expect(newMarketParams.sellInterval).to.equal(PARAMS.sellInterval);
      expect(newMarketParams.buyInterval).to.equal(PARAMS.buyInterval);
      expect(newMarketParams.withdrawInterval).to.equal(PARAMS.withdrawInterval);
    });

    it("should be in round 14 (first buyer)", async function () {
      const [round] = await buyerFirst.getRoundPhase();
      expect(round).to.be.equal(14n);
    });

    it("should be in round 8 (middle buyer)", async function () {
      const [round] = await buyerMid.getRoundPhase();
      expect(round).to.be.equal(8n);
    });

    it("should create & fund middle buyer", async function () {
      buyerLast = await createAndFundBuyer(3);
    });

    it("should be in round 0 (last buyer)", async function () {
      const [round] = await buyerLast.getRoundPhase();
      expect(round).to.be.equal(0n);
    });

    it("should increase 3 cycles", async function () {
      await skipCycles(PARAMS, 3);
    });

    it("should be in round 17 (first buyer)", async function () {
      const [round] = await buyerFirst.getRoundPhase();
      expect(round).to.be.equal(17n);
    });

    it("should be in round 11 (middle buyer)", async function () {
      const [round] = await buyerMid.getRoundPhase();
      expect(round).to.be.equal(11n);
    });

    it("should be in round 3 (last buyer)", async function () {
      const [round] = await buyerLast.getRoundPhase();
      expect(round).to.be.equal(3n);
    });
  });
});
