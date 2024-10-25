import path from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import type { ContractNames } from "./contracts";
import type { NetworkNames } from "./networks";

/** Deployment file name. */
const DEPLOYMENTS = "deployments";

/**
 * A deployment contains the address of the deployed contract,
 * and optionally the addresses of the implementations for upgradable contracts.
 *
 * For each upgrade, the new implementation address is appended to the implementations array.
 * As such, the last element of the array is the current implementation address.
 */
type Deployment = {
  /** Deploying account address/ */
  deployer: string;
  /** Contract address / proxy address. */
  address: string;
  /** Implementation addresses for upgradable contracts. */
  implementations?: string[];
};

/**
 * A map of contract names to their deployment information.
 * Since we may not have deployed all contracts at a given time, the deployments are optional.
 *
 * @example
 * "BatchToken": {
 *   "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
 * },
 * "LLMOracleRegistry": {
 *   "address": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
 *   "implementations": [
 *     "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
 *     "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
 *   ]
 * }
 */
type Deployments = Partial<Record<ContractNames, Deployment>>;

/**
 * Reads the deployment file.
 * @param network chosen network via `--network`
 * @returns path to the deployment file and its content
 */
export function readDeploymentsFile(network: NetworkNames): { path: string; config: Deployments } {
  const configPath = path.join(__dirname, `../../${DEPLOYMENTS}/${network}.json`);
  let config: Deployments = {};

  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  }

  return { path: configPath, config };
}

/**
 * Reads and updates the deployment configuration file in-place.
 * @param network chosen network via `--network`
 * @param contract contract name
 * @param address address of the deployed contract, or the proxy contract for upgradables
 * @param implementationAddress implementation address for upgradable contracts, omit for non-upgradable ones
 */
export function updateDeploymentsFile(
  network: NetworkNames,
  contract: ContractNames,
  deployer: string,
  address: string,
  implementationAddress?: string
): void {
  const { path, config } = readDeploymentsFile(network);

  if (implementationAddress) {
    // if implementation address is provided, it's an upgradable contract
    const existing = config[contract];
    if (existing) {
      if (existing.address == address) {
        // proxy address is same, so this is just an upgrade
        // add the new implementation address to the list
        const implementations = existing.implementations ?? [];
        implementations.push(implementationAddress!);
        config[contract] = { deployer, address, implementations: implementations };
      } else {
        // proxy address has changed as well, so this is a new deployment
        config[contract] = { deployer, address, implementations: [implementationAddress] };
      }
    } else {
      // first time deployed along with proxy
      config[contract] = { deployer, address, implementations: [implementationAddress] };
    }
  } else {
    // otherwise, it's a normal contract
    config[contract] = { deployer, address };
  }

  writeFileSync(path, JSON.stringify(config, null, 2));
}
