import { expect } from "chai";
import { ethers } from "hardhat";
import { MockStorage } from "./mocks";
import type { KnowledgeRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { knowledgeRegistryDeployer } from "./fixtures";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("KnowledgeRegistry", function () {
  const storage = new MockStorage<string>();

  const knowledge = "Hello, world!";
  const knowledgeId = storage.upload(knowledge);

  let user: HardhatEthersSigner;
  let knowledgeRegistry: KnowledgeRegistry;

  this.beforeAll(async function () {
    const [dria, _user] = await ethers.getSigners();
    user = _user;
    knowledgeRegistry = await loadFixture(knowledgeRegistryDeployer(dria));
  });

  it("should register knowledge", async function () {
    // register knowledge
    await expect(knowledgeRegistry.registerKnowledge(user.address, knowledgeId))
      .to.emit(knowledgeRegistry, "Registered")
      .withArgs(user, knowledgeId);

    // check ownership & count
    expect(await knowledgeRegistry.isRegistered(knowledgeId)).to.equal(true);
    expect(await knowledgeRegistry.owners(knowledgeId)).to.equal(user.address);

    // check knowledge
    const knowledges = await knowledgeRegistry.getKnowledges(user.address);
    expect(knowledges).to.have.length(1);
    expect(knowledges[0]).to.equal(knowledgeId);
  });

  it("should NOT register the same knowledge", async function () {
    await expect(knowledgeRegistry.registerKnowledge(user, knowledgeId))
      .to.revertedWithCustomError(knowledgeRegistry, "KnowledgeExists")
      .withArgs(knowledgeId);
  });
});
