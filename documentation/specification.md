# Zero-Liquidation Loan Pool

## Roles
* AMM: automated market maker pools liquidity from LPs and concludes
zero-liquidation loans with borrowers and lenders
* Borrower: borrows `borrow_ccy` and pledges `collateral_ccy`; can choose at
expiry of loan whether to repay loan and reclaim collateral or not
* Lender: deposits `borrow_ccy`;
* LP: liquidity provider deposits `borrow_ccy` and `collateral_ccy`
and receives share in a liquidity pool
* Owner: responsible for the maintenance of the given market; at expiry, can
trigger repayment of loans given to the AMM by lenders; can set AMM loan
pricing parameters (e.g., `collateral_ccy` price, volatility)

## AMM
### General Specification
- Ownable (standard OZ) with one Owner, who can set AMM pricing parameters
- Pausable by Owner

### AMM Phases
The AMM can be in 1 of 4 phases:
* LP period: LPs can provide funds during this period; this period is indicated
by the `lpPeriodActive` modifier
* Pending initialization: after the LP period the AMM needs to be initialized
in order to set the AMM constant-product formula constant; this periods is
indicated by the `pendingInitialization` modifier
* AMM period: borrowers and lenders can borrow/lend funds from/to the AMM;
this periods is indicated by the `ammPeriodActive` modifier
* Settlement period: borrowers and AMM can repay their loans during this
period and reclaim their corresponding collateral; this period is indicated by
the `settlementPeriodActive` modifier
* Post-settlement period: LPs can redeem their shares during this period;
this period is indicated by the `postSettlementPeriodActive` modifier

### Zero-Liquidation Loan Lifecycle
#### Borrower User Flow
During the AMM period a borrower can open a zero-liquidation loan by pledging
a quantity in `collateral_ccy` and receive a quantity of `borrow_ccy`. This is
done by calling the `borrow(...)` method.

Once the loan expires, the borrower has the option to reclaim his previously
pledged `collateral_ccy` by paying a pre-agreed `repayment_amount`. This is
done by calling the `repay_loan_and_reclaim_collateral(...)` method.

Note that repayment is only possible during the settlement period. If the
borrower fails to repay during this period, then it is assumed that he doesn't
want to reclaim his collateral.

As a consequence, the `collateral_ccy` quantity will then be left to the AMM
and, ultimately, distributed among the LPs based on their pro-rata share in the
pool.

#### Lender User Flow
During the AMM period, a lender can lend a quantity in `borrow_ccy` to the AMM.
This is done by calling the `lend(...)` method. The AMM then reserves a certain
quantity of `collateral_ccy` for each lend (analogous to `borrow(...)`, only
that the AMM is the borrower).

Once the loan expires, the AMM then has the option to repay the loan and
reclaim the previously reserved quantity of `collateral_ccy`. This is done via
the `amm_repay_loan_and_reclaim_collateral(...)` method. In case the AMM
repays the loan then the lender will receive the corresponding
`repayment_amount` from the AMM, and, conversely, the given `collateral_ccy`
amount will be released again and be made available for distribution among the
LPs during the post-settlement period.

In case the AMM doesn't repay the loan, then the reserved quantity of
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
The owner is responsible for deploying a new market. Once deployed, the LP
period automatically starts. During all periods the owner can update the
market's pricing parameters by calling the
`update_oblivious_put_price_params(...)` method.

Once the LP period is over, the market needs to be initialized by calling the
`initialize_amm()` method. This can be done by anyone, but, due to the absence
of incentives is expected to be done by the owner. Note that the initialization
may be triggered at anytime after the LP period and prior to the AMM period end.

During the settlement period, it is the owner's responsibility to repay any
loans the AMM may have taken from lenders. It is expected that the owner
assesses correctly for which loans it makes sense to reclaim any pledged
collateral, i.e., where the repayment amount is less then the value of the
pledged collateral. The owner is expected to call the
`amm_repay_loan_and_reclaim_collateral(...)` method in this instances. Once the
settlement period is over, the owner can no longer trigger any repayments. 

### AMM Constant Product Formula
...

### Pricing Parameters
...

### Functions
* Ownable function transferOwnership
* provide_liquidity_and_receive_shares
* initialize_amm
* borrow
* lend
* get_time_to_expiry
* repay_loan_and_reclaim_collateral
* amm_repay_loan_and_reclaim_collateral
* reclaim_collateral
* redeem_shares

### Events
As indicated in the Ownable standard and as done in the OZ library.

On top of these, there are events for every ProvideLiquidity, OpenLoan,
UpdateObliviousPutPriceParams, InitializeAMM, Borrow, Lend, RepayBorrow,
RepayLend, ReclaimCollateral, and RedeemShares.


### Library Code
#### OpenZeppelin x.xx
* Inherit from Ownable
