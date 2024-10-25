import {
  KnowledgeRegistry,
  DatasetAccessRegistry,
  LLMOracleRegistry,
  Swan,
  ERC20,
  LLMOracleCoordinator,
  SwanAssetFactory,
  BuyerAgentFactory,
  BuyerAgent,
} from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { HDNodeWallet } from "ethers";
import { SwanMarketParametersStruct } from "../../typechain-types/contracts/mock/SwanV2";
import { LLMOracleTaskParametersStruct } from "../../typechain-types/contracts/llm/LLMOracleManager";
import { ContractArgs } from "../../scripts/common";

export function batchTokenDeployer(deployer: HardhatEthersSigner, supply: bigint) {
  return async function deployBatchToken() {
    const BatchToken = await ethers.getContractFactory("BatchToken", deployer);
    const batchToken = await BatchToken.deploy(deployer.address, supply).then((tx) => tx.waitForDeployment());

    return batchToken;
  };
}

export function wethDeployer(deployer: HardhatEthersSigner, supply: bigint) {
  return async function deployWETH() {
    const WETH9 = await ethers.getContractFactory("WETH9", deployer);
    const weth = await WETH9.deploy().then((tx) => tx.waitForDeployment());

    await weth.deposit({ value: supply });

    return weth;
  };
}

export function swanAssetDeployer(
  name: string,
  symbol: string,
  description: string,
  deployer: HardhatEthersSigner,
  swan: Swan
) {
  return async function deploySwanAsset() {
    const SwanAsset = await ethers.getContractFactory("SwanAsset", deployer);
    const swanAsset = await SwanAsset.deploy(name, symbol, description, deployer, await swan.getAddress()).then((tx) =>
      tx.waitForDeployment()
    );

    return swanAsset;
  };
}

export function swanDeployer(
  deployer: HardhatEthersSigner,
  marketParams: SwanMarketParametersStruct,
  oracleParams: LLMOracleTaskParametersStruct,
  coordinator: LLMOracleCoordinator,
  token: ERC20,
  buyerAgentFactory: BuyerAgentFactory,
  swanAssetFactory: SwanAssetFactory
) {
  return async function deploySwan() {
    const tokenAddress = await token.getAddress();
    const coordinatorAddress = await coordinator.getAddress();
    const buyerAgentFactoryAddress = await buyerAgentFactory.getAddress();
    const swanAssetFactoryAddress = await swanAssetFactory.getAddress();
    // deploy proxy
    const Swan = await ethers.getContractFactory("Swan", deployer);
    const swan = (await upgrades
      .deployProxy(
        Swan,
        [
          marketParams,
          oracleParams,
          coordinatorAddress,
          tokenAddress,
          buyerAgentFactoryAddress,
          swanAssetFactoryAddress,
        ] satisfies ContractArgs["Swan"]["args"],
        {
          initializer: "initialize",
          kind: "uups",
        }
      )
      .then((tx) => tx.waitForDeployment())) as Swan;
    return swan;
  };
}

/**
 * Deploys LLMOracleRegistry upgradable contract
 * @param token token to be used for registration fees
 * @param stakes parameters for stake
 * @returns proxy address
 */
export function LLMOracleRegistryDeployer(
  deployer: HardhatEthersSigner,
  token: ERC20,
  stakes: { generatorStakeAmount: bigint; validatorStakeAmount: bigint }
) {
  return async function deployLLMOracleRegistry() {
    const LLMOracleRegistry = await ethers.getContractFactory("LLMOracleRegistry", deployer);
    const llmOracleRegistry = (await upgrades
      .deployProxy(
        LLMOracleRegistry,
        [stakes.generatorStakeAmount, stakes.validatorStakeAmount, await token.getAddress()],
        {
          initializer: "initialize",
          kind: "uups",
        }
      )
      .then((tx) => tx.waitForDeployment())) as LLMOracleRegistry;

    return llmOracleRegistry;
  };
}

export function LLMOracleCoordinatorDeployer(
  deployer: HardhatEthersSigner,
  token: ERC20,
  oracleRegistry: LLMOracleRegistry,
  fees: { platformFee: bigint; generationFee: bigint; validationFee: bigint }
) {
  return async function deployLLMOracleCoordinator() {
    const tokenAddress = await token.getAddress();
    const oracleRegistryAddress = await oracleRegistry.getAddress();

    // deploy proxy
    const LLMOracleCoordinator = await ethers.getContractFactory("LLMOracleCoordinator", deployer);
    const llmOracleCoordinator = (await upgrades
      .deployProxy(
        LLMOracleCoordinator,
        [oracleRegistryAddress, tokenAddress, fees.platformFee, fees.generationFee, fees.validationFee],
        {
          initializer: "initialize",
          kind: "uups",
        }
      )
      .then((tx) => tx.waitForDeployment())) as LLMOracleCoordinator;

    return llmOracleCoordinator;
  };
}

export function knowledgeRegistryDeployer(deployer: HardhatEthersSigner) {
  return async function deployKnowledgeRegistry() {
    // deploy proxy
    const KnowledgeRegistry = await ethers.getContractFactory("KnowledgeRegistry", deployer);
    const knowledgeRegistry = (await upgrades
      .deployProxy(KnowledgeRegistry, [], { initializer: "initialize", kind: "uups" })
      .then((tx) => tx.waitForDeployment())) as KnowledgeRegistry;

    return knowledgeRegistry;
  };
}

// TODO: this is not used yet
export function knowledgeSupportTokenDeployer(
  deployer: HardhatEthersSigner,
  token: ERC20,
  knowledgeId: bigint,
  owner: HardhatEthersSigner
) {
  return async function deployKnowledgeSupportToken() {
    const KnowledgeSupportToken = await ethers.getContractFactory("KnowledgeSupportToken", deployer);
    const tokenAddress = await token.getAddress();
    const knowledgeSupportToken = await KnowledgeSupportToken.deploy(tokenAddress, knowledgeId, owner.address).then(
      (tx) => tx.waitForDeployment()
    );

    return knowledgeSupportToken;
  };
}

export function datasetAccessRegistryDeployer(deployer: HardhatEthersSigner, knowledgeRegistry: KnowledgeRegistry) {
  return async function deployDatasetAccessRegistry() {
    const knowledgeRegistryAddress = await knowledgeRegistry.getAddress();

    // deploy proxy
    const DatasetAccessRegistry = await ethers.getContractFactory("DatasetAccessRegistry", deployer);
    const datasetAccessRegistry = (await upgrades
      .deployProxy(DatasetAccessRegistry, [knowledgeRegistryAddress], { initializer: "initialize", kind: "uups" })
      .then((tx) => tx.waitForDeployment())) as DatasetAccessRegistry;

    return datasetAccessRegistry;
  };
}

export function datasetAccessTokenDeployer(
  deployer: HardhatEthersSigner,
  datasetRegistry: DatasetAccessRegistry,
  knowledgeId: bigint,
  supply: bigint,
  owner: HDNodeWallet
) {
  return async function deployDatasetAccessToken() {
    const DatasetAccessToken = await ethers.getContractFactory("DatasetAccessToken", deployer);
    const datasetRegistryAddress = await datasetRegistry.getAddress();
    const datasetAccessToken = await DatasetAccessToken.deploy(
      datasetRegistryAddress,
      knowledgeId,
      owner.address,
      supply
    ).then((tx) => tx.waitForDeployment());

    return datasetAccessToken;
  };
}

export function swanAssetFactoryDeployer(deployer: HardhatEthersSigner) {
  return async function deploySwanAssetFactory() {
    const SwanAssetFactory = await ethers.getContractFactory("SwanAssetFactory", deployer);
    const swanAssetFactory = await SwanAssetFactory.deploy().then((tx) => tx.waitForDeployment());

    return swanAssetFactory as SwanAssetFactory;
  };
}

export function buyerAgentFactoryDeployer(deployer: HardhatEthersSigner) {
  return async function deployBuyerAgentFactory() {
    const BuyerAgentFactory = await ethers.getContractFactory("BuyerAgentFactory", deployer);
    const buyerAgentFactory = await BuyerAgentFactory.deploy().then((tx) => tx.waitForDeployment());

    return buyerAgentFactory as BuyerAgentFactory;
  };
}

export function buyerAgentDeployer(
  swan: Swan,
  buyerAgentParams: {
    name: string;
    description: string;
    royaltyFee: bigint;
    amountPerRound: bigint;
    owner: HardhatEthersSigner;
  }
) {
  return async function deployBuyerAgent() {
    const BuyerAgent = await ethers.getContractFactory("BuyerAgent", buyerAgentParams.owner);
    const buyerAgent = await BuyerAgent.deploy(
      buyerAgentParams.name,
      buyerAgentParams.description,
      buyerAgentParams.royaltyFee,
      buyerAgentParams.amountPerRound,
      await swan.getAddress(),
      buyerAgentParams.owner.address
    ).then((tx) => tx.waitForDeployment());

    return buyerAgent as BuyerAgent;
  };
}
