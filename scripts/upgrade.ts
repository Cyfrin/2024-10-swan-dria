import hre from "hardhat";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  getUpgradability,
  readDeploymentsFile,
  updateDeploymentsFile,
  ContractNames,
  parseContractName,
  NetworkNames,
  parseNetworkName,
} from "./common";

async function main() {
  const [owner] = await hre.ethers.getSigners();
  const network = parseNetworkName(hre.network.name);
  const contract = parseContractName(process.env.CONTRACT_NAME);

  if (!getUpgradability(contract)) {
    throw new Error("This contract is not upgradable.");
  }

  // deploy the contract
  console.log(`Upgrading ${contract} at ${network} by owner ${owner.address}.`);
  await upgrade(owner, contract, network);
}

// FIXME: when the contract names are same, the upgrade does not work

/**
 * Upgrades a contract using the provided deployer account.
 *
 * @param owner owner account, is authorized to do the upgrades
 * @param contractName name of the contract to deploy, must be EXACTLY the same as the contract name (case sensitive)
 * @param upgradable indicates if the contract should be deployed as upgradable (UUPS)
 */
export async function upgrade(owner: HardhatEthersSigner, contractName: ContractNames, network: NetworkNames) {
  console.log(`Upgrading ${contractName}...`);

  // get address
  const deployment = readDeploymentsFile(network).config[contractName];
  if (!deployment) {
    throw new Error(`No existing deployment found for ${contractName} on ${network}.`);
  }

  const [proxyAddress, implementationAddress] = [deployment.address, deployment.implementations!.at(-1)];

  // using the new implementation
  const newImplementationFactory = await ethers.getContractFactory(contractName, owner);

  // compares the current implementation contract to the new implementation contract
  // to check for storage layout compatibility errors.
  await upgrades.validateUpgrade(proxyAddress, newImplementationFactory, {
    kind: "uups",
  });

  // commence upgrade
  await upgrades.upgradeProxy(proxyAddress, newImplementationFactory);
  const newAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  if (implementationAddress === newAddress) {
    throw new Error("Upgrade failed, implementation address did not change; perhaps the bytecodes are same?");
  }

  console.info(`${contractName} upgraded`, {
    proxyAddress,
    newAddress,
  });
  updateDeploymentsFile(network, contractName, proxyAddress, newAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to upgrade:", error);
    process.exit(1);
  });
