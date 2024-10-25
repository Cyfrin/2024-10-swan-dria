import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers, upgrades } from "hardhat";
import {
  ERC20,
  Swan,
  LLMOracleCoordinator,
  DatasetAccessRegistry,
  KnowledgeRegistry,
  SwanAssetFactory,
  BuyerAgentFactory,
} from "../typechain-types";
import { batchTokenDeployer, swanDeployer, datasetAccessRegistryDeployer, knowledgeRegistryDeployer } from "./fixtures";
import { parseEther } from "ethers";
import { transferTokens } from "./helpers";
import { deployFactoriesFixture, deployLLMFixture } from "./fixtures/deploy";
import { minutes } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";

let coordinator: LLMOracleCoordinator;
let datasetRegistry: DatasetAccessRegistry;
let knowledgeRegistry: KnowledgeRegistry;
let swan: Swan;
let token: ERC20;
let swanAssetFactory: SwanAssetFactory;
let buyerAgentFactory: BuyerAgentFactory;

let generators: HardhatEthersSigner[];
let validators: HardhatEthersSigner[];
let dria: HardhatEthersSigner;

const SUPPLY = parseEther("10000000");
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

describe("UpgradableContracts", function () {
  this.beforeAll(async function () {
    // assign roles, full = oracle that can do both generation & validation
    const [deployer, req1, gen1, gen2, gen3, val1, val2] = await ethers.getSigners();
    dria = deployer;
    generators = [gen1, gen2, gen3];
    validators = [val1, val2];

    // deploy batch token & fund everyone
    token = await loadFixture(batchTokenDeployer(dria, SUPPLY));

    const requesterFunds = parseEther("10");
    await transferTokens(token, [
      [req1.address, requesterFunds],
      // each oracle should have at least the stake amount
      ...generators.map<[string, bigint]>((oracle) => [oracle.address, STAKES.generatorStakeAmount]),
      ...validators.map<[string, bigint]>((oracle) => [oracle.address, STAKES.validatorStakeAmount]),
    ]);

    // deploy contracts
    ({ coordinator } = await deployLLMFixture(deployer, token, STAKES, FEES));
    knowledgeRegistry = await loadFixture(knowledgeRegistryDeployer(deployer));
    datasetRegistry = await loadFixture(datasetAccessRegistryDeployer(deployer, knowledgeRegistry));
    ({ swanAssetFactory, buyerAgentFactory } = await deployFactoriesFixture(deployer));

    swan = await loadFixture(
      swanDeployer(
        deployer,
        MARKET_PARAMETERS,
        ORACLE_PARAMETERS,
        coordinator,
        token,
        buyerAgentFactory,
        swanAssetFactory
      )
    );
  });

  it("should upgrade coordinator contract", async function () {
    const coordinatorV2 = await ethers.getContractFactory("LLMOracleCoordinator");

    await upgrades.validateUpgrade(coordinator, coordinatorV2, {
      kind: "uups",
    });
    await upgrades.upgradeProxy(coordinator, coordinatorV2);
  });

  it("should upgrade knowledge registry", async function () {
    const knowledgeRegistryV2 = await ethers.getContractFactory("KnowledgeRegistry");

    await upgrades.validateUpgrade(knowledgeRegistry, knowledgeRegistryV2, {
      kind: "uups",
    });

    await upgrades.upgradeProxy(knowledgeRegistry, knowledgeRegistryV2);
  });
  it("should upgrade dataset registry contract", async function () {
    const registryV2 = await ethers.getContractFactory("DatasetAccessRegistry");

    await upgrades.validateUpgrade(datasetRegistry, registryV2, {
      kind: "uups",
    });

    await upgrades.upgradeProxy(datasetRegistry, registryV2);
  });

  it("should upgrade swan contract", async function () {
    const swanV2 = await ethers.getContractFactory("Swan");

    await upgrades.validateUpgrade(swan, swanV2, {
      kind: "uups",
    });

    await upgrades.upgradeProxy(swan, swanV2);
  });
});
