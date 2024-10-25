# LLM Oracle

An LLM Oracle a node that actively listens to oracle requests on Dria L2.

1. These nodes are registered to the `LLMOracleRegistry` with some stake.
2. They listen to `LLMOracleCoordinator` to wait for generation & validation requests.
3. Once a request is received, they do a proof-of-work via a cryptographic hash function that results in a sufficiently small digest. How small this **target** value is expected to be is determined by the **difficulty** value of the task. The target value for the proof-of-work is computed by:

$$
\text{target} = \frac{2^{256}}{2^{\text{difficulty}}}
$$

> [!NOTE]
>
> The higher the difficulty, the smaller the target becomes and makes the PoW harder. At maximum difficulty, the PoW is equivalent to finding the preimage of digest 0. The contract has bounds on the minimum-maximum difficulty levels allowed.

Reward distributions take place as follows:

- If there are no validations, rewards are distributed immediately per-generation.
- If there are validations required, rewards are distributed after all validations take place & scores are calculated.
