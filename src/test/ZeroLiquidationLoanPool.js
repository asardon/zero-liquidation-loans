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
const deploymentConfig = require("../config/deploymentConfigTestMainnetForkWethUsdc.json");

console.log("Make sure to run ganache with matching unlock addreses.")
console.log("Tests expect the following addresses to be unlocked:")
console.log("USDC address: " + USDC_HOLDER_ADDRESS);
console.log("USDC WETH_HOLDER_ADDRESS: " + WETH_HOLDER_ADDRESS);

contract("ZeroLiquidationLoanPool", ([deployer, liquidity_provider_1,
  liquidity_provider_2, liquidity_provider_3, liquidity_provider_4, borrower,
  lender, accounts]) => {

  var init_block = 0;
  var borrow_ccy_token_addr = "";
  var borrow_ccy_token = "";
  var collateral_ccy_token = "";
  var collateral_ccy_token_addr = "";
  var contract_addr = "";


  before(async () => {
    zeroLiquidationLoanPool = await ZeroLiquidationLoanPool.deployed();
    contract_addr = await zeroLiquidationLoanPool.address;
    init_block = (await web3.eth.getBlock("latest")).number - 1;

    borrow_ccy_token_addr = await zeroLiquidationLoanPool.borrow_ccy_token.
      call();
    borrow_ccy_token = new web3.eth.Contract(erc20ABI, borrow_ccy_token_addr);

    collateral_ccy_token_addr = await zeroLiquidationLoanPool.
      collateral_ccy_token.call();
    collateral_ccy_token = new web3.eth.Contract(erc20ABI,
                                                 collateral_ccy_token_addr);
  });

  describe('Initialization unit tests', function () {

    it("must have initialized lp_end correctly", async () => {
      let lp_end_act = (await zeroLiquidationLoanPool.lp_end.call()).toString();
      let lp_end_exp = (new BN(init_block)).add(
        new BN(deploymentConfig.lp_duration)).toString();

      expect(lp_end_act).to.equal(lp_end_exp);
    });

    it("must have initialized amm_end correctly", async () => {
      let amm_end_act = (await zeroLiquidationLoanPool.amm_end.call()).toString();
      let amm_end_exp = (new BN(init_block)).add(
        new BN(deploymentConfig.lp_duration)).add(
          new BN(deploymentConfig.amm_duration)).toString();

      expect(amm_end_act).to.equal(amm_end_exp);
    });

    it("must have initialized settlement_end correctly", async () => {
      let settlement_end_act = (await zeroLiquidationLoanPool.settlement_end.
        call()).toString();
      let settlement_end_exp = (new BN(init_block)).add(
        new BN(deploymentConfig.lp_duration)).add(
          new BN(deploymentConfig.amm_duration)).add(
            new BN(deploymentConfig.settlement_duration)).toString();

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

    it("must have initialized alpha correctly", async () => {
      let alpha = await zeroLiquidationLoanPool.alpha();
      expect(alpha.toString()).to.equal(deploymentConfig.alpha.toString());
    });

    it("must have initialized collateral_price correctly", async () => {
      let collateral_price = await zeroLiquidationLoanPool.collateral_price();
      expect(collateral_price.toString()).to.equal(deploymentConfig.
        init_collateral_price.toString());
    });

    it("must have initialized collateral_price_annualized_vol correctly",
      async () => {
      let collateral_price_annualized_vol = await zeroLiquidationLoanPool.
        collateral_price_annualized_vol();
      expect(collateral_price_annualized_vol.toString()).to.equal(
        deploymentConfig.init_collateral_price_annualized_vol.toString());
    });

    it("must have initialized blocks_per_year correctly", async () => {
      let blocks_per_year = await zeroLiquidationLoanPool.blocks_per_year();
      expect(blocks_per_year.toString()).to.equal(deploymentConfig.
        blocks_per_year.toString());
    });

    it("must have initialized decimals correctly", async () => {
      let calc_decimals = await zeroLiquidationLoanPool.calc_decimals();
      expect(calc_decimals.toString()).to.equal(deploymentConfig.decimals.
        toString());
    });

    it("must be possible to access unlocked address to get some collateral ccy",
    async () => {
      // get previous WETH balances of test accounts
      let balance_acc1_prev = await collateral_ccy_token.methods.balanceOf(
        liquidity_provider_1).call();
      let balance_acc2_prev = await collateral_ccy_token.methods.balanceOf(
        liquidity_provider_2).call();
      let balance_acc3_prev = await collateral_ccy_token.methods.balanceOf(
        liquidity_provider_3).call();
      let balance_acc4_prev = await collateral_ccy_token.methods.balanceOf(
        liquidity_provider_4).call();
      let balance_borrower_prev = await collateral_ccy_token.methods.balanceOf(
        borrower).call();
      // top-up WETH_HOLDER_ADDRESS with ETH to cover gast costs to pay transfers
      // use forceSend, otherwise will revert
      // taken from here: https://github.com/ryanio/truffle-mint-dai/blob/c4631cac37af17dbe80496a1aadb9872e203bc7d/test/sai.js
      const forceSend = await ForceSend.new();
      await forceSend.go(WETH_HOLDER_ADDRESS, { value: ether('1') });

      // top up test accounts with WETH
      let weth_amount_lp_1 = ether('80')
      await collateral_ccy_token.methods.transfer(liquidity_provider_1,
        weth_amount_lp_1).send({from: WETH_HOLDER_ADDRESS});

      let weth_amount_lp_2 = ether('41')
      await collateral_ccy_token.methods.transfer(liquidity_provider_2,
        weth_amount_lp_2).send({from: WETH_HOLDER_ADDRESS});

      let weth_amount_lp_3 = ether('28')
      await collateral_ccy_token.methods.transfer(liquidity_provider_3,
        weth_amount_lp_3).send({from: WETH_HOLDER_ADDRESS});

      let weth_amount_lp_4 = ether('10')
      await collateral_ccy_token.methods.transfer(liquidity_provider_4,
        weth_amount_lp_4).send({from: WETH_HOLDER_ADDRESS});

      let weth_amount_borrower = ether('80')
      await collateral_ccy_token.methods.transfer(borrower,
        weth_amount_borrower).send({from: WETH_HOLDER_ADDRESS});

      // get post WETH balances of test accounts
      let balance_acc1_post = await collateral_ccy_token.methods.balanceOf(
        liquidity_provider_1).call();
      let balance_acc2_post = await collateral_ccy_token.methods.balanceOf(
        liquidity_provider_2).call();
      let balance_acc3_post = await collateral_ccy_token.methods.balanceOf(
        liquidity_provider_3).call();
      let balance_acc4_post = await collateral_ccy_token.methods.balanceOf(
        liquidity_provider_4).call();
      let balance_borrower_post = await collateral_ccy_token.methods.balanceOf(
        borrower).call();

      expect((balance_acc1_post - balance_acc1_prev).toString()).to.equal(
        weth_amount_lp_1.toString());
      expect((balance_acc2_post - balance_acc2_prev).toString()).to.equal(
        weth_amount_lp_2.toString());
      expect((balance_acc3_post - balance_acc3_prev).toString()).to.equal(
        weth_amount_lp_3.toString());
      expect((balance_acc4_post - balance_acc4_prev).toString()).to.equal(
        weth_amount_lp_4.toString());
      expect((balance_borrower_post - balance_borrower_prev).toString()).to.
        equal(weth_amount_borrower.toString());
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
      await borrow_ccy_token.methods.transfer(liquidity_provider_1,
        usdc_amount).send({from: USDC_HOLDER_ADDRESS});
      await borrow_ccy_token.methods.transfer(liquidity_provider_2,
        usdc_amount).send({from: USDC_HOLDER_ADDRESS});
      await borrow_ccy_token.methods.transfer(liquidity_provider_3,
        usdc_amount).send({from: USDC_HOLDER_ADDRESS});
      await borrow_ccy_token.methods.transfer(liquidity_provider_4,
        usdc_amount).send({from: USDC_HOLDER_ADDRESS});
      await borrow_ccy_token.methods.transfer(borrower, 1000000000).send(
        {from: USDC_HOLDER_ADDRESS}); // 1k, to cover for interest costs
      await borrow_ccy_token.methods.transfer(lender, 100000000000).send(
        {from: USDC_HOLDER_ADDRESS}); // 100k

      // get post WETH balances of test accounts
      let balance_acc1_post = await borrow_ccy_token.methods.balanceOf(
        liquidity_provider_1).call();

      expect((balance_acc1_post - balance_acc1_prev).toString()).to.equal(
        usdc_amount.toString());
    });

  });

  describe('LP period unit tests', function () {

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
        "AMM initialization pending");
    });

    it("must revert when calling borrow during lp_period",
    async () => {
      let is_lp_period_active = await zeroLiquidationLoanPool.
        is_lp_period_active();

      expect(is_lp_period_active).to.be.true;
      await expectRevert(
        zeroLiquidationLoanPool.borrow(1, 1),
        "AMM period not active");
    });

    it("must revert when calling lend during lp_period",
    async () => {
      let is_lp_period_active = await zeroLiquidationLoanPool.
        is_lp_period_active();

      expect(is_lp_period_active).to.be.true;
      await expectRevert(
        zeroLiquidationLoanPool.lend(1, 1),
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
        zeroLiquidationLoanPool.amm_repay_loan_and_reclaim_collateral(
          ZERO_ADDRESS, 1),
        "Settlement period not active");
    });

    it("must revert when trying to redeem shares during settlement period",
    async () => {
      await expectRevert(
        zeroLiquidationLoanPool.redeem_shares(),
        "Post-settlement period not active");
    });

    it("must calculate liquidity provisioning amounts correctly (1/5)",
    async () => {
      let weth_amount = ether('1');
      let usdc_amount = await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount);
      expect(usdc_amount.toString()).to.equal("2000000000");
    });

    it("must calculate liquidity provisioning amounts correctly (2/5)",
    async () => {
      let usdc_amount = "2000000000" // 2000 USDC
      let weth_amount = await zeroLiquidationLoanPool.get_lp_collateral_ccy_amount(
        usdc_amount);
      expect(weth_amount.toString()).to.equal("1000000000000000000");
    });

    it("must calculate liquidity provisioning amounts correctly (3/5)",
    async () => {
      let weth_amount = ether('3');
      let usdc_amount = await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount);
      let weth_amount_inverse = await zeroLiquidationLoanPool.
        get_lp_collateral_ccy_amount(usdc_amount);
      expect(weth_amount.toString()).to.equal(weth_amount_inverse.toString());
    });

    it("must calculate liquidity provisioning amounts correctly (4/5)",
    async () => {
      // note: calculating to-be-provisioned amounts not reversable for
      // small amounts
      let weth_amount = "312572182";
      let usdc_amount = await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount);
      let weth_amount_inverse = await zeroLiquidationLoanPool.
        get_lp_collateral_ccy_amount(usdc_amount);
      expect("0").to.equal(weth_amount_inverse.toString());
    });

    it("must calculate liquidity provisioning amounts correctly (5/5)",
    async () => {
      // note: calculating to-be-provisioned amounts only reversable for
      // sufficiently large amounts
      let weth_amount = "100000000000000000";
      let usdc_amount = await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount);
      let weth_amount_inverse = await zeroLiquidationLoanPool.
        get_lp_collateral_ccy_amount(usdc_amount);
      expect(weth_amount).to.equal(weth_amount_inverse.toString());
    });

    it("must be fundable by liquidity providers during LP period (1/5)",
    async () => {
      let weth_amount = ether('80');
      await collateral_ccy_token.methods.approve(contract_addr, weth_amount).
        send({from: liquidity_provider_1});

      let usdc_amount = await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount);
      await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
        {from: liquidity_provider_1});

      let receipt = await zeroLiquidationLoanPool.
        provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
        { from: liquidity_provider_1} );

      let pool_shares = await zeroLiquidationLoanPool.pool_shares(
        liquidity_provider_1);
      let collateral_ccy_supply =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let collateral_ccy_supply_act =  await collateral_ccy_token.methods.
        balanceOf(contract_addr).call();
      let borrow_ccy_supply =  await zeroLiquidationLoanPool.borrow_ccy_supply.
        call();
      let borrow_ccy_supply_act =  await borrow_ccy_token.methods.balanceOf(
        contract_addr).call();

      expect(pool_shares.toString()).to.equal(usdc_amount.toString());
      expect(collateral_ccy_supply.toString()).to.equal(weth_amount.toString());
      expect(collateral_ccy_supply.toString()).to.equal(
        collateral_ccy_supply_act.toString());
      expect(borrow_ccy_supply.toString()).to.equal(usdc_amount.toString());
      expect(borrow_ccy_supply.toString()).to.equal(
        borrow_ccy_supply_act.toString());
      expectEvent(receipt, 'ProvideLiquidity', {
        liquidity_provider: liquidity_provider_1,
        collateral_ccy_amount: weth_amount,
        borrow_ccy_amount: usdc_amount,
        shares: pool_shares,
        total_shares: usdc_amount
      });
    });

    it("must be fundable by liquidity providers during LP period (2/5)",
    async () => {
      let usdc_amount = "10000000000";
      await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).
        send({from: liquidity_provider_4});

      let weth_amount = await zeroLiquidationLoanPool.
        get_lp_collateral_ccy_amount(usdc_amount);
      let usdc_amount_exp = await zeroLiquidationLoanPool.
        get_lp_borrow_ccy_amount(weth_amount);
      expect(usdc_amount_exp.toString()).to.equal(usdc_amount.toString());

      await collateral_ccy_token.methods.approve(contract_addr, weth_amount).
        send({from: liquidity_provider_4});

      let pool_shares_pre = await zeroLiquidationLoanPool.pool_shares(
        liquidity_provider_4);
      let collateral_ccy_supply_pre =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let borrow_ccy_supply_pre =  await zeroLiquidationLoanPool.
        borrow_ccy_supply.call();

      let receipt = await zeroLiquidationLoanPool.
        provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
        { from: liquidity_provider_4} );

      let pool_shares_post = await zeroLiquidationLoanPool.pool_shares(
        liquidity_provider_4);
      let collateral_ccy_supply_post =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let borrow_ccy_supply_post =  await zeroLiquidationLoanPool.
        borrow_ccy_supply.call();

      let pool_shares_diff = (new BN(pool_shares_post)).sub(new BN(
        pool_shares_pre))
      let collateral_ccy_supply_diff = (new BN(collateral_ccy_supply_post)).sub(
        new BN(collateral_ccy_supply_pre))
      let borrow_ccy_supply_diff = (new BN(borrow_ccy_supply_post)).sub(
        new BN(borrow_ccy_supply_pre))
      let total_pool_shares = await zeroLiquidationLoanPool.total_pool_shares();

      expect(pool_shares_diff.toString()).to.equal(usdc_amount.toString());
      expect(collateral_ccy_supply_diff.toString()).to.equal(
        weth_amount.toString());
      expect(borrow_ccy_supply_diff.toString()).to.equal(
        usdc_amount.toString());
      expectEvent(receipt, 'ProvideLiquidity', {
        liquidity_provider: liquidity_provider_4,
        collateral_ccy_amount: weth_amount,
        borrow_ccy_amount: usdc_amount,
        shares: pool_shares_post,
        total_shares: total_pool_shares
      });
    });

    it("must be fundable by liquidity providers during LP period (3/5)",
    async () => {
      let weth_amount = ether('41');
      await collateral_ccy_token.methods.approve(contract_addr, weth_amount).
        send({from: liquidity_provider_2});

      let usdc_amount = await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount);
      await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
        {from: liquidity_provider_2});

      let collateral_ccy_supply_prev =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let borrow_ccy_supply_prev =  await zeroLiquidationLoanPool.
        borrow_ccy_supply.call();

      let receipt = await zeroLiquidationLoanPool.
        provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
        { from: liquidity_provider_2} );

      let pool_shares = await zeroLiquidationLoanPool.pool_shares(
        liquidity_provider_2);
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
      expectEvent(receipt, 'ProvideLiquidity', {
        liquidity_provider: liquidity_provider_2,
        collateral_ccy_amount: weth_amount,
        borrow_ccy_amount: usdc_amount,
        shares: pool_shares,
        total_shares: total_pool_shares
      });
    });

    it("must be fundable by liquidity providers during LP period (4/5)",
    async () => {
      let weth_amount = ether('28');
      await collateral_ccy_token.methods.approve(contract_addr, weth_amount).
        send({from: liquidity_provider_3});

      let usdc_amount = await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount);
      await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
        {from: liquidity_provider_3});

      let collateral_ccy_supply_prev =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let borrow_ccy_supply_prev =  await zeroLiquidationLoanPool.
        borrow_ccy_supply.call();

      let receipt = await zeroLiquidationLoanPool.
        provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
        { from: liquidity_provider_3} );

      let pool_shares = await zeroLiquidationLoanPool.pool_shares(
        liquidity_provider_3);
      let total_pool_shares = await zeroLiquidationLoanPool.
        total_pool_shares();
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
      expect(borow_ccy_supply_diff.toString()).to.equal(
        usdc_amount.toString());
      expectEvent(receipt, 'ProvideLiquidity', {
        liquidity_provider: liquidity_provider_3,
        collateral_ccy_amount: weth_amount,
        borrow_ccy_amount: usdc_amount,
        shares: pool_shares,
        total_shares: total_pool_shares
      });
    });

    it("must be fundable by liquidity providers during LP period (5/5)",
    async () => {
      // test with smaller amount
      let weth_amount = "123523231231";
      await collateral_ccy_token.methods.approve(contract_addr, weth_amount).
        send({from: liquidity_provider_4});

      let usdc_amount = (await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount)).toString();
      expect(usdc_amount).to.equal("247");

      let weth_amount_exp = (await zeroLiquidationLoanPool.
        get_lp_collateral_ccy_amount(usdc_amount)).toString();
      expect(weth_amount_exp).to.equal("123500000000");
      let usdc_amount_exp = (await zeroLiquidationLoanPool.
        get_lp_borrow_ccy_amount(weth_amount_exp)).toString();

      await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
        {from: liquidity_provider_4});

      let pool_shares_pre = await zeroLiquidationLoanPool.pool_shares(
        liquidity_provider_4);
      let collateral_ccy_supply_pre =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let borrow_ccy_supply_pre =  await zeroLiquidationLoanPool.
        borrow_ccy_supply.call();

      let receipt = await zeroLiquidationLoanPool.
        provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
        { from: liquidity_provider_4} );

      let pool_shares_post = await zeroLiquidationLoanPool.pool_shares(
        liquidity_provider_4);
      let collateral_ccy_supply_post =  await zeroLiquidationLoanPool.
        collateral_ccy_supply.call();
      let borrow_ccy_supply_post =  await zeroLiquidationLoanPool.
        borrow_ccy_supply.call();

      let pool_shares_diff = (new BN(pool_shares_post)).sub(new BN(
        pool_shares_pre))
      let collateral_ccy_supply_diff = (new BN(collateral_ccy_supply_post)).sub(
        new BN(collateral_ccy_supply_pre))
      let borrow_ccy_supply_diff = (new BN(borrow_ccy_supply_post)).sub(
        new BN(borrow_ccy_supply_pre))
      let total_pool_shares = await zeroLiquidationLoanPool.total_pool_shares();

      expect(pool_shares_diff.toString()).to.equal(usdc_amount.toString());
      expect(collateral_ccy_supply_diff.toString()).to.equal(
        weth_amount.toString());
      expect(borrow_ccy_supply_diff.toString()).to.equal(
        usdc_amount.toString());
      expectEvent(receipt, 'ProvideLiquidity', {
        liquidity_provider: liquidity_provider_4,
        collateral_ccy_amount: weth_amount,
        borrow_ccy_amount: usdc_amount,
        shares: pool_shares_post,
        total_shares: total_pool_shares
      });
    });

    it("must not be possible provide liquidity in wrong ratio", async () => {
      let weth_amount = ether('1');
      await collateral_ccy_token.methods.approve(contract_addr, weth_amount).
        send({from: liquidity_provider_3});

      let usdc_amount = new BN(await zeroLiquidationLoanPool.get_lp_borrow_ccy_amount(
        weth_amount));
      usdc_amount = usdc_amount.add(new BN(1));
      await borrow_ccy_token.methods.approve(contract_addr, usdc_amount).send(
        {from: liquidity_provider_3});

      await expectRevert(zeroLiquidationLoanPool.
        provide_liquidity_and_receive_shares(weth_amount, usdc_amount,
        { from: liquidity_provider_3} ), "Unexpected amounts");
    });

    it("must not be possible repay loan and reclaim collateral during LP period",
    async () => {
      await expectRevert(zeroLiquidationLoanPool.
        repay_loan_and_reclaim_collateral(0, { from: liquidity_provider_1}),
        "Settlement period not active");
      await expectRevert(zeroLiquidationLoanPool.
        amm_repay_loan_and_reclaim_collateral(ZERO_ADDRESS, 0,
        { from: liquidity_provider_1}), "Settlement period not active");
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

    it("must not be possible to fund the pool after the LP period",
    async () => {
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
        provide_liquidity_and_receive_shares(1, 1,
        {from: liquidity_provider_1}), "LP period not active");
    });

  });

  describe('AMM period unit tests', function () {

    it("must not be possible repay loan and reclaim collateral during AMM period",
    async () => {
      await expectRevert(zeroLiquidationLoanPool.
        repay_loan_and_reclaim_collateral(0, { from: liquidity_provider_1}),
        "Settlement period not active");
      await expectRevert(zeroLiquidationLoanPool.
        amm_repay_loan_and_reclaim_collateral(ZERO_ADDRESS, 0,
        { from: liquidity_provider_1}), "Settlement period not active");
    });

    it("must revert when trying to redeem shares during settlement period",
    async () => {
      await expectRevert(
        zeroLiquidationLoanPool.redeem_shares(),
        "Post-settlement period not active");
    });

    it("must have correct AMM values (1/3)", async () => {
      let collateral_ccy_supply = await zeroLiquidationLoanPool.
        collateral_ccy_supply();
      let borrow_ccy_supply = await zeroLiquidationLoanPool.borrow_ccy_supply();
      let amm_constant = await zeroLiquidationLoanPool.amm_constant();

      expect(collateral_ccy_supply.toString()).to.equal(
        "154000000123523231231");
      expect(borrow_ccy_supply.toString()).to.equal("308000000247");
      expect(amm_constant.toString()).to.equal(
        "47432000076083155249658238114057");
    });

    it("must calculate borrowable amounts correctly (2/3)", async () => {
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
      // k = 44402000000000000000000000000000
      // d_Q_K = 298000000000 - k / (149000000000000000000+d_Q_S*10^18)
      expect(borrowable_amount_for_10th_ETH.toString()).to.equal("199870215");
      expect(borrowable_amount_for_1_ETH.toString()).to.equal("1987096775");
      expect(borrowable_amount_for_2_ETH.toString()).to.equal("3948717949");
      expect(borrowable_amount_for_3_ETH.toString()).to.equal("5885350319");
      expect(borrowable_amount_for_10_ETH.toString()).to.equal("18780487806");
      expect(borrowable_amount_for_100_ETH.toString()).to.equal("121259842558");
    });

    it("must calculate pledgeable amounts correctly (3/3)", async () => {
      let pledgeable_amount_for_100_USDC = await zeroLiquidationLoanPool.
        get_pledgeable_amount("100000000");
      let pledgeable_amount_for_500_USDC = await zeroLiquidationLoanPool.
        get_pledgeable_amount("500000000");
      let pledgeable_amount_for_1000_USDC = await zeroLiquidationLoanPool.
        get_pledgeable_amount("1000000000");
      let pledgeable_amount_for_10000_USDC = await zeroLiquidationLoanPool.
        get_pledgeable_amount("10000000000");
      let pledgeable_amount_for_100000_USDC = await zeroLiquidationLoanPool.
        get_pledgeable_amount("100000000000");
      let pledgeable_amount_for_1000000_USDC = await zeroLiquidationLoanPool.
        get_pledgeable_amount("1000000000000");

      pledgeable_amount_for_100_USDC = web3.utils.fromWei(
        pledgeable_amount_for_100_USDC, 'ether');
      pledgeable_amount_for_500_USDC = web3.utils.fromWei(
        pledgeable_amount_for_500_USDC, 'ether');
      pledgeable_amount_for_1000_USDC = web3.utils.fromWei(
        pledgeable_amount_for_1000_USDC, 'ether');
      pledgeable_amount_for_10000_USDC = web3.utils.fromWei(
        pledgeable_amount_for_10000_USDC, 'ether');
      pledgeable_amount_for_100000_USDC = web3.utils.fromWei(
        pledgeable_amount_for_100000_USDC, 'ether');
      pledgeable_amount_for_1000000_USDC = web3.utils.fromWei(
        pledgeable_amount_for_1000000_USDC, 'ether');

      // d_Q_S = Q_S - k / (Q_K + d_Q_K)
      // k = 44402000000000000000000000000000
      // d_Q_S = 149000000000000000000 - k / (298000000000 + d_Q_K*10^6)
      expect(pledgeable_amount_for_100_USDC.toString()).to.equal(
        "0.049983771502779395");
      expect(pledgeable_amount_for_500_USDC.toString()).to.equal(
        "0.249594813614624625");
      expect(pledgeable_amount_for_1000_USDC.toString()).to.equal(
        "0.498381877024022355");
      expect(pledgeable_amount_for_10000_USDC.toString()).to.equal(
        "4.842767295720342108");
      expect(pledgeable_amount_for_100000_USDC.toString()).to.equal(
        "37.74509804664040173");
      expect(pledgeable_amount_for_1000000_USDC.toString()).to.equal(
        "117.737003130307485825");
    });

    it("must calculate time to expiry correctly (1/2)", async () => {
      let calc_decimals = await zeroLiquidationLoanPool.calc_decimals();
      let lp_end = await zeroLiquidationLoanPool.lp_end();
      let amm_end = await zeroLiquidationLoanPool.amm_end();
      let block_number = new BN((await web3.eth.getBlock("latest")).number);
      let blocks_per_year = await zeroLiquidationLoanPool.blocks_per_year();

      let time_to_expiry_exp = (amm_end.sub(block_number)).mul(calc_decimals).
        div(blocks_per_year);
      let time_to_expiry_sqrt_exp = Math.trunc(Math.sqrt(time_to_expiry_exp.
        toNumber()*calc_decimals.toNumber()));
      let res = await zeroLiquidationLoanPool.get_time_to_expiry();

      expect(res['0'].toString()).to.equal(time_to_expiry_exp.toString());
      expect(res['1'].toString()).to.equal(time_to_expiry_sqrt_exp.toString());
    });

    it("must calculate oblivious put price correctly", async () => {
      let alpha = await zeroLiquidationLoanPool.alpha();
      let collateral_price = await zeroLiquidationLoanPool.collateral_price();
      let collateral_price_annualized_vol = await zeroLiquidationLoanPool.
        collateral_price_annualized_vol();
      let res = await zeroLiquidationLoanPool.get_time_to_expiry();
      let sqrt_time_to_expiry = res['1'];
      let calc_decimals = await zeroLiquidationLoanPool.calc_decimals();

      let oblivious_put_price_exp = alpha.mul(collateral_price).mul(
        collateral_price_annualized_vol).mul(sqrt_time_to_expiry).div(
          calc_decimals).div(calc_decimals).div(calc_decimals);
      let oblivious_put_price = await zeroLiquidationLoanPool.
        get_oblivious_put_price(sqrt_time_to_expiry);
      expect(oblivious_put_price.toString()).to.equal(oblivious_put_price_exp.
        toString());
    });

    it("owner can update oblivious put price parameters", async () => {
      await zeroLiquidationLoanPool.update_oblivious_put_price_params(
        2000000000, 1200000000000, 2102400, { "from": deployer }
      );
      let collateral_price = await zeroLiquidationLoanPool.collateral_price();
      let collateral_price_annualized_vol = await zeroLiquidationLoanPool.
        collateral_price_annualized_vol();
      let blocks_per_year = await zeroLiquidationLoanPool.blocks_per_year();
      expect(collateral_price.toString()).to.equal("2000000000");
      expect(collateral_price_annualized_vol.toString()).to.equal(
        "1200000000000");
      expect(blocks_per_year.toString()).to.equal("2102400");
    });

    it("non-owner cannot update oblivious put price parameters", async () => {
      await expectRevert(zeroLiquidationLoanPool.
        update_oblivious_put_price_params(2000000000, 1200000000000, 2102400,
        { "from": liquidity_provider_1 }), "Ownable: caller is not the owner");
    });

    it("can let users borrow during AMM period", async () => {
      let borrower_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
        balanceOf(borrower).call());
      let borrower_weth_balance_pre = new BN(await collateral_ccy_token.methods.
        balanceOf(borrower).call());

      let amm_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
        balanceOf(contract_addr).call());
      let amm_weth_balance_pre = new BN(await collateral_ccy_token.methods.
        balanceOf(contract_addr).call());

      let weth_pledged_amount = ether('8');
      let borrowing_terms = await zeroLiquidationLoanPool.get_borrowing_terms(
        weth_pledged_amount);

      // allow 10bps diff in lendable amount, due to change in time to expiry
      let min_USDC_borrow_amount = (new BN(borrowing_terms["0"])).mul(
        new BN("99900")).div(new BN("100000"));

      await collateral_ccy_token.methods.approve(contract_addr,
        weth_pledged_amount).send({from: borrower});
      await zeroLiquidationLoanPool.borrow(min_USDC_borrow_amount,
        weth_pledged_amount, {"from": borrower});

      let borrower_usdc_balance_post = new BN(await borrow_ccy_token.methods.
        balanceOf(borrower).call());
      let borrower_weth_balance_post = new BN(await collateral_ccy_token.
        methods.balanceOf(borrower).call());

      let amm_usdc_balance_post = new BN(await borrow_ccy_token.methods.
        balanceOf(contract_addr).call());
      let amm_weth_balance_post = new BN(await collateral_ccy_token.
        methods.balanceOf(contract_addr).call());

      let borrower_usdc_balance_diff = borrower_usdc_balance_post.sub(
        borrower_usdc_balance_pre);
      let borrower_weth_balance_diff = borrower_weth_balance_pre.sub(
        borrower_weth_balance_post);

      let amm_usdc_balance_diff = amm_usdc_balance_pre.sub(
        amm_usdc_balance_post);
      let amm_weth_balance_diff = amm_weth_balance_post.sub(
        amm_weth_balance_pre);

      let loan = await zeroLiquidationLoanPool.borrows(borrower, 0);

      expect(loan.pledged_amount.toString()).to.equal(
        weth_pledged_amount.toString());
      expect(loan.pledged_amount.toString()).to.equal(
        borrower_weth_balance_diff.toString());
      expect(loan.pledged_amount.toString()).to.equal(
        amm_weth_balance_diff.toString());
      expect(loan.received_amount.toString()).to.equal(
        borrower_usdc_balance_diff.toString());
      expect(loan.received_amount.toString()).to.equal(
        amm_usdc_balance_diff.toString());
    });

    it("can let users lend during AMM period", async () => {
      let lender_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
        balanceOf(lender).call());
      let lender_weth_balance_pre = new BN(await collateral_ccy_token.methods.
        balanceOf(lender).call());

      let amm_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
        balanceOf(contract_addr).call());
      let amm_weth_balance_pre = new BN(await collateral_ccy_token.methods.
        balanceOf(contract_addr).call());

      let usdc_notional_amount = "100000000000";
      let lending_terms = await zeroLiquidationLoanPool.get_lending_terms(
        usdc_notional_amount);

      // allow 10bps diff in lendable amount, due to change in time to expiry
      let max_usdc_lend_amount = (new BN(lending_terms["0"])).mul(
        new BN("100100")).div(new BN("100000"));

      await borrow_ccy_token.methods.approve(contract_addr,
        usdc_notional_amount).send({from: lender});
      await zeroLiquidationLoanPool.lend(max_usdc_lend_amount,
        usdc_notional_amount, {"from": lender});

      let lender_usdc_balance_post = new BN(await borrow_ccy_token.methods.
        balanceOf(lender).call());
      let lender_weth_balance_post = new BN(await collateral_ccy_token.methods.
        balanceOf(lender).call());

      let amm_usdc_balance_post = new BN(await borrow_ccy_token.methods.
        balanceOf(contract_addr).call());
      let amm_weth_balance_post = new BN(await collateral_ccy_token.
        methods.balanceOf(contract_addr).call());

      let lender_weth_balance_diff = lender_weth_balance_pre.sub(
        lender_weth_balance_post);
      let lender_usdc_balance_diff = lender_usdc_balance_pre.sub(
        lender_usdc_balance_post);

      let amm_weth_balance_diff = amm_weth_balance_pre.sub(
        amm_weth_balance_post);
      let amm_usdc_balance_diff = amm_usdc_balance_post.sub(
        amm_usdc_balance_pre);

      let loan = await zeroLiquidationLoanPool.lends(lender, 0);

      expect(lender_weth_balance_diff.toString()).to.equal("0");
      expect(amm_weth_balance_diff.toString()).to.equal("0");
      expect(loan.received_amount.toString()).to.equal(
        lender_usdc_balance_diff.toString());
      expect(loan.received_amount.toString()).to.equal(
        amm_usdc_balance_diff.toString());
    });

    it("must calculate time to expiry correctly (2/2)", async () => {
      let amm_end = await zeroLiquidationLoanPool.amm_end();
      await time.advanceBlockTo(amm_end);
      let res = await zeroLiquidationLoanPool.get_time_to_expiry();
      expect(res['0'].toString()).to.equal("0");
    });
  });

  describe('Settlement period unit tests', function () {

    it("must revert when trying to redeem shares during settlement period",
    async () => {
      await expectRevert(
        zeroLiquidationLoanPool.redeem_shares(),
        "Post-settlement period not active");
    });

    it("must revert when trying to repay loan as non-borrower", async () => {
      await expectRevert(
        zeroLiquidationLoanPool.repay_loan_and_reclaim_collateral(0,
        {"from": lender}), "Sender doesn`t have outstanding loans");
    });

    it("must revert when trying to repay loan with out-of-range idx",
    async () => {
      await expectRevert(
        zeroLiquidationLoanPool.repay_loan_and_reclaim_collateral(1,
        {"from": borrower}), "loan_idx out of range");
    });

    it("must let borrowers repay their loan during settlement period",
    async () => {
      let borrower_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
        balanceOf(borrower).call());
      let borrower_weth_balance_pre = new BN(await collateral_ccy_token.methods.
        balanceOf(borrower).call());

      let amm_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
        balanceOf(contract_addr).call());
      let amm_weth_balance_pre = new BN(await collateral_ccy_token.methods.
        balanceOf(contract_addr).call());

      let loan_pre = await zeroLiquidationLoanPool.borrows(borrower, 0);

      await borrow_ccy_token.methods.approve(contract_addr,
        loan_pre.repayment_amount.toString()).send({from: borrower});
      await zeroLiquidationLoanPool.repay_loan_and_reclaim_collateral(0,
        {"from": borrower});

      let borrower_usdc_balance_post = new BN(await borrow_ccy_token.methods.
        balanceOf(borrower).call());
      let borrower_weth_balance_post = new BN(await collateral_ccy_token.
        methods.balanceOf(borrower).call());

      let amm_usdc_balance_post = new BN(await borrow_ccy_token.methods.
        balanceOf(contract_addr).call());
      let amm_weth_balance_post = new BN(await collateral_ccy_token.
        methods.balanceOf(contract_addr).call());

      let borrower_usdc_balance_diff = borrower_usdc_balance_pre.sub(
        borrower_usdc_balance_post);
      let borrower_weth_balance_diff = borrower_weth_balance_post.sub(
        borrower_weth_balance_pre);

      let amm_usdc_balance_diff = amm_usdc_balance_post.sub(
        amm_usdc_balance_pre);
      let amm_weth_balance_diff = amm_weth_balance_pre.sub(
        amm_weth_balance_post);

      let loan_post = await zeroLiquidationLoanPool.borrows(borrower, 0);

      expect(loan_pre.state.toString()).to.be.equal("0"); // 0 = Open
      expect(loan_post.state.toString()).to.be.equal("1"); // 1 = REPAID
      expect(loan_post.repayment_amount.toString()).to.be.equal(
        borrower_usdc_balance_diff.toString());
      expect(loan_post.repayment_amount.toString()).to.be.equal(
        amm_usdc_balance_diff.toString());
      expect(loan_post.pledged_amount.toString()).to.be.equal(
        borrower_weth_balance_diff.toString());
      expect(loan_post.pledged_amount.toString()).to.be.equal(
        amm_weth_balance_diff.toString());
    });

    it("must revert when trying to repay loan twice", async () => {
      await expectRevert(
        zeroLiquidationLoanPool.repay_loan_and_reclaim_collateral(0,
        {"from": borrower}), "Must be an open loan");
    });

    it("must revert if non-owner is trying to repay loan for AMM", async () => {
      await expectRevert(
        zeroLiquidationLoanPool.amm_repay_loan_and_reclaim_collateral(lender, 0,
        {"from": borrower}), "Ownable: caller is not the owner.");
    });

    it("must revert when trying to repay loan with out-of-range idx",
    async () => {
      await expectRevert(zeroLiquidationLoanPool.
        amm_repay_loan_and_reclaim_collateral(lender, 1, {"from": deployer}),
        "loan_idx out of range");
    });

    it("must let AMM repay its loan during settlement period", async () => {
      let lender_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
        balanceOf(lender).call());
      let lender_weth_balance_pre = new BN(await collateral_ccy_token.methods.
        balanceOf(lender).call());

      let amm_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
        balanceOf(contract_addr).call());
      let amm_weth_balance_pre = new BN(await collateral_ccy_token.methods.
        balanceOf(contract_addr).call());

      let loan_pre = await zeroLiquidationLoanPool.lends(lender, 0);

      await zeroLiquidationLoanPool.amm_repay_loan_and_reclaim_collateral(
        lender, 0, {"from": deployer});

      let lender_usdc_balance_post = new BN(await borrow_ccy_token.methods.
        balanceOf(lender).call());
      let lender_weth_balance_post = new BN(await collateral_ccy_token.methods.
        balanceOf(lender).call());

      let amm_usdc_balance_post = new BN(await borrow_ccy_token.methods.
        balanceOf(contract_addr).call());
      let amm_weth_balance_post = new BN(await collateral_ccy_token.methods.
        balanceOf(contract_addr).call());

      let lender_usdc_balance_diff = lender_usdc_balance_post.sub(
        lender_usdc_balance_pre);
      let lender_weth_balance_diff = lender_weth_balance_pre.sub(
        lender_weth_balance_post);

      let amm_usdc_balance_diff = amm_usdc_balance_pre.sub(
        amm_usdc_balance_post);
      let amm_weth_balance_diff = amm_weth_balance_post.sub(
        amm_weth_balance_pre);

      let loan_post = await zeroLiquidationLoanPool.lends(lender, 0);

      expect(loan_pre.state.toString()).to.be.equal("0"); // 0 = Open
      expect(loan_post.state.toString()).to.be.equal("1"); // 1 = REPAID
      expect(loan_post.repayment_amount.toString()).to.be.equal(
        lender_usdc_balance_diff.toString());
      expect(loan_post.repayment_amount.toString()).to.be.equal(
        amm_usdc_balance_diff.toString());
      expect(lender_weth_balance_diff.toString()).to.be.equal("0");
      expect(amm_weth_balance_diff.toString()).to.be.equal("0");
    });

    it("must revert when AMM tries to repay loan twice", async () => {
      await expectRevert(zeroLiquidationLoanPool.
        amm_repay_loan_and_reclaim_collateral(lender, 0, {"from": deployer}),
        "Must be an open loan");
    });
  });

  describe('Post-settlement period unit tests', function () {
      before(async () => {
        let settlement_end = await zeroLiquidationLoanPool.settlement_end.
          call();
        await time.advanceBlockTo(settlement_end);

        let collateral_ccy_supply = await zeroLiquidationLoanPool.
          collateral_ccy_supply();
        let borrow_ccy_supply = await zeroLiquidationLoanPool.
          borrow_ccy_supply();

        let amm_usdc_balance = new BN(await borrow_ccy_token.methods.
          balanceOf(contract_addr).call());
        let amm_weth_balance = new BN(await collateral_ccy_token.methods.
          balanceOf(contract_addr).call());

        expect(borrow_ccy_supply.toString()).to.be.equal(
          amm_usdc_balance.toString());
        expect(collateral_ccy_supply.toString()).to.be.equal(
          amm_weth_balance.toString());
      });

      it("must let liquidity providers redeem their shares in post-settlement period (1/3)",
      async () => {
        let lp_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
          balanceOf(liquidity_provider_1).call());
        let lp_weth_balance_pre = new BN(await collateral_ccy_token.methods.
          balanceOf(liquidity_provider_1).call());
        let lp_shares_pre = new BN(await zeroLiquidationLoanPool.pool_shares(
          liquidity_provider_1));

        let amm_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
          balanceOf(contract_addr).call());
        let amm_weth_balance_pre = new BN(await collateral_ccy_token.methods.
          balanceOf(contract_addr).call());
        let amm_usdc_balance_supply_pre = new BN(await zeroLiquidationLoanPool.
          borrow_ccy_supply());
        let amm_weth_balance_supply_pre = new BN(await zeroLiquidationLoanPool.
          collateral_ccy_supply());

        let receipt = await zeroLiquidationLoanPool.redeem_shares(
          {"from": liquidity_provider_1});

        let lp_usdc_balance_post = new BN(await borrow_ccy_token.methods.
          balanceOf(liquidity_provider_1).call());
        let lp_weth_balance_post = new BN(await collateral_ccy_token.methods.
          balanceOf(liquidity_provider_1).call());
        let lp_shares_post = new BN(await zeroLiquidationLoanPool.pool_shares(
          liquidity_provider_1));

        let amm_usdc_balance_post = new BN(await borrow_ccy_token.methods.
          balanceOf(contract_addr).call());
        let amm_weth_balance_post = new BN(await collateral_ccy_token.methods.
          balanceOf(contract_addr).call());

        /*
        expect(amm_usdc_balance_pre.toString()).to.equal("297897190000");
        expect(amm_weth_balance_pre.toString()).to.equal("149000000123523231231");
        expect(lp_usdc_balance_pre.toString()).to.equal("0");
        expect(lp_weth_balance_pre.toString()).to.equal("0");
        expect(lp_shares_pre.toString()).to.equal("160000000000");
        expect(amm_usdc_balance_post.toString()).to.equal("147950250502");
        expect(amm_weth_balance_post.toString()).to.equal("69000000123510758087");
        expect(lp_usdc_balance_post.toString()).to.equal("159944799867");
        expect(lp_weth_balance_post.toString()).to.equal("80000000000012473144");
        */
        expect(lp_shares_post.toString()).to.equal("0");
      });

      it("must let liquidity providers redeem their shares in post-settlement period (2/3)",
      async () => {
        let lp_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
          balanceOf(liquidity_provider_2).call());
        let lp_weth_balance_pre = new BN(await collateral_ccy_token.methods.
          balanceOf(liquidity_provider_2).call());
        let lp_shares_pre = new BN(await zeroLiquidationLoanPool.pool_shares(
          liquidity_provider_2));

        let amm_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
          balanceOf(contract_addr).call());
        let amm_weth_balance_pre = new BN(await collateral_ccy_token.methods.
          balanceOf(contract_addr).call());

        let receipt = await zeroLiquidationLoanPool.redeem_shares(
          {"from": liquidity_provider_2});

        let lp_usdc_balance_post = new BN(await borrow_ccy_token.methods.
          balanceOf(liquidity_provider_2).call());
        let lp_weth_balance_post = new BN(await collateral_ccy_token.methods.
          balanceOf(liquidity_provider_2).call());
        let lp_shares_post = new BN(await zeroLiquidationLoanPool.pool_shares(
          liquidity_provider_2));

        let amm_usdc_balance_post = new BN(await borrow_ccy_token.methods.
          balanceOf(contract_addr).call());
        let amm_weth_balance_post = new BN(await collateral_ccy_token.methods.
          balanceOf(contract_addr).call());

        /*
        expect(amm_usdc_balance_pre.toString()).to.equal("137952390133");
        expect(amm_weth_balance_pre.toString()).to.equal("69000000123510758087");
        expect(lp_usdc_balance_pre.toString()).to.equal("78000000000");
        expect(lp_weth_balance_pre.toString()).to.equal("0");
        expect(lp_shares_pre.toString()).to.equal("82000000000");
        expect(amm_usdc_balance_post.toString()).to.equal("65977814551");
        expect(amm_weth_balance_post.toString()).to.equal("28000000123504365601");
        expect(lp_usdc_balance_post.toString()).to.equal("159971709932");
        expect(lp_weth_balance_post.toString()).to.equal("41000000000006392486");
        */
        expect(lp_shares_post.toString()).to.equal("0");
      });

      it("must let liquidity providers redeem their shares in post-settlement period (3/3)",
      async () => {
        let lp_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
          balanceOf(liquidity_provider_3).call());
        let lp_weth_balance_pre = new BN(await collateral_ccy_token.methods.
          balanceOf(liquidity_provider_3).call());
        let lp_shares_pre = new BN(await zeroLiquidationLoanPool.pool_shares(
          liquidity_provider_3));

        let amm_usdc_balance_pre = new BN(await borrow_ccy_token.methods.
          balanceOf(contract_addr).call());
        let amm_weth_balance_pre = new BN(await collateral_ccy_token.methods.
          balanceOf(contract_addr).call());

        let receipt = await zeroLiquidationLoanPool.redeem_shares(
          {"from": liquidity_provider_3});

        let lp_usdc_balance_post = new BN(await borrow_ccy_token.methods.
          balanceOf(liquidity_provider_3).call());
        let lp_weth_balance_post = new BN(await collateral_ccy_token.methods.
          balanceOf(liquidity_provider_3).call());
        let lp_shares_post = new BN(await zeroLiquidationLoanPool.pool_shares(
          liquidity_provider_3));

        let amm_usdc_balance_post = new BN(await borrow_ccy_token.methods.
          balanceOf(contract_addr).call());
        let amm_weth_balance_post = new BN(await collateral_ccy_token.methods.
          balanceOf(contract_addr).call());

        /*
        expect(amm_usdc_balance_pre.toString()).to.equal("55980680201");
        expect(amm_weth_balance_pre.toString()).to.equal("28000000123504365601");
        expect(lp_usdc_balance_pre.toString()).to.equal("104000000000");
        expect(lp_weth_balance_pre.toString()).to.equal("0");
        expect(lp_shares_pre.toString()).to.equal("56000000000");
        expect(amm_usdc_balance_post.toString()).to.equal("248");
        expect(amm_weth_balance_post.toString()).to.equal("123500000001");
        expect(lp_usdc_balance_post.toString()).to.equal("159980679953");
        expect(lp_weth_balance_post.toString()).to.equal("28000000000004365600");
        */
        expect(lp_shares_post.toString()).to.equal("0");
      });

      it("must let lenders reclaim collateral",
      async () => {
      });
  });
});
