import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-docgen";
import "hardhat-contract-sizer";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-abi-exporter";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "solidity-coverage";
import { ContractNames } from "./scripts/common/contracts";
import { ChainConfig } from "@nomicfoundation/hardhat-verify/types";

// the default key is for local usage only
const DEFAULT_SECRET_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SECRET_KEY = process.env.SECRET_KEY ?? DEFAULT_SECRET_KEY;

const BASE_SEPOLIA = "base-sepolia";
const BASE_MAINNET = "base";

const DRIA_TEST = "dria-test";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        // required by WETH9, uses latest v0.5 to match <v0.6
        version: "0.5.17",
      },
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
          },
        },
      },
    ],
  },
  mocha: {
    parallel: true,
  },
  docgen: {
    outputDir: "./docs/contracts",
    pages: "files",
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    // mostly a dedicated local Anvil / Hardhat node
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [DEFAULT_SECRET_KEY],
    },
    [BASE_SEPOLIA]: {
      url: process.env.BASE_TEST_RPC_URL ?? "",
      accounts: [SECRET_KEY],
    },
    [BASE_MAINNET]: {
      url: process.env.BASE_TEST_RPC_URL ?? "",
      accounts: [SECRET_KEY],
    },
    [DRIA_TEST]: {
      url: process.env.DRIA_TEST_RPC_URL ?? "",
      accounts: [SECRET_KEY],
    },
  },
  abiExporter: {
    path: "./abi/json",
    format: "json",
    flat: true,
    only: [...ContractNames],
  },
  gasReporter: {
    L2: "base",
    L1Etherscan: process.env.ETHERSCAN_API_KEY ?? "",
    L2Etherscan: process.env.BASESCAN_API_KEY ?? "",
    currency: "USD",
    enabled: false,
    outputJSON: true,
    darkMode: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY ?? "",
  },
};
// additional config for verifications
// see: https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify
const verification = {
  etherscan: {
    apiKey: {
      // blockscout doesn't require an API key, just put a placeholder
      [BASE_SEPOLIA]: "IGNORE_ME",
      [BASE_MAINNET]: "IGNORE_ME",
      [DRIA_TEST]: "IGNORE_ME",
    },
    customChains: [
      {
        network: BASE_SEPOLIA,
        chainId: 84532,
        urls: {
          apiURL: `https://${BASE_SEPOLIA}.blockscout.com/api`,
          browserURL: `https://${BASE_SEPOLIA}.blockscout.com/`,
        },
      },
      {
        network: BASE_MAINNET,
        chainId: 8453,
        urls: {
          apiURL: `https://${BASE_MAINNET}.blockscout.com/api`,
          browserURL: `https://${BASE_MAINNET}.blockscout.com/`,
        },
      },
      {
        network: DRIA_TEST,
        chainId: 0x00, // TODO: update chainId
        urls: {
          apiURL: `${process.env.DRIA_TEST_EXPLORER_URL}/api`,
          browserURL: process.env.DRIA_TEST_EXPLORER_URL || "",
        },
      },
    ] satisfies ChainConfig[],
  },
  sourcify: {
    enabled: false,
  },
};

export default {
  ...config,
  ...verification,
};
