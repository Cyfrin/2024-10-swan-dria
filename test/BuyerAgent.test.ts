import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BuyerAgent, ERC20, Swan } from "../typechain-types";
import { deployTokenFixture, deploySwanFixture } from "./fixtures/deploy";
import { transferTokens } from "./helpers";
import { parseEther } from "ethers";
import { buyerAgentDeployer } from "./fixtures";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { minutes } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";
import { Phase } from "./types/enums";

describe("BuyerAgent", function () {
  let buyerAgent: BuyerAgent;
  let token: ERC20;
  let swan: Swan;

  let buyerAgentOwner: HardhatEthersSigner;
  let dria: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const PRICE1 = ethers.parseEther("0.1");
  const PRICE2 = ethers.parseEther("0.3");
  const AMOUNT_PER_ROUND = ethers.parseEther("0.1");
  const SUPPLY = parseEther("1000");
  const ROYALTY_FEE = 1n;

  const STAKES = {
    generatorStakeAmount: parseEther("0.01"),
    validatorStakeAmount: parseEther("0.01"),
  };

  const FEES = {
    platformFee: 1n,
    generationFee: parseEther("0.02"),
    validationFee: parseEther("0.03"),
  };

  const MARKET_PARAMETERS = {
    withdrawInterval: minutes(30),
    sellInterval: minutes(60),
    buyInterval: minutes(20),
    platformFee: 1n,
    maxAssetCount: 5n,
    timestamp: 0n,
  };

  const ORACLE_PARAMETERS = {
    difficulty: 1,
    numGenerations: 1,
    numValidations: 1,
  };

  this.beforeAll(async function () {
    [dria, buyerAgentOwner, user] = await ethers.getSigners();
  });

  it("should deploy token and swan contracts", async function () {
    token = await deployTokenFixture(dria, SUPPLY);

    MARKET_PARAMETERS.timestamp = (await ethers.provider
      .getBlock("latest")
      .then((block) => block?.timestamp)) as bigint;

    ({ swan } = await deploySwanFixture(dria, token, STAKES, FEES, MARKET_PARAMETERS, ORACLE_PARAMETERS));
  });

  it("should fund agent owner", async function () {
    await transferTokens(token, [[buyerAgentOwner.address, BigInt(PRICE1 + PRICE2)]]);
  });

  it("should deploy buyer agent", async function () {
    buyerAgent = await loadFixture(
      buyerAgentDeployer(swan, {
        name: "Name of the agent",
        description: "Description of the agent",
        royaltyFee: ROYALTY_FEE,
        amountPerRound: AMOUNT_PER_ROUND,
        owner: buyerAgentOwner,
      })
    );
  });
  it("should NOT allow to create buyer agent with royalty > 100", async function () {
    const INVALID_FEE_ROYALTY = 105n;

    await expect(swan.connect(buyerAgentOwner).createBuyer("NAME", "DESC", INVALID_FEE_ROYALTY, AMOUNT_PER_ROUND))
      .to.be.revertedWithCustomError(buyerAgent, "InvalidFee")
      .withArgs(INVALID_FEE_ROYALTY);
  });

  describe("sell phase", function () {
    it("should NOT allow owner to set feeRoyalty in sell phase", async function () {
      await expect(buyerAgent.connect(buyerAgentOwner).setFeeRoyalty(1)).to.be.revertedWithCustomError(
        buyerAgent,
        "InvalidPhase"
      );
    });
  });

  describe("buy phase", function () {
    it("should increase time to buy phase", async function () {
      await time.increase(MARKET_PARAMETERS.sellInterval);

      // get current round and phase
      const [round, phase] = await buyerAgent.getRoundPhase();
      expect(round).to.be.equal(0n);
      expect(phase).to.be.equal(Phase.Buy);
    });

    it("should NOT allow owner to set amount per round in buy phase", async function () {
      // try to set amount per round in buy phase
      // dont care about the value here
      await expect(
        buyerAgent.connect(buyerAgentOwner).setAmountPerRound(AMOUNT_PER_ROUND)
      ).to.be.revertedWithCustomError(buyerAgent, "InvalidPhase");
    });

    it("should NOT allow to withdraw more than min amount at buy phase", async function () {
      // we must leave at least minFundAmount in the contract to be able to withdraw in non-withdraw phase

      // get the min amount
      const minfundamount = await buyerAgent.minFundAmount();
      // get the contract balance
      const treasuary = await buyerAgent.treasury();

      // (PRICE1 + minfundamount > treasuary) => should be revert
      expect(PRICE1 + minfundamount > treasuary).to.be.equal(true);

      // transfer tokens to buyerAgent
      await token.connect(buyerAgentOwner).transfer(await buyerAgent.getAddress(), PRICE1);

      // check if the agent balance is correct
      expect(await token.balanceOf(await buyerAgent.getAddress())).to.be.equal(PRICE1);

      // try to withdraw more than min amount + PRICE1
      await expect(buyerAgent.connect(buyerAgentOwner).withdraw(PRICE1))
        .to.be.revertedWithCustomError(buyerAgent, "MinFundSubceeded")
        .withArgs(PRICE1);
    });
  });

  describe("withdraw phase", function () {
    it("should increase time to withdraw phase", async function () {
      await time.increase(MARKET_PARAMETERS.buyInterval);
    });

    it("should NOT allow non-owner to set feeRoyalty in withdraw phase", async function () {
      // royalty fee can be set only in withdraw phase by only agent owner
      await expect(buyerAgent.connect(user).setFeeRoyalty(ROYALTY_FEE)).to.be.revertedWithCustomError(
        buyerAgent,
        "OwnableUnauthorizedAccount"
      );
    });

    it("should NOT allow non-owner to withdraw", async function () {
      // only owner can withdraw in withdraw phase
      // try to withdraw by user
      await expect(buyerAgent.connect(user).withdraw(ROYALTY_FEE))
        .to.be.revertedWithCustomError(buyerAgent, "Unauthorized")
        .withArgs(user.address);
    });

    it("should NOT accept >100 royalty fee", async function () {
      const invalidFeeRoyalty = 500;
      await expect(buyerAgent.connect(buyerAgentOwner).setFeeRoyalty(invalidFeeRoyalty))
        .to.be.revertedWithCustomError(buyerAgent, "InvalidFee")
        .withArgs(invalidFeeRoyalty);
    });

    it("should NOT accept <1 percent royalty fee", async function () {
      const invalidFeeRoyalty = 0;
      await expect(buyerAgent.connect(buyerAgentOwner).setFeeRoyalty(invalidFeeRoyalty))
        .to.be.revertedWithCustomError(buyerAgent, "InvalidFee")
        .withArgs(invalidFeeRoyalty);
    });

    it("should set fee royalty", async function () {
      const NEW_FEE_ROYALTY = 3;
      await buyerAgent.connect(buyerAgentOwner).setFeeRoyalty(NEW_FEE_ROYALTY);
      expect(await buyerAgent.royaltyFee()).to.be.equal(NEW_FEE_ROYALTY);
    });

    it("should set amount per round", async function () {
      const NEW_AMOUNT_PER_ROUND = AMOUNT_PER_ROUND * 2n;
      await buyerAgent.connect(buyerAgentOwner).setAmountPerRound(NEW_AMOUNT_PER_ROUND);
      expect(await buyerAgent.amountPerRound()).to.be.equal(NEW_AMOUNT_PER_ROUND);
    });

    it("should withdraw all funds in withdraw phase", async function () {
      // only agent owner can withdraw in withdraw phase
      const agentBalance = await token.balanceOf(await buyerAgent.getAddress());
      const initialBalanceOfOwner = await token.balanceOf(buyerAgentOwner.address);
      await buyerAgent.connect(buyerAgentOwner).withdraw(agentBalance);

      // check if the agent balances are correct
      expect(await token.balanceOf(buyerAgentOwner)).to.be.equal(agentBalance + initialBalanceOfOwner);
      expect(await token.balanceOf(await buyerAgent.getAddress())).to.be.equal(0);
    });
  });
});
