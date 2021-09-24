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

contract("ZeroLiquidationLoanPool", ([liquidity_provider_1,
  liquidity_provider_2, liquidity_provider_3, accounts]) => {

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

  it("must have initialized lp_end correctly", async () => {
    let lp_end_act = (await zeroLiquidationLoanPool.lp_end.call()).toString();
    let lp_end_exp = (init_block + deploymentConfig.lp_duration).toString();

    expect(lp_end_act).to.equal(lp_end_exp);
  });

  it("must have initialized amm_end correctly", async () => {
    let amm_end_act = (await zeroLiquidationLoanPool.amm_end.call()).toString();
    let amm_end_exp = (init_block + deploymentConfig.lp_duration +
      deploymentConfig.amm_duration).toString();

    expect(amm_end_act).to.equal(amm_end_exp);
  });

  it("must have initialized settlement_end correctly", async () => {
    let settlement_end_act = (await zeroLiquidationLoanPool.settlement_end.
      call()).toString();
    let settlement_end_exp = (init_block + deploymentConfig.lp_duration +
      deploymentConfig.amm_duration + deploymentConfig.settlement_duration).
      toString();

    expect(settlement_end_act).to.equal(settlement_end_exp);
  });

  it("must have initialized collateral ccy correctly", async () => {
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

  it("must have initialized borrow ccy correctly", async () => {
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

  it("must be possible to access unlocked address to get some collateral ccy",
  async () => {
    // get previous WETH balances of test accounts
    let balance_acc1_prev = await collateral_ccy_token.methods.balanceOf(
     liquidity_provider_1).call();

    // top-up WETH_HOLDER_ADDRESS with ETH to cover gast costs to pay transfers
    // use forceSend, otherwise will revert
    // taken from here: https://github.com/ryanio/truffle-mint-dai/blob/c4631cac37af17dbe80496a1aadb9872e203bc7d/test/sai.js
    const forceSend = await ForceSend.new();
    await forceSend.go(WETH_HOLDER_ADDRESS, { value: ether('1') });

    // top up test accounts with WETH
    let weth_amount = ether('80')
    await collateral_ccy_token.methods.transfer(liquidity_provider_1, weth_amount).send({
      from: WETH_HOLDER_ADDRESS
    });
    await collateral_ccy_token.methods.transfer(liquidity_provider_2, weth_amount).send({
      from: WETH_HOLDER_ADDRESS
    });
    await collateral_ccy_token.methods.transfer(liquidity_provider_3, weth_amount).send({
      from: WETH_HOLDER_ADDRESS
    });

    // get post WETH balances of test accounts
    let balance_acc1_post = await collateral_ccy_token.methods.balanceOf(
      liquidity_provider_1).call();

    expect((balance_acc1_post - balance_acc1_prev).toString()).to.equal(
      weth_amount.toString());
  });

  it("must be possible to access unlocked address to get some borrow ccy",
  async () => {
    // get previous WETH balances of test accounts
    let balance_acc1_prev = await borrow_ccy_token.methods.balanceOf(
     liquidity_provider_1).call();

    // top-up WETH_HOLDER_ADDRESS with ETH to cover gast costs to pay transfers
    // use forceSend, otherwise will revert
    // taken from here: https://github.com/ryanio/truffle-mint-dai/blob/c4631cac37af17dbe80496a1aadb9872e203bc7d/test/sai.js
    const forceSend = await ForceSend.new();
    await forceSend.go(USDC_HOLDER_ADDRESS, { value: ether('1') });

    // top up test accounts with USDC
    let usdc_amount = 80*2000*1000000 // 160'000 USD
    await borrow_ccy_token.methods.transfer(liquidity_provider_1, usdc_amount).send({
      from: USDC_HOLDER_ADDRESS
    });
    await borrow_ccy_token.methods.transfer(liquidity_provider_2, usdc_amount).send({
      from: USDC_HOLDER_ADDRESS
    });
    await borrow_ccy_token.methods.transfer(liquidity_provider_3, usdc_amount).send({
      from: USDC_HOLDER_ADDRESS
    });

    // get post WETH balances of test accounts
    let balance_acc1_post = await borrow_ccy_token.methods.balanceOf(
      liquidity_provider_1).call();

    expect((balance_acc1_post - balance_acc1_prev).toString()).to.equal(
      usdc_amount.toString());
  });

  it("must initially be in LP period", async () => {
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

  it("must revert when calling time to expiry during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();
    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.get_time_to_expiry(),
      "AMM period not active");
  });

  it("must revert when calling init_amm during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.initialize_amm(),
      "Can initialize AMM only after LP period");
  });

  it("must revert when calling borrow during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.borrow(1),
      "AMM period not active");
  });

  it("must revert when calling lend during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.lend(1),
      "AMM period not active");
  });

  it("must revert when calling repay&reclaim during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.repay_loan_and_reclaim_collateral(1),
      "Settlement period not active");
  });

  it("must revert when calling AMM repay&reclaim during lp_period",
  async () => {
    let is_lp_period_active = await zeroLiquidationLoanPool.
      is_lp_period_active();

    expect(is_lp_period_active).to.be.true;
    await expectRevert(
      zeroLiquidationLoanPool.amm_repay_loan_and_reclaim_collateral(ZERO_ADDRESS,
        1),
      "Settlement period not active");
  });

  it("must be fundable by liquidity providers during lp period", async () => {
    let contract_addr = await zeroLiquidationLoanPool.address;
    let borrow_ccy_to_collateral_ccy_ratio = await zeroLiquidationLoanPool.
      borrow_ccy_to_collateral_ccy_ratio.call();
    let decimals = await zeroLiquidationLoanPool.decimals.call();

    let weth_amount = ether('80');
    await collateral_ccy_token.methods.approve(contract_addr, weth_amount).send(
      {from: liquidity_provider_1});

    let usdc_amount = weth_amount.mul(borrow_ccy_to_collateral_ccy_ratio).div(
      decimals);
    await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
      {from: liquidity_provider_1});

    const receipt = await zeroLiquidationLoanPool.
      provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
      { from: liquidity_provider_1} );

    let pool_shares = await zeroLiquidationLoanPool.pool_shares(liquidity_provider_1);
    let collateral_ccy_supply =  await zeroLiquidationLoanPool.
      collateral_ccy_supply.call();
    let borrow_ccy_supply =  await zeroLiquidationLoanPool.borrow_ccy_supply.
      call();

    expect(pool_shares.toString()).to.equal(usdc_amount.toString());
    expect(collateral_ccy_supply.toString()).to.equal(weth_amount.toString());
    expect(borrow_ccy_supply.toString()).to.equal(usdc_amount.toString());
    expectEvent(receipt, 'LiquidityProvided', {
      liquidity_provider: liquidity_provider_1,
      block_number: receipt.receipt.blockNumber.toString(),
      collateral_ccy_amount: weth_amount,
      borrow_ccy_amount: usdc_amount,
      shares: pool_shares,
      total_shares: usdc_amount
    });
  });

  it("must be possible to have another liquidity provider (1/2)", async () => {
    let contract_addr = await zeroLiquidationLoanPool.address;
    let borrow_ccy_to_collateral_ccy_ratio = await zeroLiquidationLoanPool.
      borrow_ccy_to_collateral_ccy_ratio.call();
    let decimals = await zeroLiquidationLoanPool.decimals.call();

    let weth_amount = ether('41');
    await collateral_ccy_token.methods.approve(contract_addr, weth_amount).send(
      {from: liquidity_provider_2});
    let usdc_amount = weth_amount.mul(borrow_ccy_to_collateral_ccy_ratio).
      div(decimals);
    await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
      {from: liquidity_provider_2});

    let collateral_ccy_supply_prev =  await zeroLiquidationLoanPool.
      collateral_ccy_supply.call();
    let borrow_ccy_supply_prev =  await zeroLiquidationLoanPool.
      borrow_ccy_supply.call();

    const receipt = await zeroLiquidationLoanPool.
      provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
      { from: liquidity_provider_2} );

    let pool_shares = await zeroLiquidationLoanPool.pool_shares(liquidity_provider_2);
    let total_pool_shares = await zeroLiquidationLoanPool.total_pool_shares();
    let collateral_ccy_supply_post =  await zeroLiquidationLoanPool.
      collateral_ccy_supply.call();
    let borrow_ccy_supply_post =  await zeroLiquidationLoanPool.
      borrow_ccy_supply.call();

    let collateral_ccy_supply_diff = collateral_ccy_supply_post.sub(
      collateral_ccy_supply_prev);
    let borow_ccy_supply_diff = borrow_ccy_supply_post.sub(
      borrow_ccy_supply_prev);

    expect(pool_shares.toString()).to.equal(usdc_amount.toString());
    expect(collateral_ccy_supply_diff.toString()).to.equal(
      weth_amount.toString());
    expect(borow_ccy_supply_diff.toString()).to.equal(usdc_amount.toString());
    expectEvent(receipt, 'LiquidityProvided', {
      liquidity_provider: liquidity_provider_2,
      block_number: receipt.receipt.blockNumber.toString(),
      collateral_ccy_amount: weth_amount,
      borrow_ccy_amount: usdc_amount,
      shares: pool_shares,
      total_shares: total_pool_shares
    });
  });

  it("must be possible to have another liquidity provider (2/2)", async () => {
    let contract_addr = await zeroLiquidationLoanPool.address;
    let borrow_ccy_to_collateral_ccy_ratio = await zeroLiquidationLoanPool.
      borrow_ccy_to_collateral_ccy_ratio.call();
    let decimals = await zeroLiquidationLoanPool.decimals.call();

    let weth_amount = ether('28');
    await collateral_ccy_token.methods.approve(contract_addr, weth_amount).send(
      {from: liquidity_provider_3});
    let usdc_amount = weth_amount.mul(borrow_ccy_to_collateral_ccy_ratio).
      div(decimals);
    await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
      {from: liquidity_provider_3});

      let collateral_ccy_supply_prev =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let borrow_ccy_supply_prev =  await zeroLiquidationLoanPool.
        borrow_ccy_supply.call();

      const receipt = await zeroLiquidationLoanPool.
        provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
        { from: liquidity_provider_3} );

      let pool_shares = await zeroLiquidationLoanPool.pool_shares(liquidity_provider_3);
      let total_pool_shares = await zeroLiquidationLoanPool.total_pool_shares();
      let collateral_ccy_supply_post =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let borrow_ccy_supply_post =  await zeroLiquidationLoanPool.
        borrow_ccy_supply.call();

      let collateral_ccy_supply_diff = collateral_ccy_supply_post.sub(
        collateral_ccy_supply_prev);
      let borow_ccy_supply_diff = borrow_ccy_supply_post.sub(
        borrow_ccy_supply_prev);

      expect(pool_shares.toString()).to.equal(usdc_amount.toString());
      expect(collateral_ccy_supply_diff.toString()).to.equal(
        weth_amount.toString());
      expect(borow_ccy_supply_diff.toString()).to.equal(usdc_amount.toString());
      expectEvent(receipt, 'LiquidityProvided', {
        liquidity_provider: liquidity_provider_3,
        block_number: receipt.receipt.blockNumber.toString(),
        collateral_ccy_amount: weth_amount,
        borrow_ccy_amount: usdc_amount,
        shares: pool_shares,
        total_shares: total_pool_shares
      });
  });

  it("must not be possible provide liquidity in wrong ratio", async () => {
  });

  it("must not be possible repay loan and reclaim collateral during lp period",
  async () => {
    // user
    // AMM
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
      provide_liquidity_and_receive_shares(1, 1, { from: liquidity_provider_1}),
      "LP period not active");
  });

  it("must not be possible repay loan and reclaim collateral during AMM period",
  async () => {
    await expectRevert(zeroLiquidationLoanPool.
      repay_loan_and_reclaim_collateral(0, { from: liquidity_provider_1}),
      "Settlement period not active");
  });

  //describe('round started', function () {

  it("must calculate borrowable amounts correctyl", async () => {
    let borrowable_amount_for_10th_ETH = await zeroLiquidationLoanPool.
      get_borrowable_amount(ether('0.1'));
    let borrowable_amount_for_1_ETH = await zeroLiquidationLoanPool.
      get_borrowable_amount(ether('1'));
    let borrowable_amount_for_2_ETH = await zeroLiquidationLoanPool.
      get_borrowable_amount(ether('2'));
    let borrowable_amount_for_3_ETH = await zeroLiquidationLoanPool.
      get_borrowable_amount(ether('3'));
    let borrowable_amount_for_10_ETH = await zeroLiquidationLoanPool.
      get_borrowable_amount(ether('10'));
    let borrowable_amount_for_100_ETH = await zeroLiquidationLoanPool.
      get_borrowable_amount(ether('100'));

    // d_Q_K = Q_K - k / (Q_S + d_Q_S)
    // k = 298000000000*149000000000000000000
    // d_Q_K = 298000000000 - k / (149000000000000000000+d_Q_S*10^18)
    expect(borrowable_amount_for_10th_ETH.toString()).to.equal("199865862");
    expect(borrowable_amount_for_1_ETH.toString()).to.equal("1986666667");
    expect(borrowable_amount_for_2_ETH.toString()).to.equal("3947019868");
    expect(borrowable_amount_for_3_ETH.toString()).to.equal("5881578948");
    expect(borrowable_amount_for_10_ETH.toString()).to.equal("18742138365");
    expect(borrowable_amount_for_100_ETH.toString()).to.equal("119678714860");
  });

  it("must calculate loanable amounts correctly", async () => {
    let loanable_amount_for_10th_ETH = await zeroLiquidationLoanPool.
      get_loanable_amount(ether('0.1'));
    let loanable_amount_for_1_ETH = await zeroLiquidationLoanPool.
      get_loanable_amount(ether('1'));
    let loanable_amount_for_2_ETH = await zeroLiquidationLoanPool.
      get_loanable_amount(ether('2'));
    let loanable_amount_for_3_ETH = await zeroLiquidationLoanPool.
      get_loanable_amount(ether('3'));
    let loanable_amount_for_10_ETH = await zeroLiquidationLoanPool.
      get_loanable_amount(ether('10'));
    let loanable_amount_for_100_ETH = await zeroLiquidationLoanPool.
      get_loanable_amount(ether('100'));

    // d_Q_K = k / (Q_S - d_Q_S) - Q_K
    // k = 298000000000*149000000000000000000
    // d_Q_K = k / (149000000000000000000 - d_Q_S*10^18) - 298000000000
    expect(loanable_amount_for_10th_ETH.toString()).to.equal("200134318");
    expect(loanable_amount_for_1_ETH.toString()).to.equal("2013513513");
    expect(loanable_amount_for_2_ETH.toString()).to.equal("4054421768");
    expect(loanable_amount_for_3_ETH.toString()).to.equal("6123287671");
    expect(loanable_amount_for_10_ETH.toString()).to.equal("21438848920");
    expect(loanable_amount_for_100_ETH.toString()).to.equal("608163265306");
  });

  it("must calculate time to expiry correctly", async () => {
    let decimals = await zeroLiquidationLoanPool.decimals();
    let lp_end = await zeroLiquidationLoanPool.lp_end();
    let amm_end = await zeroLiquidationLoanPool.amm_end();
    let block_number = new BN((await web3.eth.getBlock("latest")).number);
    let blocks_to_expiry = amm_end.sub(block_number);

    let time_to_expiry_exp = (amm_end.sub(block_number)).mul(decimals).div(
      amm_end.sub(lp_end));
    let time_to_expiry_sqrt_exp = Math.trunc(Math.sqrt(time_to_expiry_exp.
      toNumber()*decimals.toNumber()));
    let res = await zeroLiquidationLoanPool.get_time_to_expiry();

    expect(res['0'].toString()).to.equal(time_to_expiry_exp.toString());
    expect(res['1'].toString()).to.equal(time_to_expiry_sqrt_exp.toString());

    await time.advanceBlockTo(amm_end);
    res = await zeroLiquidationLoanPool.get_time_to_expiry();
    expect(res['0'].toString()).to.equal("0");
  });

  it("must calculate oblivious put price correctly", async () => {
  });

  it("can update oblivious put price parameters", async () => {
  });

  it("can let users borrow during AMM period", async () => {
  });

  it("can let users lend during AMM period", async () => {
  });

  it("must let borrowers repay their loan during settlement period",
  async () => {
  });

  it("must not be possible to repay loan twice", async () => {
  });

  it("must let AMM repay its loan during settlement period", async () => {
  });

  it("must let liquidity providers redeem their shares after settlement period",
  async () => {
  });
});
