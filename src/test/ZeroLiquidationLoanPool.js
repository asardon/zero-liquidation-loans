const ZeroLiquidationLoanPool = artifacts.require("ZeroLiquidationLoanPool");
const ForceSend = artifacts.require('ForceSend');
const Web3 = require('web3');
const erc20ABI = require('erc-20-abi');
const { expect } = require('chai');
const { BN, ether, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const chai = require('chai');
chai.use(require('chai-bn')(BN));
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const USDC_HOLDER_ADDRESS = "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"; // check with ganache unlock
const WETH_HOLDER_ADDRESS = "0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e"; // check with ganache unlock
const deploymentConfig = require("../config/deploymentConfig.json");
var init_block = 0;
var borrow_ccy_token_addr = "";
var borrow_ccy_token = "";
var collateral_ccy_token = "";
var collateral_ccy_token_addr = "";

console.log("Make sure to run ganache with matching unlock addreses.")
console.log("Tests expect the following addresses to be unlocked:")
console.log("USDC address: " + USDC_HOLDER_ADDRESS);
console.log("USDC WETH_HOLDER_ADDRESS: " + WETH_HOLDER_ADDRESS);

contract("ZeroLiquidationLoanPool", accounts => {

  before(async () => {
    zeroLiquidationLoanPool = await ZeroLiquidationLoanPool.deployed();
    init_block = (await web3.eth.getBlock("latest")).number - 1;

    borrow_ccy_token_addr = await zeroLiquidationLoanPool.borrow_ccy_token.
      call();
    borrow_ccy_token = new web3.eth.Contract(erc20ABI, borrow_ccy_token_addr);

    collateral_ccy_token_addr = await zeroLiquidationLoanPool.
      collateral_ccy_token.call();
    collateral_ccy_token = new web3.eth.Contract(erc20ABI,
                                                 collateral_ccy_token_addr);
  });

  it("should have initialized lp_end correctly", async () => {
    let lp_end_act = (await zeroLiquidationLoanPool.lp_end.call()).toString();
    let lp_end_exp = (init_block + deploymentConfig.lp_duration).toString();

    expect(lp_end_act).to.equal(lp_end_exp);
  });

  it("should have initialized amm_end correctly", async () => {
    let amm_end_act = (await zeroLiquidationLoanPool.amm_end.call()).toString();
    let amm_end_exp = (init_block + deploymentConfig.lp_duration +
      deploymentConfig.amm_duration).toString();

    expect(amm_end_act).to.equal(amm_end_exp);
  });

  it("should have initialized settlement_end correctly", async () => {
    let settlement_end_act = (await zeroLiquidationLoanPool.settlement_end.
      call()).toString();
    let settlement_end_exp = (init_block + deploymentConfig.lp_duration +
      deploymentConfig.amm_duration + deploymentConfig.settlement_duration).
      toString();

    expect(settlement_end_act).to.equal(settlement_end_exp);
  });

  it("should have initialized collateral ccy correctly", async () => {
    let collateral_ccy_token_symbol = await collateral_ccy_token.methods.
      symbol().call();
    let collateral_ccy_token_decimals = await collateral_ccy_token.methods.
      decimals().call();
    let collateral_ccy_token_total_supply = new BN(await collateral_ccy_token.
                                                         methods.totalSupply().
                                                         call());

    expect(collateral_ccy_token_addr).to.equal(deploymentConfig.collateral_ccy);
    expect(collateral_ccy_token_symbol).to.equal("WETH");
    expect(collateral_ccy_token_decimals).to.equal("18");
    expect(collateral_ccy_token_total_supply).to.be.a.bignumber.that.is.above(
                                              new BN(0));
  });

  it("should have initialized borrow ccy correctly", async () => {
    let borrow_ccy_token_symbol = await borrow_ccy_token.methods.
      symbol().call();
    let borrow_ccy_token_decimals = await borrow_ccy_token.methods.
      decimals().call();
    let borrow_ccy_token_total_supply = new BN(await borrow_ccy_token.methods.
                                                     totalSupply().call());

    expect(borrow_ccy_token_addr).to.equal(deploymentConfig.borrow_ccy);
    expect(borrow_ccy_token_symbol).to.equal("USDC");
    expect(borrow_ccy_token_decimals).to.equal("6");
    expect(borrow_ccy_token_total_supply).to.be.a.bignumber.that.is.above(
                                          new BN(0));
  });

  it("should be possible to access unlocked address to get some collateral ccy",
  async () => {
    // get previous WETH balances of test accounts
    let balance_acc1_prev = await collateral_ccy_token.methods.balanceOf(
     accounts[0]).call();

    // top-up WETH_HOLDER_ADDRESS with ETH to cover gast costs to pay transfers
    // use forceSend, otherwise will revert
    // taken from here: https://github.com/ryanio/truffle-mint-dai/blob/c4631cac37af17dbe80496a1aadb9872e203bc7d/test/sai.js
    const forceSend = await ForceSend.new();
    await forceSend.go(WETH_HOLDER_ADDRESS, { value: ether('1') });

    // top up test accounts with WETH
    let weth_amount = ether('80')
    await collateral_ccy_token.methods.transfer(accounts[0], weth_amount).send({
      from: WETH_HOLDER_ADDRESS
    });

    // get post WETH balances of test accounts
    let balance_acc1_post = await collateral_ccy_token.methods.balanceOf(
      accounts[0]).call();

    expect((balance_acc1_post - balance_acc1_prev).toString()).to.equal(
      weth_amount.toString());
  });

  it("should be possible to access unlocked address to get some borrow ccy",
  async () => {
    // get previous WETH balances of test accounts
    let balance_acc1_prev = await borrow_ccy_token.methods.balanceOf(
     accounts[0]).call();

    // top-up WETH_HOLDER_ADDRESS with ETH to cover gast costs to pay transfers
    // use forceSend, otherwise will revert
    // taken from here: https://github.com/ryanio/truffle-mint-dai/blob/c4631cac37af17dbe80496a1aadb9872e203bc7d/test/sai.js
    const forceSend = await ForceSend.new();
    await forceSend.go(USDC_HOLDER_ADDRESS, { value: ether('1') });

    // top up test accounts with USDC
    let usdc_amount = 80*2000*1000000 // 160'000 USD
    await borrow_ccy_token.methods.transfer(accounts[0], usdc_amount).send({
      from: USDC_HOLDER_ADDRESS
    });

    // get post WETH balances of test accounts
    let balance_acc1_post = await borrow_ccy_token.methods.balanceOf(
      accounts[0]).call();

    expect((balance_acc1_post - balance_acc1_prev).toString()).to.equal(
      usdc_amount.toString());
  });

  it("should initially be in LP period", async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();
    let is_amm_period_active = await zeroLiquidationLoanPool.
      is_amm_period_active();
    let is_settlement_period_active = await zeroLiquidationLoanPool.
      is_settlement_period_active();

    expect(is_lp_period_active).to.be.true;
    expect(is_amm_period_active).to.be.false;
    expect(is_settlement_period_active).to.be.false;
  });

  it("should revert when calling time to expiry during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();
    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.get_time_to_expiry(),
      "AMM period not active");
  });

  it("should revert when calling init_amm during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.initialize_amm(),
      "Can initialize AMM only after LP period");
  });

  it("should revert when calling borrow during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.borrow(1),
      "AMM period not active");
  });

  it("should revert when calling lend during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.lend(1),
      "AMM period not active");
  });

  it("should revert when calling repay&reclaim during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.repay_loan_and_reclaim_collateral(1),
      "Settlement period not active");
  });

  it("should revert when calling AMM repay&reclaim during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.amm_repay_loan_and_reclaim_collateral(ZERO_ADDRESS,
        1),
      "Settlement period not active");
  });

  it("should be fundable by liquidity providers during lp period", async () => {
    let contract_addr = await zeroLiquidationLoanPool.address;
    let borrow_ccy_to_collateral_ccy_ratio = await zeroLiquidationLoanPool.
      borrow_ccy_to_collateral_ccy_ratio.call();
    let decimals = await zeroLiquidationLoanPool.decimals.call();

    let weth_amount = ether('80');
    await collateral_ccy_token.methods.approve(contract_addr, weth_amount).send(
      {from: accounts[0]});

    let usdc_amount = weth_amount.mul(borrow_ccy_to_collateral_ccy_ratio).div(
      decimals);
    await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
      {from: accounts[0]});

    const receipt = await zeroLiquidationLoanPool.
      provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
      { from: accounts[0]} );

    let pool_shares = await zeroLiquidationLoanPool.pool_shares(accounts[0]);
    let collateral_ccy_supply =  await zeroLiquidationLoanPool.
      collateral_ccy_supply.call();
    let borrow_ccy_supply =  await zeroLiquidationLoanPool.borrow_ccy_supply.
      call();

    expect(pool_shares.toString()).to.equal(usdc_amount.toString());
    expect(collateral_ccy_supply.toString()).to.equal(weth_amount.toString());
    expect(borrow_ccy_supply.toString()).to.equal(usdc_amount.toString());
    expectEvent(receipt, 'LiquidityProvided', {
      liquidity_provider: accounts[0],
      block_number: receipt.receipt.blockNumber.toString(),
      collateral_ccy_amount: weth_amount,
      borrow_ccy_amount: usdc_amount,
      shares: pool_shares,
      total_shares: usdc_amount
    });
  });

  it("should be possible to initialize the AMM after the LP period",
  async () => {
    let lp_end = await zeroLiquidationLoanPool.lp_end.call();
    await time.advanceBlockTo(lp_end);
    await zeroLiquidationLoanPool.initialize_amm();

    let amm_is_initialized = await zeroLiquidationLoanPool.amm_is_initialized.
      call();
    let amm_constant_act = await zeroLiquidationLoanPool.amm_constant.call();
    let collateral_ccy_supply = await zeroLiquidationLoanPool.
      collateral_ccy_supply.call();
    let borrow_ccy_supply = await zeroLiquidationLoanPool.borrow_ccy_supply.
      call();
    let amm_constant_exp = collateral_ccy_supply.mul(borrow_ccy_supply);

    expect(amm_is_initialized).to.be.true;
    expect(amm_constant_act.toString()).to.equal(amm_constant_exp.toString());
  });

  it("must not be possible to fund the pool after the LP period", async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active.call();
    let is_amm_period_active = await zeroLiquidationLoanPool.
      is_amm_period_active.call();
    let is_settlement_period_active = await zeroLiquidationLoanPool.
      is_settlement_period_active.call();

    expect(is_lp_period_active).to.be.false;
    expect(is_amm_period_active).to.be.true;
    expect(is_settlement_period_active).to.be.false;
    await expectRevert(zeroLiquidationLoanPool.
      provide_liquidity_and_receive_shares(1, 1, { from: accounts[0]}),
      "LP period not active");
  });
});
