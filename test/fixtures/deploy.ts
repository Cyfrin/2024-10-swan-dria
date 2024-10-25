/// Note that `loadFixture` only works local network!
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ERC20 } from "../../typechain-types";
import {
  swanAssetFactoryDeployer,
  buyerAgentFactoryDeployer,
  batchTokenDeployer,
  LLMOracleCoordinatorDeployer,
  LLMOracleRegistryDeployer,
  swanDeployer,
  wethDeployer,
} from ".";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SwanMarketParametersStruct } from "../../typechain-types/contracts/mock/SwanV2";
import { LLMOracleTaskParametersStruct } from "../../typechain-types/contracts/llm/LLMOracleManager";

export async function deployFactoriesFixture(deployer: HardhatEthersSigner) {
  return {
    swanAssetFactory: await loadFixture(swanAssetFactoryDeployer(deployer)),
    buyerAgentFactory: await loadFixture(buyerAgentFactoryDeployer(deployer)),
  };
}

export async function deployTokenFixture(
  deployer: HardhatEthersSigner,
  supply: bigint,
  token: "BATCH" | "WETH" = "WETH" // you can change the default, all tests will use it
) {
  if (token === "BATCH") return await loadFixture(batchTokenDeployer(deployer, supply));
  if (token === "WETH") return await loadFixture(wethDeployer(deployer, supply));
  throw new Error("Invalid token type");
}

export async function deployLLMFixture(
  deployer: HardhatEthersSigner,
  token: ERC20,
  stakes: { generatorStakeAmount: bigint; validatorStakeAmount: bigint },
  fees: { platformFee: bigint; generationFee: bigint; validationFee: bigint }
) {
  const registry = await loadFixture(LLMOracleRegistryDeployer(deployer, token, stakes));
  const coordinator = await loadFixture(LLMOracleCoordinatorDeployer(deployer, token, registry, fees));

  return {
    registry,
    coordinator,
  };
}

export async function deploySwanFixture(
  deployer: HardhatEthersSigner,
  token: ERC20,
  stakes: { generatorStakeAmount: bigint; validatorStakeAmount: bigint },
  fees: { platformFee: bigint; generationFee: bigint; validationFee: bigint },
  marketParams: SwanMarketParametersStruct,
  oracleParams: LLMOracleTaskParametersStruct
) {
  const { buyerAgentFactory, swanAssetFactory } = await deployFactoriesFixture(deployer);
  const { registry, coordinator } = await deployLLMFixture(deployer, token, stakes, fees);

  const swan = await loadFixture(
    swanDeployer(deployer, marketParams, oracleParams, coordinator, token, buyerAgentFactory, swanAssetFactory)
  );

  return {
    registry,
    coordinator,
    buyerAgentFactory,
    swanAssetFactory,
    swan,
  };
}
