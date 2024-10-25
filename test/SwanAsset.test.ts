import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SwanAsset, Swan, ERC20 } from "../typechain-types";
import { swanAssetDeployer } from "./fixtures";
import { deployTokenFixture, deploySwanFixture } from "./fixtures/deploy";
import { parseEther } from "ethers";
import { minutes } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

describe("SwanAsset", function () {
  let swanAsset: SwanAsset;
  let token: ERC20;
  let swan: Swan;

  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let dria: HardhatEthersSigner;

  const DESC = ethers.encodeBytes32String("Lewis Hamilton");
  const NAME = "CHAMPION";
  const SYMBOL = "CHAMP";
  const TOKEN_ID = 1;

  const STAKES = {
    generatorStakeAmount: parseEther("0.01"),
    validatorStakeAmount: parseEther("0.01"),
  };

  const FEES = {
    platformFee: 1n,
    generationFee: parseEther("0.00000002"),
    validationFee: parseEther("0.000000003"),
  };

  const MARKET_PARAMETERS = {
    withdrawInterval: minutes(30),
    sellInterval: minutes(60),
    buyInterval: minutes(10),
    platformFee: 1n,
    maxAssetCount: 0n,
    timestamp: 0n,
  };

  const ORACLE_PARAMETERS = {
    difficulty: 1,
    numGenerations: 1,
    numValidations: 1,
  };

  const SUPPLY = parseEther("1000");

  beforeEach(async function () {
    [dria, owner, user] = await ethers.getSigners();

    // deploy swan to use its address as the operator of the asset
    token = await deployTokenFixture(owner, SUPPLY);

    // set the current timestamp of MARKET_PARAMETERS before deploying swan
    MARKET_PARAMETERS.timestamp = (await ethers.provider
      .getBlock("latest")
      .then((block) => block?.timestamp)) as bigint;

    ({ swan } = await deploySwanFixture(dria, token, STAKES, FEES, MARKET_PARAMETERS, ORACLE_PARAMETERS));

    // deploy swan asset
    swanAsset = await loadFixture(swanAssetDeployer(NAME, SYMBOL, DESC, owner, swan));

    // new swanAsset contract will be deployed for every asset
    // so that tokenId will always be 1
    expect(await swanAsset.ownerOf(1)).to.be.equal(owner.address);
    expect(await swanAsset.balanceOf(owner.address)).to.be.equal(1);
  });

  it("should transfer tokens successfully", async function () {
    await swanAsset.transferFrom(owner, user.address, 1);
    expect(await swanAsset.ownerOf(TOKEN_ID)).to.be.equal(user.address);
    expect(await swanAsset.balanceOf(user.address)).to.be.equal(1);
  });
});
