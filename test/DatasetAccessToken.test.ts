import { expect } from "chai";
import { ethers } from "hardhat";
import { MockStorage } from "./mocks";
import { DatasetAccessRegistry, DatasetAccessToken, KnowledgeRegistry } from "../typechain-types";
import { HDNodeWallet, SigningKey, Transaction, Wallet, computeAddress, parseEther, randomBytes } from "ethers";
import { PrivateKey, PublicKey, decrypt, encrypt } from "eciesjs";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { datasetAccessRegistryDeployer, datasetAccessTokenDeployer, knowledgeRegistryDeployer } from "./fixtures";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("DatasetAccessToken", function () {
  const storage = new MockStorage<string>();

  const datasetPrivateKey = new PrivateKey(randomBytes(32));
  const datasetPublicKey = datasetPrivateKey.publicKey;
  const datasetRelationName = ethers.encodeBytes32String("Dataset");
  let datasetRegistry: DatasetAccessRegistry;

  const knowledge = "Hello, world!";
  const knowledgeEnc = encrypt(datasetPublicKey.compressed, Buffer.from(knowledge));
  const knowledgeId = storage.upload(knowledgeEnc.toString("base64"));
  let knowledgeRegistry: KnowledgeRegistry;
  let knowledgeRegistryAddress: string;
  let tokenAddress: string;
  const datasetTokenSupply = 100n;

  let user: HDNodeWallet;
  let dria: HardhatEthersSigner;

  this.beforeAll(async function () {
    [dria] = await ethers.getSigners();
    user = Wallet.createRandom(ethers.provider);

    // fund the user a bit
    await dria.sendTransaction({
      to: user.address,
      value: parseEther("10.0"),
    });

    expect(await ethers.provider.getBalance(user)).to.be.equal(parseEther("10.0"));

    knowledgeRegistry = await loadFixture(knowledgeRegistryDeployer(dria));
    knowledgeRegistryAddress = await knowledgeRegistry.getAddress();

    await knowledgeRegistry.registerKnowledge(user, knowledgeId);

    // check ownership & count
    expect(await knowledgeRegistry.isRegistered(knowledgeId)).to.equal(true);
    expect(await knowledgeRegistry.owners(knowledgeId)).to.equal(user);
  });

  it("should deploy dataset registry", async function () {
    datasetRegistry = await loadFixture(datasetAccessRegistryDeployer(dria, knowledgeRegistry));
    expect(knowledgeRegistryAddress).to.equal(await datasetRegistry.knowledgeRegistry());
  });

  describe("token with relation", () => {
    const tokenId = BigInt(99); // arbitrary
    let token: DatasetAccessToken;

    it("should deploy dataset access token", async function () {
      token = await loadFixture(
        datasetAccessTokenDeployer(dria, datasetRegistry, knowledgeId, datasetTokenSupply, user)
      );
      tokenAddress = await token.getAddress();
    });

    it("should add relation", async function () {
      // add relation
      await expect(knowledgeRegistry.setRelation(knowledgeId, tokenAddress, datasetRelationName))
        .to.emit(knowledgeRegistry, "RelationSet")
        .withArgs(knowledgeId, datasetRelationName, tokenAddress);

      // check relation
      const relation = await knowledgeRegistry.relations(knowledgeId, datasetRelationName);
      expect(relation).to.equal(tokenAddress);
    });

    it("should NOT burn a not-owned token", async function () {
      // connect with Dria explicity to indicate a non-owner user
      await expect(token.connect(dria).burn(tokenId))
        .to.revertedWithCustomError(token, "ERC721InsufficientApproval")
        .withArgs(dria.address, tokenId);
    });

    it("should burn NFT to gain access", async function () {
      await time.setNextBlockTimestamp(Math.floor(Date.now()) * 99590);

      const contractTx = await token.connect(user).burn(tokenId);
      await expect(contractTx).to.emit(datasetRegistry, "AccessRequest").withArgs(user, knowledgeId);

      const receipt = await contractTx.wait();
      expect(receipt).to.not.be.null;
      if (receipt) {
        // recover & check public key
        const tx = await receipt.getTransaction();
        const signature = tx.signature;
        const digest = Transaction.from(tx).unsignedHash;
        const publicKey = SigningKey.recoverPublicKey(digest, signature);
        const compressedPublicKey = PublicKey.fromHex(publicKey).compressed;
        expect("0x" + compressedPublicKey.toString("hex")).to.equal(user.publicKey);

        // check address
        const addrRecovered = computeAddress(publicKey);
        expect(addrRecovered).to.equal(user.address);
      }
    });

    it("should NOT burn non-existent token", async function () {
      const largeTokenId = datasetTokenSupply + 1n;
      await expect(token.connect(user).burn(largeTokenId))
        .to.revertedWithCustomError(token, "ERC721NonexistentToken")
        .withArgs(largeTokenId);
    });

    it("should put encrypted access key", async () => {
      // this public key was derived from tx above
      const userPublicKey = PublicKey.fromHex(user.publicKey.slice(2));

      // encrypt & set access key
      const datasetKeyEnc = encrypt(userPublicKey.compressed, datasetPrivateKey.secret);
      await datasetRegistry.setAccessKey(datasetKeyEnc, knowledgeId, user);

      // verify that its there
      expect(await datasetRegistry.accessKeys(user, knowledgeId)).to.equal("0x" + datasetKeyEnc.toString("hex"));
    });

    it("should read encrypted access key & decrypt", async () => {
      // get & decrypt access key
      const datasetKeyEnc = Buffer.from((await datasetRegistry.accessKeys(user, knowledgeId)).slice(2), "hex");
      const userPrivateKey = PrivateKey.fromHex(user.privateKey.slice(2));
      const datasetKey = decrypt(userPrivateKey.secret, datasetKeyEnc);
      expect(datasetKey.toString("hex")).to.equal(datasetPrivateKey.secret.toString("hex"));

      // decyrpt data
      const knowledgeEnc = storage.get(knowledgeId);
      expect(knowledgeEnc).to.not.be.null;
      const knowledgeDec = decrypt(datasetKey, Buffer.from(knowledgeEnc!, "base64"));
      expect(knowledgeDec.toString()).to.equal(knowledge);
    });

    it("should NOT burn when there is an access key", async function () {
      const otherTokenId = tokenId - 1n;
      await expect(token.connect(user).burn(otherTokenId))
        .to.revertedWithCustomError(datasetRegistry, "AccessKeyExists")
        .withArgs(user.address, knowledgeId);
    });
  });

  describe("token without relation", () => {
    const tokenId = datasetTokenSupply >> 1n; // arbitrary
    let token: DatasetAccessToken;

    it("should deploy dataset access token without relation", async function () {
      token = await loadFixture(
        datasetAccessTokenDeployer(dria, datasetRegistry, knowledgeId, datasetTokenSupply, user)
      );
    });

    it("should NOT burn NFT to gain access", async function () {
      await expect(token.connect(user).burn(tokenId))
        .to.revertedWithCustomError(datasetRegistry, "AccessKeyExists")
        .withArgs(user.address, knowledgeId);
    });
  });
});
