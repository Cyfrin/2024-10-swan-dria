# Swan Audit

Swan is a decentralized protocol designed to create and manage simulated worlds where AI agents, specifically large language models (LLMs), interact autonomously with humans to simulate various scenarios and generate data.
Buyers are AI agents are created by users. Sellers are users as well, and each user lists assets (ERC721) on the marketplace to be bought by a targeted buyer. Since the buyer is an AI agent, we may think of this as a game where the seller must "convince" the AI agent to buy their listed token.

There are 3 phases in each "round" of Swan: Sell, Buy, Withdraw; in that order. Assets are listed during Sell phase, Buyer agents purchase them via LLM oracles in Buy phase, and during Withdraw phase the Buyer state gets updated with LLM oracles. When this phase ends, we move into a new round, and the process repeats on and on.

The LLM calls are realized via LLM oracles that listen to the Coordinator and process generation & validation tasks. In doing so, each oracle response bears a proof-of-work nonce as well, to increase security. The PoW difficulty is given within the oracle request.

We will be deploying to **Base Sepolia** and **Base Mainnet** chains.

## Scope

LLMOracle contracts:

- `contracts/libraries/Statistics.sol`
- `contracts/llm/LLMOracleCoordinator.sol`
- `contracts/llm/LLMOracleManager.sol`
- `contracts/llm/LLMOracleRegistry.sol`
- `contracts/llm/LLMOracleTask.sol`

Swan contracts:

- `contracts/swan/BuyerAgent.sol`
- `contracts/swan/Swan.sol`
- `contracts/swan/SwanAsset.sol`
- `contracts/swan/SwanManager.sol`

Auto-generated documentation can be found [here](./docs/contracts/).

LOC counts are (comments included):

```sh
❯ find ./contracts/llm ./contracts/swan ./contracts/libraries -name '*.sol' | xargs wc -l
     145 ./contracts/llm/LLMOracleManager.sol
     424 ./contracts/llm/LLMOracleCoordinator.sol
     149 ./contracts/llm/LLMOracleRegistry.sol
      81 ./contracts/llm/LLMOracleTask.sol
     337 ./contracts/swan/Swan.sol
     386 ./contracts/swan/BuyerAgent.sol
     134 ./contracts/swan/SwanManager.sol
      43 ./contracts/swan/SwanAsset.sol
      48 ./contracts/libraries/Statistics.sol
    1747 total
```

Tests are implemented as well:

```sh
❯ find ./test -name 'Swan*.test.ts' | xargs wc -l

     241 ./test/SwanIntervals.test.ts
     481 ./test/Swan.test.ts
      80 ./test/SwanAsset.test.ts
     802 total

❯ find ./test -name 'LLM*.test.ts' | xargs wc -l

     121 ./test/LLMOracleRegistry.test.ts
     292 ./test/LLMOracleCoordinator.test.ts
     413 total
```

### About the Oracle

The LLM oracles can be thought of as black-box for the scope of this audit. They are open source: <https://github.com/firstbatchxyz/dkn-l2-oracle/>, written in Rust using Alloy.

For an oracle request, the user simply provides `input` and `models`, and the Oracle picks that up via event listener. It processes the input w.r.t given models (e.g. model is `gpt-4o-mini` and input is `What is 2+2?`) and then provides two things: `output` and `metadata`. The output is to be read as-is by the contract, and metadata contains extra information.

In particular, the `purchase` operation in Swan makes use of a special oracle call that is identified by the oracles via the `protocol` value. In that case, the oracle `output` contains an ABI-encoded array of addresses, indicating the assets to be bought. Metadata itself contains the actual LLM output.

For both `output` and `metadata`, if the hex-decoded result is EXACTLY equal to an 64-char length hexadecimal, it is treated as an Arweave tx-id and it should be decoded again and encoded as `base64url`. Here is a small example:

```js
let input =
  "30626431616439346261343064373762613661613030653539336238366131396639663935346231373336363335333233386531636438373564373433383861";

let inputDecoded = Buffer.from(input, "hex").toString();
// 0bd1ad94ba40d77ba6aa00e593b86a19f9f954b17366353238e1cd875d74388a

let arweaveTxid = Buffer.from(inputDecoded, "hex").toString("base64url");
// C9GtlLpA13umqgDlk7hqGfn5VLFzZjUyOOHNh110OIo

// download the actual response from Arweave
let res = await fetch(`https://arweave.net/${arweaveTxid}`);
console.log(await res.text());
```

Oracles upload to Arweave if the result is long to save from gas fees!

## Some Notes

- No Pausability
- No Re-entrancy guards, but we follow CEI.
- Phase & round management within Swan needs attention, especially when market parameters are to be changed by contract owner during a round.
- Proof-of-work logic within LLMOracleCoordinator may need attention, the idea there is to add a little bit of randomness w.r.t resource usage so that results are a bit more authentic.
- Statistics & validator score calculation within oracle may need attention, its just some standard deviation & outlier calculations.
- Struct packing was not implemented, would love to take opinion on that.
