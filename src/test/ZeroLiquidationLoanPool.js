const ZeroLiquidationLoanPool = artifacts.require("ZeroLiquidationLoanPool");
const Web3 = require('web3');
const { expect } = require('chai');
const erc20ABI = require('erc-20-abi');
const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const chai = require('chai');
chai.use(require('chai-bn')(BN));

contract("ZeroLiquidationLoanPool", accounts => {

  before(async () => {
    zeroLiquidationLoanPool = await ZeroLiquidationLoanPool.deployed();
  });

  it("should have a collateral currency with total supply > 0", async () => {
    var collateral_ccy_token = await zeroLiquidationLoanPool.
                               collateral_ccy_token.call();
    var collateral_ccy_token = new web3.eth.Contract(erc20ABI,
                                                     collateral_ccy_token);
    var collateral_ccy_token_total_supply = new BN(await collateral_ccy_token.
                                                         methods.totalSupply().
                                                         call());
    console.log(collateral_ccy_token_total_supply);
    expect(collateral_ccy_token_total_supply).to.be.a.bignumber.that.is.above(
                                              new BN(0));
  });

  it("should have a borrow currency with total supply > 0", async () => {
    var borrow_ccy_token = await zeroLiquidationLoanPool.borrow_ccy_token.
                                 call();
    var borrow_ccy_token = new web3.eth.Contract(erc20ABI, borrow_ccy_token);
    var borrow_ccy_token_total_supply = new BN(await borrow_ccy_token.methods.
                                                     totalSupply().call());
    console.log(borrow_ccy_token_total_supply);
    expect(borrow_ccy_token_total_supply).to.be.a.bignumber.that.is.above(
                                          new BN(0));
  });

  it("should revert when calling time to expiry prior to init. the AMM", async () => {
    var time_to_expiry = await expectRevert.unspecified(
      zeroLiquidationLoanPool.get_time_to_expiry()
    );
  });

});
