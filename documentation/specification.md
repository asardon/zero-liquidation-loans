# Zero-Liquidation Loan Pool

## Zero-Liquidation Loan
A zero-liquidation loan is a crypto-collateralized loan with a fixed expiry
date, where a borrower pledges collateral and receives upfront cash from a
liquidity pool. At expiry, the borrower then has two options: either (i) repay
the borrowed amount plus a pre-agreed interest and receive back the previously
pledged collateral or (ii) leave collateral with the liquidity pool.

## Roles
* AMM: automated market maker that offers zero-liquidation loans to borrowers
and lenders, by using pooled liquidity in `borrow_ccy` and `collateral_ccy`
that has been committed by liquidity providers.
* Borrower: borrows `borrow_ccy` and pledges `collateral_ccy`; can choose at
expiry of loan whether to repay loan and reclaim collateral or leave collateral
with liquidity pool.
* Lender: lends `borrow_ccy` to liquidity pool, which in return pledges
`collateral_ccy`; at expiry either receives back `borrow_ccy` plus a pre-agreed
interest amount or receives `collateral_ccy`, depending on whether the
liquidity pool `Owner` triggers repayment or not.
* LP: liquidity provider deposits `borrow_ccy` and `collateral_ccy`
and receives share in liquidity pool.
* Liquidity pool: a pool holding `borrow_ccy` and `collateral_ccy`, which the
AMM then uses to facilitate zero-liquidation loans. Implementation wise, the
liquidity pool and AMM are the same thing and used synonymously.
* Owner: responsible for the maintenance of the given market. Can set AMM loan
pricing parameters (e.g., collateral price, volatility). At expiry, can decide
whether to trigger repayments to lenders or not.

## AMM
### General Specification
- Ownable (standard OZ) with one `Owner`, who can set AMM pricing parameters.
- ERC20 (standard OZ), where each LP share is represented as ERC20 token.
- ERC721 (based on OZ), where each loan is a non-fungible token defined by the
individually pledged amount, repayment amount (=embedded option strike) and
repayment date. Note that the corresponding meta-data is stored on-chain.
- All calculations are done with a precision factor as defined by `decimals`,
e.g., division of two values `a / b` is done in the form of
`a * decimals / b / decimals`.
- All time values are based in block time.

### AMM Phases
The AMM/liquidity pool is always in 1 of 4 phases:
* LP-period: LPs can provide funds during this period. This period is indicated
by the `lpPeriodActive` modifier.
* Pending-initialization: after the LP period the AMM needs to be initialized
in order to set the AMM constant-product formula constant. This period is
indicated by the `pendingInitialization` modifier.
* AMM-period: borrowers and lenders can borrow/lend funds from/to the AMM. This
period is indicated by the `ammPeriodActive` modifier.
* Settlement-period: borrowers and `Owner` can trigger repayment of loans
during this period and reclaim corresponding collateral. This period is
indicated by the `settlementPeriodActive` modifier.
* Post-settlement period: is open-ended. LPs can redeem their shares during
this period. Is indicated by the `postSettlementPeriodActive` modifier.

### Zero-Liquidation Loan Lifecycle
#### Borrower User Flow
During the AMM-period a borrower can open a zero-liquidation loan by pledging
a quantity in `collateral_ccy` and receive a quantity of `borrow_ccy`. This is
done by calling the `borrow(...)` method.

Once the loan expires, the borrower has the option to reclaim his previously
pledged `collateral_ccy` by paying a pre-agreed `repayment_amount`. This is
done by calling the `repay_loan_and_reclaim_collateral(...)` method.

Note that repayment is only possible during the settlement-period. If the
borrower fails to repay during this period, then it is assumed that he doesn't
want to reclaim his collateral. As a consequence, the `collateral_ccy` quantity
will then be left to the liquidity pool, from where it will become redeemable
among the LPs based on their pro-rata share in the pool.

#### Lender User Flow
During the AMM period, a lender can lend a quantity in `borrow_ccy` to the
liquidity pool. This is done by calling the `lend(...)` method. The AMM then
reserves a certain quantity of `collateral_ccy` for each lend (analogous to
`borrow(...)`, only opposite, i.e., the liquidity pool is the borrower).

Once the loan expires, the liquidity pool `Owner` then has the option to repay
the loan and reclaim the previously reserved quantity of `collateral_ccy` for
the pool. This is done via the `amm_repay_loan_and_reclaim_collateral(...)`
method. In case the pool `Owner` repays the loan, then the lender will receive
the corresponding `repayment_amount` from the pool, and in return the given
`collateral_ccy` amount will be released again and be made available for
distribution among the LPs during the post-settlement period.

In case the `Owner` doesn't repay the loan, then the reserved quantity of
`collateral_ccy` will be made available to the lender during the
post-settlement period, i.e., the lender will be able to reclaim the
`collateral_ccy` quantity the AMM had previously reserved for the loan. This is
done by calling the `reclaim_collateral(...)` method.

#### LP User Flow
During the LP period LPs can provide `collateral_ccy` and `borrow_ccy` to the
AMM and in exchange receive liquidity pool shares. The quantities in
`collateral_ccy` and `borrow_ccy` need to be provided in the correct ratio,
which is set by the owner of the AMM during deployment.

After the LP period, the LP's funds are locked and cannot be withdrawn until
post-settlement period. During the post-settlement period LPs can call the
`redeem_shares(...)` method to redeem their pool shares and receive a
corresponding pro-rata share of the `collateral_ccy` and `borrow_ccy` amounts
left in the pool. The redemption amounts may be greater or lesser than the
initially provisioned ones.

#### Owner User Flow
The deployer of a new zero-liquidation loan pool becomes automatically its
`Owner`. Once deployed, the LP-period automatically starts. The `Owner` can
update the market's pricing parameters anytime by calling the
`update_oblivious_put_price_params(...)` method.

Once the LP-period is over, the market needs to be initialized by calling the
`initialize_amm()` method. This can be done by anyone, but, due to the absence
of incentives is expected to be done by the `Owner`. Note that the
initialization may be triggered anytime after the LP-period and prior to the
AMM-period end.

During the settlement-period, the `Owner` is responsible to decide which loans
to repay on behalf of the liquidity pool to lenders. Once the settlement-period
is over, the `Owner` can no longer trigger any repayments.


### AMM Constant Product Formula
#### Borrowable and Pledgeable Amounts
The AMM uses a constant product formula
`collateral_ccy_amount * borrow_ccy_amount` to determine the amount of
`borrow_ccy` a borrower may receive per pledged `collateral_ccy`. This amount
is calculated by calling the `get_borrowable_amount(...)` method. And
conversely, the constant product formula is also used to determine the amount
of `collateral_ccy` the liquidity pool will pledge/reserve per received
`borrow_ccy` from lenders. This amount is calculated by calling the
`get_pledgeable_amount(...)` method.

#### Repayment Amount and Interest Costs
The applicable interest cost associated with a zero-liquidation loan is based
on the price of a put option (see whitepaper). The put option premium is
calculated by calling the `oblivious_put_price(...)` method, which uses the
approximation `0.4 * spot * vol * sqrt(time_to_expiry)` of the Black-Scholes
price for an at-the-money put option, where `sqrt(...)` is calculated by using
the Babylonian method as is implemented in Uniswap v2.

Note that this Black-Scholes approximation is actually for an at-the-money call
option, however, assuming that the risk free rate is zero put-call-parity
implies that the prices of an at-the-money put and call option are equal.

##### Pricing Parameters
The value `collateral_price`, i.e., spot price of the `collateral_ccy`
denominated `borrow_ccy` and its annualized price volatility
`collateral_price_annualized_vol` are set at deployment of the pool and can be
updated by its `Owner` by calling the `update_oblivious_put_price_params(...)`
method. The (annualized) time to expiry is calculated by taking the number of
remaining blocks until the AMM-period ends or the settlement-period starts, and
normalizing it by the approximate number of `blocks_per_year`. Same as with
`collateral_price` and `collateral_price_annualized_vol`, this value is set at
deployment and can be updated by `Owner`.

In addition, the `oblivious_put_price(...)` method applies a factor `alpha` to
the previously described approximation of the put option price. This is done in
order to approximate the price of an out-of-the-money put option. Because the
put option price is monotonically decreasing with lower strikes, the price of
an at-the-money put scaled by a factor less than 1 will be that of an
out-of-the-money put (see whitepaper). The degree of "out-of-the-moneyness" can
be steered by setting and applying smaller `alpha` values. The `alpha` value is
set at deployment and can be updated by `Owner`.

### Functions
#### Used by Owner / Maintainer:
* Ownable function `transferOwnership(...)`
* `initialize_amm()`: called to initialize constant `k` of the constant-product
formula and start market
* `amm_repay_loan_and_reclaim_collateral(...)`: called to initiate repayment of
a loan given by a lender, and reclaim reserved collateral for the liquidity pool
* `update_oblivious_put_price_params(...)`: called to update the pricing
parameters relevant for the interest cost / oblivious put price

#### Used by Liquidity Providers:
* `provide_liquidity_and_receive_shares(...)`: called by liquidity providers to
commit `borrow_ccy` and `collateral_ccy` to pool and receive LP shares. Note
that both currencies need to be supplied in the correct ratio
* `redeem_shares(...)`: called to redeem shares for a pro-rata share of the
funds held in the pool post-settlement

#### Used by Borrowers:
* `get_borrowing_terms(...)`: called to determine the amount a borrower could
borrow, and for which interest / repayment amount for a given quantity of
collateral
* `borrow(...)`: called to open a zero-liquidation loan; includes a minimum
limit set by the borrower to specify the amount of `borrow_ccy` the borrower at
least expects to receive, which is set in order to limit possible slippage
* `repay_loan_and_reclaim_collateral(...)`: called to repay a loan and receive
back the previously pledged collateral

#### Used by Lenders:
* `get_lending_terms(...)`: called to determine the required lending amount and
repayment amount to be potentially received for a given notional amount set by
the lender
* `lend(...)`: called to lend funds to liquidity pool; includes a maximum limit
set by the lender to specify the maximum `borrow_ccy` amount a lender is
willing to lend to the pool. The limit is used in order to prevent unexpectedly
high slippage
* `reclaim_collateral(...)`: called to reclaim collateral, given that `Owner`
hasn't repaid during the settlement-period

#### Used internally:
* `is_lp_period_active()`: used to flag LP-period
* `is_pending_initialization()`: used to flag AMM-period, that is still missing
initialization
* `is_amm_period_active()`: used to flag active AMM-period
* `is_settlement_period_active()`: used to flag settlement-period
* `is_post_settlement_period_active()`: used to flag post-settlement-period
* `get_time_to_expiry()`: called to get the remaining time to expiry (based on
  block time)
* `get_lp_borrow_ccy_amount(...)`: used to determine the amount of `borrow_ccy`
a liquidity provider needs to provide to the pool for a given quantity of
`collateral_ccy`
* `get_lp_collateral_ccy_amount(...)`: used to determine the amount of
`collateral_ccy` a liquidity provider needs to provide to the pool for a given
quantity of `borrow_ccy`
* `get_borrowable_amount(...)`: used to determine the amount of `borrow_ccy`
per `collateral_ccy` according to the constant-product formula
* `get_pledgeable_amount(...)`: used to determine the amount of
`collateral_ccy` per `borrow_ccy` according to the constant-product formula
* `get_interest_cost(...)`: used to get the applicable interest cost for a
given quantity of pledged `collateral_ccy`
* `get_oblivious_put_price(...)`: used to calculate the oblivious put price
according to the Black-Scholes approximation of an ATM call (=put), scaled down
by an `alpha` factor to approximate an out-of-the-money put price

### Events
As indicated in the Ownable standard and as done in the OZ library.

On top of these, there are events for every `ProvideLiquidity`, `OpenLoan`,
`UpdateObliviousPutPriceParams`, `InitializeAMM`, `Borrow`, `Lend`,
`RepayBorrow`, `RepayLend`, `ReclaimCollateral`, and `RedeemShares`.


### Library Code
#### OpenZeppelin 3.3.0
* Inherit from Ownable, ERC20 and ERC721
