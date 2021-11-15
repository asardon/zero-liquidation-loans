# Audit Scope
## General
The scope of the audit shall cover the general mechanics of the
zero-liquidation loan concept, including a review of the financial engineering
involved, a review of the solidity code implementation, a review of the
test suite, and a review of the trust model as well as possible risks and
attack scenarios.

## Work in Progress
Note that the code base is currently still work in progress and subject to
changes. More specifically, the code currently lacks implementation of the
ERC20 standard for LP shares, as well as ERC721 for loans.

In addition, the LP share handling is currently re-assessed and might be
modified by incorporating a bonding curve mechanism for LP share issuances and
redemptions. Moreover, the code currently doesn't cover the implementation of
the MYSO governance token, as well as an implementation of the meta pools (see
meta-pool whitepaper), which shall be incorporated in a second version (v2),
and shall be audited in a subsequent second iteration.
