import { expect } from "chai";
import { ERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployTokenFixture } from "./fixtures/deploy";
import { parseEther } from "ethers";
import { ethers } from "hardhat";
import { transferTokens } from "./helpers";

describe("BatchToken", function () {
  let token: ERC20;
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const SUPPLY = parseEther("1000");
  const AMOUNT = parseEther("0.1");

  // NOTE: not beforeAll, its beforeEach!
  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();
    token = await deployTokenFixture(deployer, SUPPLY);

    await transferTokens(token, [[user.address, AMOUNT]]);
  });

  it("should transfer correctly", async function () {
    expect(await token.balanceOf(user.address)).to.equal(AMOUNT);
    expect(await token.balanceOf(deployer.address)).to.equal(SUPPLY - AMOUNT);
  });

  it("should do approvals correctly", async function () {
    await token.approve(user.address, AMOUNT);
    expect(await token.allowance(deployer.address, user.address)).to.equal(AMOUNT);

    await token.connect(user).transferFrom(deployer.address, user.address, AMOUNT);
    expect(await token.balanceOf(user.address)).to.equal(AMOUNT + AMOUNT);
    expect(await token.balanceOf(deployer.address)).to.equal(SUPPLY - AMOUNT - AMOUNT);
  });
});
