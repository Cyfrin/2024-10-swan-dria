import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractArgs, ContractNames } from "./contracts";
import { parseEther } from "ethers";
import { readDeploymentsFile } from "./deployments";
import { NetworkNames } from "./networks";

// just for readability
const SEC = 1;
const MIN = 60 * SEC;

/** https://base-sepolia.blockscout.com/token/0x4200000000000000000000000000000000000006 */
const BASE_WETH_ADDR = "0x4200000000000000000000000000000000000006";

// FIXME: Fix the `!` checks for address types
// FIXME: fix `satisfies` stuff on both functions

export function getParameters<K extends ContractNames>(
  contractName: K,
  deployer: HardhatEthersSigner,
  networkName: NetworkNames
): ContractArgs[K]["args"] {
  const { config } = readDeploymentsFile(networkName);

  switch (contractName) {
    case "Swan":
      return [
        {
          maxAssetCount: 3,
          sellInterval: 3 * MIN,
          buyInterval: 3 * MIN,
          withdrawInterval: 3 * MIN,
          platformFee: 1, // percentage
          timestamp: 0, // will be set to the current block timestamp
        },
        {
          difficulty: 2,
          numGenerations: 1,
          numValidations: 1,
        },
        config.LLMOracleCoordinator!.address,
        networkName == "base-sepolia" ? BASE_WETH_ADDR : config.BatchToken!.address,
        config.BuyerAgentFactory!.address,
        config.SwanAssetFactory!.address,
      ] satisfies ContractArgs["Swan"]["args"];

    case "SwanAssetFactory":
      return [] satisfies ContractArgs["SwanAssetFactory"]["args"];

    case "BuyerAgentFactory":
      return [] satisfies ContractArgs["BuyerAgentFactory"]["args"];

    case "KnowledgeRegistry":
      return [] satisfies ContractArgs["KnowledgeRegistry"]["args"];

    case "BatchToken":
      return [deployer.address, parseEther("100.0")];

    case "LLMOracleRegistry":
      return [
        parseEther("0.0001"), // generator stake amount
        parseEther("0.000001"), // validator stake amount
        networkName == "base-sepolia" ? BASE_WETH_ADDR : config.BatchToken!.address,
      ] satisfies ContractArgs["LLMOracleRegistry"]["args"];

    case "LLMOracleCoordinator":
      return [
        config.LLMOracleRegistry!.address,
        networkName == "base-sepolia" ? BASE_WETH_ADDR : config.BatchToken!.address,
        parseEther("0.0001"), // platform fee
        parseEther("0.0001"), // generator fee
        parseEther("0.0001"), // validator fee
      ] satisfies ContractArgs["LLMOracleCoordinator"]["args"];

    case "SwanAsset":
      throw new Error("SwanAsset contract should not be deployed directly.");

    case "BuyerAgent":
      throw new Error("BuyerAgent contract should not be deployed directly.");

    default: {
      contractName satisfies never;
      throw new Error(`Invalid contract name: ${contractName}`);
    }
  }
}

// FIXME: satisfies error weird
export function getUpgradability<K extends ContractNames>(contractName: K): ContractArgs[K]["upgradable"] {
  switch (contractName) {
    case "Swan":
      return true satisfies ContractArgs["Swan"]["upgradable"];
    case "SwanAssetFactory":
      return false satisfies ContractArgs["SwanAssetFactory"]["upgradable"];
    case "SwanAsset":
      return false satisfies ContractArgs["SwanAsset"]["upgradable"];
    case "BuyerAgentFactory":
      return false satisfies ContractArgs["BuyerAgentFactory"]["upgradable"];
    case "BuyerAgent":
      return false satisfies ContractArgs["BuyerAgent"]["upgradable"];
    case "KnowledgeRegistry":
      return true satisfies ContractArgs["KnowledgeRegistry"]["upgradable"];
    case "BatchToken":
      return false satisfies ContractArgs["BatchToken"]["upgradable"];
    case "LLMOracleRegistry":
      return true satisfies ContractArgs["LLMOracleRegistry"]["upgradable"];
    case "LLMOracleCoordinator":
      return true satisfies ContractArgs["LLMOracleCoordinator"]["upgradable"];
    default: {
      contractName satisfies never;
      throw new Error(`Invalid contract name: ${contractName}`);
    }
  }
}
