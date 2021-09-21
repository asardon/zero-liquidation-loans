const ZeroLiquidationLoanPool = artifacts.require("ZeroLiquidationLoanPool");
const Web3 = require('web3');
var web3 = new Web3('https://mainnet.infura.io/v3/7d0d81d0919f4f05b9ab6634be01ee73');

module.exports = function (deployer) {
  deployer.deploy(
    ZeroLiquidationLoanPool,
    57600, // _lp_end -> approx. 10 days from now
    57600+172800, // _amm_end -> approx. 30 days after lp_end
    57600+172800+5760, // _settlement_end -> approx. 1 day after amm_end
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // _collateral_ccy -> WETH (mainnet)
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // _borrow_ccy -> USDC (mainnet)
    2000, // _borrow_ccy_to_collateral_ccy_ratio
    1, // _alpha
    3000, // _init_collateral_price,
    100, // _init_collateral_price_vol,
    1000000000 // _decimals
  );
};
