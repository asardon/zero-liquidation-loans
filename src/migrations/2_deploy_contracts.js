const ZeroLiquidationLoanPool = artifacts.require("ZeroLiquidationLoanPool");
const Web3 = require('web3');
var web3 = new Web3('https://mainnet.infura.io/v3/7d0d81d0919f4f05b9ab6634be01ee73');
const deploymentConfig = require("../config/deploymentConfig.json");

console.log("Make sure to keep deploymentConfig up-to-date.")
console.log("Current deploymentConfig:")
console.log("lp_duration: " + deploymentConfig.lp_duration);
console.log("amm_duration: " + deploymentConfig.amm_duration);
console.log("settlement_duration: " + deploymentConfig.settlement_duration);
console.log("collateral_ccy: " + deploymentConfig.collateral_ccy);
console.log("borrow_ccy: " + deploymentConfig.borrow_ccy);
console.log("borrow_ccy_to_collateral_ccy_ratio: " + deploymentConfig.borrow_ccy_to_collateral_ccy_ratio);
console.log("alpha: " + deploymentConfig.alpha);
console.log("init_collateral_price: " + deploymentConfig.init_collateral_price);
console.log("init_collateral_price_vol: " + deploymentConfig.init_collateral_price_vol);
console.log("decimals: " + deploymentConfig.decimals);

module.exports = function (deployer) {
  deployer.deploy(
    ZeroLiquidationLoanPool,
    deploymentConfig.lp_duration, // set to 100 to be able to use time.advanceBlockTo //57600 -> approx. 10 days from now
    deploymentConfig.amm_duration, // set to 100 to be able to use time.advanceBlockTo //57600+172800 -> approx. 30 days after lp_end
    deploymentConfig.settlement_duration, // set to 100 to be able to use time.advanceBlockTo //57600+172800+5760 -> approx. 1 day after amm_end
    deploymentConfig.collateral_ccy, // "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" -> WETH (mainnet)
    deploymentConfig.borrow_ccy, // "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" -> USDC (mainnet)
    deploymentConfig.borrow_ccy_to_collateral_ccy_ratio, // borrow ccy units per collatral ccy units, here 2000=2000*decimals*10^6/10^18 USDC 10^6 vs WETH 10^18
    deploymentConfig.alpha, // 200000000 -> 0.2, i.e., 50% of ATM BS approx, hence 0.5*0.4 = 0.2
    deploymentConfig.init_collateral_price, // 3000*1000000 (scaled according to borrow cccy ERC20 decimals, USDC=10^6)
    deploymentConfig.init_collateral_price_vol, // 1000000000000 (scaled according to zero-liquidation loan contract decimals)
    deploymentConfig.decimals // 1000000000000 (10^12)
  );
};
