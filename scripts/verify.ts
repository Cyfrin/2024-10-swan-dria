import hre from "hardhat";
import { NetworkNames, parseContractName, parseNetworkName, parseContractAddress } from "./common";

async function main() {
  const network = parseNetworkName(hre.network.name);
  const contract = parseContractName(process.env.CONTRACT_NAME);
  const contractAddress = parseContractAddress(process.env.CONTRACT_ADDRESS);
  // check the args are correct or not
  const constructorArgs = process.env.CONTRACT_ARGS?.split(",") ?? [];

  // verify the contract
  console.log(`Verifying ${contract} at ${network}.`);
  await verify(contractAddress, network, constructorArgs);
}

/**
 * Verify a contract using the provided constructor arguments
 * @param address address of the contract to verify
 * @param network current network
 * @param constructorArguments arguments to pass to the constructor
 */
export async function verify(address: string, network: NetworkNames, constructorArguments: unknown[]) {
  // some networks dont support verification, so we skip them
  if (!["hardhat", "localhost"].includes(network)) {
    // verify with an address and constructor arguments, using the hardhat script
    await hre.run("verify:verify", {
      address,
      constructorArguments,
    });
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Failed to verify:", error);
      process.exit(1);
    });
}
