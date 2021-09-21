const ZeroLiquidationLoanPool = artifacts.require("ZeroLiquidationLoanPool");

module.exports = function (deployer) {
  deployer.deploy(
    ZeroLiquidationLoanPool,
    13268810,
    13268810+100,
    13268810+200,
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    2000,
    1,
    "0xa36085F69e2889c224210F603D836748e7dC0088"
  );
};
