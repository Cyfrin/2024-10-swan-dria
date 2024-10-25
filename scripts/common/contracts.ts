import { isAddress, type BaseContract, type ContractFactory } from "ethers";

// contract interfaces
// also required for `initialize` arguments
import {
  type Swan,
  type KnowledgeRegistry,
  type LLMOracleRegistry,
  type LLMOracleCoordinator,
} from "../../typechain-types";

// factories, for `deploy` arguments
import type {
  BatchToken__factory,
  KnowledgeSupportToken__factory,
  BuyerAgentFactory__factory,
  SwanAssetFactory__factory,
  SwanAsset__factory,
  BuyerAgent__factory,
} from "../../typechain-types";
import { Address } from "hardhat-deploy/dist/types";

/**
 * List of contract names that are used in the deployment scripts.
 * Comes along with a type alias for type-safe contract name `string`.
 *
 * **Note that not all contracts are here.**
 */
export const ContractNames = [
  "Swan",
  "KnowledgeRegistry",
  "LLMOracleRegistry",
  "LLMOracleCoordinator",
  "BatchToken",
  "BuyerAgentFactory",
  "SwanAssetFactory",
  "SwanAsset",
  "BuyerAgent",
] as const;
export type ContractNames = (typeof ContractNames)[number];

/**
 * Checks if the given contract name is valid.
 * @param name contract name from env
 * @returns type-safe contract name
 */
export function parseContractName(name?: string): ContractNames {
  if (!name) {
    throw new Error("Contract name is required via CONTRACT_NAME arg.");
  }
  if (!ContractNames.includes(name as ContractNames)) {
    throw new Error(`Invalid contract name: ${name}`);
  }
  return name as ContractNames;
}

/**
 * Checks if the given contract address is valid.
 * @param address contract address from env
 */
export function parseContractAddress(address?: string): Address {
  if (!address) {
    throw new Error("Contract address is required via CONTRACT_ADDRESS arg.");
  }

  // checks if the given address is a valid Ethereum address
  if (!isAddress(address)) {
    throw new Error(`Invalid contract address: ${address}`);
  }

  return address as Address;
}

/**
 * Based on the given `T`,
 *
 * - if its a `ContractFactory` returns the arguments of `deploy` method
 * - if its a `BaseContract` with `initialize` method and `UPGRADE_INTERFACE_VERSION` getter
 * returns the arguments of `initialize` method
 *
 * It also adds an upgradable flag to the return type. Since all upgradables are initializable in our case,
 * by passing in the factory we declare that a contract is upgradable.
 *
 * @template T either a contract or a contract factory
 */
type ConractParameters<T> = T extends ContractFactory
  ? { upgradable: false; args: Parameters<T["deploy"]> }
  : // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends BaseContract & { initialize: any; UPGRADE_INTERFACE_VERSION: any }
  ? { upgradable: true; args: Parameters<T["initialize"]> }
  : never;

// TODO: check types here
export type ContractArgs = {
  // upgradables
  Swan: ConractParameters<Swan>;
  LLMOracleCoordinator: ConractParameters<LLMOracleCoordinator>;
  KnowledgeRegistry: ConractParameters<KnowledgeRegistry>;
  LLMOracleRegistry: ConractParameters<LLMOracleRegistry>;
  // non-upgradables
  BatchToken: ConractParameters<BatchToken__factory>;
  KnowledgeSupportToken: ConractParameters<KnowledgeSupportToken__factory>;
  BuyerAgentFactory: ConractParameters<BuyerAgentFactory__factory>;
  SwanAssetFactory: ConractParameters<SwanAssetFactory__factory>;
  SwanAsset: ConractParameters<SwanAsset__factory>;
  BuyerAgent: ConractParameters<BuyerAgent__factory>;
};
