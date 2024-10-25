import hre from "hardhat";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import {
  getUpgradability,
  updateDeploymentsFile,
  ContractNames,
  parseContractName,
  NetworkNames,
  parseNetworkName,
  getParameters,
} from "./common";
import { verify } from "./verify";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = parseNetworkName(hre.network.name);
  const contract = parseContractName(process.env.CONTRACT_NAME);

  // deploy the contract
  console.log(`Deploying ${contract} at ${network} by deployer ${deployer.address}.`);
  await deploy(deployer, contract, network);
}

/**
 * Deploys a contract using the provided deployer account.
 *
 * @param deployer deployer account, usually the first account of ethers
 * @param contractName name of the contract to deploy, must be EXACTLY the same as the contract name (case sensitive)
 * @param upgradable indicates if the contract should be deployed as upgradable (UUPS)
 */
export async function deploy(deployer: HardhatEthersSigner, contractName: ContractNames, network: NetworkNames) {
  let address: string;
  let implementationAddress: string | undefined = undefined;

  // read contract factory
  const factory = await ethers.getContractFactory(contractName, deployer);

  // read parameters to deploy contract / initialize new implementation
  const params = getParameters(contractName, deployer, network);
  const upgradable = getUpgradability(contractName);

  if (upgradable) {
    //  deploy upgradable contract, address belongs to the proxy contract
    const proxy = await upgrades
      .deployProxy(factory, params, { initializer: "initialize", kind: "uups" })
      .then((tx) => tx.waitForDeployment());
    address = await proxy.getAddress();

    // read the implementation address from the proxy itself
    implementationAddress = await getImplementationAddress(ethers.provider, address);

    // verify without constructor args for upgradable contracts
    // because they use initialize function instead of constructort
    try {
      await verify(address, network, []);
      console.log(`Verified ${contractName} at ${address}.`);
    } catch (err) {
      console.error("Failed to verify:", err);
    }
  } else {
    // deploy normal contract
    const contract = await factory.deploy(...params).then((tx) => {
      console.log("Deploying:", tx.deploymentTransaction()?.hash);
      return tx.waitForDeployment();
    });
    address = await contract.getAddress();
    console.log(`Deployed ${contractName} at ${address}.`);

    // verify with constructor args
    try {
      await verify(address, network, [...params]);
      console.log(`Verified ${contractName} at ${address}.`);
    } catch (err) {
      console.error("Failed to verify:", err);
    }
  }

  updateDeploymentsFile(network, contractName, deployer.address, address, implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to deploy:", error);
    process.exit(1);
  });
