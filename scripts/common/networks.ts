/**
 * List of network names that are supported by Dria.
 * Comes along with a type alias for type-safe network name `string`.
 *
 * **Note that not all networks are here.**
 */
const NetworkNames = ["hardhat", "localhost", "base-sepolia"] as const;
export type NetworkNames = (typeof NetworkNames)[number];

/**
 * Checks if the given network name is valid.
 * @param name network name from env
 * @returns type-safe network name
 */
export function parseNetworkName(name: string): NetworkNames {
  if (!NetworkNames.includes(name as NetworkNames)) {
    throw new Error(`Network ${name} is not supported.`);
  }
  return name as NetworkNames;
}
