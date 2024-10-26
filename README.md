# Swan

### Prize Pool

- Total Pool - $21,000
- H/M -  $20,000
- Low - $1,000

- Starts: October 25, 2024 4PM UTC
- Ends: November 01, 2024 4PM UTC

- nSLOC: 1034

[//]: # (contest-details-open)

## About the Project

Swan is structured like a market, where buyers are AI agents. By setting parameters like backstory, behavior, and objective you define how your agent will act. By using the budget you deposit, the agent buys the best items listed based on how aligned they are with its parameters. With each new asset bought, the agent's state changes and the simulation evolves.

Asset creators on the other side of the market are trying to come up with the best asset for a specific agent so that they can profit from selling it. Each agent has a fee rate where the asset creators pay a % of the listing price as a fee to the agent.

The LLM tasks are completed by a decentralized network of oracle nodes and the decisions are executed onchain.
Swan enables human-AI interaction at scale in a financialized context with sustainable economics and creates simulated worlds for any scenario people want.

- [Documentation](https://github.com/Cyfrin/2024-10-swan-dria/tree/main/docs)\*
- [Twitter / X](https://www.x.com/swanforall)
- [GitHub](https://github.com/Cyfrin/2024-10-swan-dria)

\*: The documentation is auto-generated with `npx hardhat docgen`.

### About the Buyer Agent

Each buyer agent has 3 **phases**, denoted as a **round** as a whole. The phases are:

- **Sell** phase: A listing (via `list`) can be made for the buyer.
- **Buy** phase: An `oraclePurchaseRequest` followed by `purchase` can be made, with which the agent will actually buy the chosen assets.
- **Withdraw** phase: An `oracleStateRequest` followed by `updateState` can be made, with which the agent's `state` will be updated.

The length of these phases are determined by `marketParameters` in Swan.

### About the Oracle

The LLM oracles can be thought of as black-box for the scope of this audit, they are out of scope. Oracle node is open source: https://github.com/firstbatchxyz/dkn-l2-oracle/, and is written in Rust using Alloy.

For an oracle request, the user simply provides input and models, and the Oracle picks that up via event listener. It processes the input w.r.t given models (e.g. model is `gpt-4o-mini` and input is `What is 2+2?`) and then provides two things: `output` and `metadata`. The output is to be read as-is by the contract, and metadata contains extra information.

In particular, the `purchase` operation in Swan makes use of a [special oracle call](https://github.com/firstbatchxyz/dkn-l2-oracle/blob/master/src/compute/workflows/postprocess/swan.rs) that is identified by the oracles via the `protocol` value. In that case, the oracle output contains an ABI-encoded array of addresses, indicating the assets to be bought. Metadata itself contains the actual LLM output.

For each oracle request, we expect a number of generations and a number of validations afterwards. The validations will return a score for each generation, and a statistical filter will be applied to the generation results so that outliers (with respect to a **standard deviation** times a **deviation factor**) will be ignored.

## Actors

LLM oracle has the following actors:

- **LLM Oracle node owner**: Each oracle node can be thought of as an EOA that needs to register to the registry with some stake. The oracle can have two roles, `generator` or `validator`. They can register to both types if they would like to.

- **`LLMOracleRegistry` Owner (Trusted)**: This is the wallet that deploys LLM Oracle registry by default. It can change the stake amounts.

Swan has the following actors:

- **`Swan` Owner (Trusted)**: This is the wallet that deploys Swan by default.

- **`BuyerAgent` Owner**: A user can create a buyer agent with `createBuyer` function in Swan, and they will be the owner of that created Buyer.

- **`SwanAsset` Owner**: A user can create an asset with `list` funtion in Swan, and they will be the owner of that created asset. _The asset is an ERC721 token with a single supply._

- **`Swan` Operator (Trusted)**: For every Buyer, there is an `onlyAuthorized` modifier that ensures the modified function is callable by `BuyerAgent` owner, or an address such that `swan.isOperator(addr)` is true. These operators simply exist so that buyer owner's dont have to be online all the time to call `purchase`, `updateState` etc., and can instead let the Swan operators call it for them. The operators are currently centralized, and belong to FirstBatch.

[//]: # (contest-details-close)

[//]: # (scope-open)

## Scope

The scope of this contest is described in the structure below:

```ml
contracts/
├── libraries/
│   └── Statistics.sol
├── llm/
│   ├── LLMOracleCoordinator.sol
│   ├── LLMOracleManager.sol
│   ├── LLMOracleRegistry.sol
│   ├── LLMOracleTask.sol
└── swan/
    ├── BuyerAgent.sol
    ├── Swan.sol
    ├── SwanAsset.sol
    └── SwanManager.sol
```

## Compatibilities

The Swan protocol is compatible with and EVM-compatible chain. As the primary deployment chain Swan will be deployed on **Base Sepolia and Base Mainnet**.

Swan uses the following token standards:

- **[ERC-721](https://ethereum.org/en/developers/docs/standards/tokens/erc-721/)**: Each `SwanAsset` is an ERC-721 contract with a single supply.
- **[ERC-20](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/)** (ETH, [WETH](https://base-sepolia.blockscout.com/token/0x4200000000000000000000000000000000000006)): Payments within Swan are made with an ERC20 compatible token. Oracle fees are also paid with such.

**Non-standard ERC20s (ie FoT, blacklist) are not supported**

[//]: # (scope-close)

[//]: # (getting-started-open)

## Setup

To run this Hardhat project locally for auditing, follow the steps below.

### Installation

First, clone the repository:

```bash
git clone https://github.com/Cyfrin/2024-10-swan-dria
```

Within the project directory, install dependencies:

```bash
yarn install
```

You can use `npm` or `pnpm` if you would like as well.

### Compile

To compile the contracts:

```bash
yarn compile
```

### Testing

The tests are written with Hardhat + Ethers. To run them:

```bash
yarn test

# print gas usage
yarn test:gas

# show coverage
yarn test:cov

# run specific file
yarn test ./path/to/some.test.ts
```

[//]: # (getting-started-close)

[//]: # (known-issues-open)

## Known Issues

- `SwanAssetFactory` and `BuyerAgentFactory` both have a `deploy` function that is callable by anyone, while the protocol assumes it to be called by `Swan` contract. We believe this is not a problem as any outsider call wont change the state of Swan contract, nor it will be caught by any event listeners that listen to Swan.

- The last oracle to call `validate` will pay more gas due to `finalizeValidation` that takes place in that transaction.

- Changing any of the intervals (`withdrawInterval`, `sellInterval`, `buyInterval`) is a disruptive action, it will automatically increase the round count of all existing buyers by 1; this is intended.

- A malicious `Swan` operator can call `oracleStateRequest` or `oraclePurchaseRequest` over and over to deplete the tokens of the respective Buyer agent via oracle fees. Since operators are centralized we ignore this.

- `oraclePurchaseRequest` and `oracleStateRequest` is called by either the buyer owner or a Swan operator. It is possible that a malicious buyer owner acts before the Swan operator to make a dummy `oraclePurchaseRequest`, e.g. the `input` is "say moo!" and therefore the `output` contains to assets to be bought at all. That way, it can guarantee that nothing will be bought, and collect fees. It can also set an arbitrary `state` by doing the same attack on `oracleStateRequest` with an arbitrary `input`.
- Non-tokenAddress funds locked`

**Additional Known Issues detected by LightChaser can be found [here](https://github.com/Cyfrin/2024-10-swan-dria/issues/1).**

[//]: # (known-issues-close)
