# Assets

Assets are derived from knowledge (e.g. synthetic data) on Dria.

## [DatasetAccessToken](./DatasetAccessToken.sol)

In Dria, synthetic datasets accesses are handled by the `DatasetAccessRegistry` contract. For every dataset, there is a `DatasetAccessToken` (ERC721) created, with respect to a knowledge that is registered on `KnowledgeRegistry`. This token is then added as a relation to the knowledge registry.

When a user burns their access token, this burn event is picked up by Dria, and an encrypted access key readable by the user alone is written to the access registry.

## [KnowledgeSupportToken](./KnowledgeSupportToken.sol)

For a knowledge on Dria, we can create an ERC20 token such that holders of this token can share the amount of $BATCH tokens within the contract. This is done with respect to a dApp that makes use of the knowledge, where the fees are paid in $BATCH and are sent over to the knowledge token.
