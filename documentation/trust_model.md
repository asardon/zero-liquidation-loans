# Trust Model

## Owner
It is assumed that the `Owner` is trusted and acts in the best interest of the
pool's liquidity providers. More specifically, the following assumptions are
made:
* initializes market by calling `initialize_amm()` in due time.
* decides correctly for which loans to trigger repayment, i.e., where repayment
amount is less than what the pledged collateral is currently worth. Calls
`amm_repay_loan_and_reclaim_collateral(...)` method in these instances.
* updates pricing parameters to the best of his knowledge and in due time by
calling `update_oblivious_put_price_params(...)`
* pauses borrow and/or lend functionality of the pool only in case the proper
functioning of the market is endangered, and unpauses only in case proper
functioning can be expected.
