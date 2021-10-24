pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import './utils/Math.sol';

contract ZeroLiquidationLoanPool is Ownable {

    using SafeMath for uint256;

    enum LoanState { OPEN, REPAID, RECLAIMED }
    enum PoolState { UNDEFINED, LP, PENDING_INITIALIZATION, AMM, SETTLEMENT, POST_SETTLMENT }

    uint256 public lp_end;
    uint256 public amm_end;
    uint256 public settlement_end;
    ERC20 public collateral_ccy_token;
    ERC20 public borrow_ccy_token;
    uint256 public collateral_ccy_eq_factor;
    uint256 public borrow_ccy_eq_factor;
    uint256 public alpha;
    uint256 public collateral_price;
    uint256 public collateral_price_annualized_vol;
    uint256 public blocks_per_year;
    uint256 public decimals;
    uint256 public amm_constant;
    uint256 public total_pool_shares;
    uint256 public collateral_ccy_supply;
    uint256 public borrow_ccy_supply;
    bool public amm_is_initialized;
    mapping(address => uint256) public pool_shares;
    struct Loan {
        uint256 block_number;
        uint256 received_amount;
        uint256 repayment_amount;
        uint256 interest_amount;
        uint256 pledged_amount;
        LoanState state;
    }
    mapping(address => Loan[]) public borrows;
    mapping(address => Loan[]) public lends;

    event ProvideLiquidity(
        address liquidity_provider,
        uint256 collateral_ccy_amount,
        uint256 borrow_ccy_amount,
        uint256 shares,
        uint256 total_shares
    );
    event OpenLoan(
        address borrower,
        address lender,
        uint256 received_amount,
        uint256 repayment_amount,
        uint256 interest_amount,
        uint256 pledged_amount,
        uint256 collateral_price,
        uint256 collateral_price_annualized_vol
    );
    event UpdateObliviousPutPriceParams(
        uint256 collateral_price,
        uint256 collateral_price_vol,
        uint256 blocks_per_year
    );
    event InitializeAMM();
    event CloseLoan(
        address borrower,
        address lender,
        uint256 loan_idx,
        uint256 repayment_amount,
        uint256 pledged_amount,
        LoanState state
    );
    event Borrow(
        address borrower,
        uint256 borrow_ccy_out_amount,
        uint256 repayment_amount,
        uint256 interest_amount,
        uint256 pledge_amount,
        uint256 collateral_price,
        uint256 collateral_price_annualized_vol
    );
    event Lend(
        address lender,
        uint256 borow_ccy_in_amount,
        uint256 repayment_amount,
        uint256 interest_amount,
        uint256 pledge_amount,
        uint256 collateral_price,
        uint256 collateral_price_annualized_vol
    );
    event RepayBorrow(
        address borrower,
        uint256 loan_idx,
        uint256 loan_repayment_amount,
        uint256 loan_pledged_amount
    );
    event RepayLend(
        address lender,
        uint256 loan_idx,
        uint256 loan_repayment_amount,
        uint256 loan_pledged_amount
    );
    event ReclaimCollateral(
        address borrower,
        uint256 loan_idx,
        uint256 loan_repayment_amount,
        uint256 loan_pledged_amount
    );
    event RedeemShares(
        address holder,
        uint256 pool_shares,
        uint256 pro_rata_collateral_ccy_share,
        uint256 pro_rata_borrow_ccy_share
    );

    constructor(
        uint256 _lp_duration,
        uint256 _amm_duration,
        uint256 _settlement_duration,
        address _collateral_ccy,
        address _borrow_ccy,
        uint256 _collateral_ccy_eq_factor,
        uint256 _borrow_ccy_eq_factor,
        uint256 _alpha,
        uint256 _init_collateral_price,
        uint256 _init_collateral_price_annualized_vol,
        uint256 _blocks_per_year,
        uint256 _decimals
    )
        public
    {
        require(_lp_duration > 0, "_lp_duration must be > 0");
        require(_amm_duration > 0, "_amm_duration must be > 0");
        require(_settlement_duration > 0, "_settlement_duration must be > 0");
        require(_alpha > 0, "_alpha must be > 0");
        require(
            _init_collateral_price > 0,
            "_init_collateral_price must be > 0"
        );
        require(
            _init_collateral_price_annualized_vol > 0,
            "_init_collateral_price_annualiratiozed_vol must be > 0"
        );
        require(_blocks_per_year > 0, "_blocks_per_year must be > 0");
        require(_decimals > 0, "_decimals must be > 0");

        lp_end = block.number.add(_lp_duration);
        amm_end = lp_end.add(_amm_duration);
        settlement_end = amm_end.add(_settlement_duration);
        collateral_ccy_token = ERC20(_collateral_ccy);
        borrow_ccy_token = ERC20(_borrow_ccy);
        collateral_ccy_eq_factor = _collateral_ccy_eq_factor;
        borrow_ccy_eq_factor = _borrow_ccy_eq_factor;
        alpha = _alpha;
        collateral_price = _init_collateral_price;
        collateral_price_annualized_vol = _init_collateral_price_annualized_vol;
        blocks_per_year = _blocks_per_year;
        decimals = _decimals;
    }

    modifier lpPeriodActive {
        require(is_lp_period_active(), "LP period not active");
        _;
    }

    modifier ammPeriodActive {
        require(is_amm_period_active(), "AMM period not active");
        _;
    }

    modifier pendingInitialization {
        require(is_pending_initialization(), "AMM initialization pending");
        _;
    }

    modifier settlementPeriodActive {
        require(is_settlement_period_active(), "Settlement period not active");
        _;
    }

    modifier postSettlementPeriodActive {
        require(
            is_post_settlement_period_active(),
            "Post-settlement period not active"
        );
        _;
    }

    function get_state() public view returns (PoolState) {
        PoolState state = PoolState.UNDEFINED;
        if(is_lp_period_active()) {
            state = PoolState.LP;
        } else if(is_pending_initialization()) {
            state = PoolState.PENDING_INITIALIZATION;
        } else if(is_amm_period_active()) {
            state = PoolState.AMM;
        } else if(is_settlement_period_active()) {
            state = PoolState.SETTLEMENT;
        } else if(is_post_settlement_period_active()) {
            state = PoolState.POST_SETTLMENT;
        }
        return state;
    }

    function is_lp_period_active() public view returns (bool) {
        return block.number <= lp_end;
    }

    function is_pending_initialization() public view returns (bool) {
        return (
            !amm_is_initialized &&
            block.number > lp_end &&
            block.number <= amm_end);
    }

    function is_amm_period_active() public view returns (bool) {
        return (
            amm_is_initialized &&
            block.number > lp_end &&
            block.number <= amm_end);
    }

    function is_settlement_period_active() public view returns (bool) {
        return block.number > amm_end && block.number <= settlement_end;
    }

    function is_post_settlement_period_active() public view returns (bool) {
        return block.number > settlement_end;
    }


    function get_lp_borrow_ccy_amount(uint256 collateral_ccy_amount)
        public view returns (uint256)
    {
        return collateral_ccy_amount.mul(collateral_ccy_eq_factor).div(
            borrow_ccy_eq_factor);
    }

    function get_lp_collateral_ccy_amount(uint256 borrow_ccy_amount)
        public view returns (uint256)
    {
        return borrow_ccy_amount.mul(borrow_ccy_eq_factor).div(
            collateral_ccy_eq_factor);
    }

    function provide_liquidity_and_receive_shares(
        uint256 collateral_ccy_amount,
        uint256 borrow_ccy_amount
    )
        public lpPeriodActive
    {

        uint256 borrow_ccy_amount_exp = get_lp_borrow_ccy_amount(
            collateral_ccy_amount);
        require(
            borrow_ccy_amount_exp == borrow_ccy_amount,
            "Unexpected borrow ccy amount"
        );
        require(collateral_ccy_amount > 0, "collateral ccy must be > 0");
        require(borrow_ccy_amount > 0, "collateral ccy must be > 0");
        collateral_ccy_token.transferFrom(
            msg.sender,
            address(this),
            collateral_ccy_amount
        );
        borrow_ccy_token.transferFrom(
            msg.sender,
            address(this),
            borrow_ccy_amount
        );

        collateral_ccy_supply = collateral_ccy_supply.add(
            collateral_ccy_amount
        );
        borrow_ccy_supply = borrow_ccy_supply.add(borrow_ccy_amount);

        total_pool_shares = total_pool_shares.add(borrow_ccy_amount);
        pool_shares[msg.sender] = pool_shares[msg.sender].add(
            borrow_ccy_amount
        );

        emit ProvideLiquidity(
            msg.sender,
            collateral_ccy_amount,
            borrow_ccy_amount,
            pool_shares[msg.sender],
            total_pool_shares
        );
    }

    function initialize_amm() public pendingInitialization {
        amm_constant = collateral_ccy_supply.mul(borrow_ccy_supply);
        amm_is_initialized = true;
        emit InitializeAMM();
    }

    function get_borrowing_terms(uint256 amount_to_be_pledged)
        public view ammPeriodActive
        returns (uint256, uint256, uint256){
        uint256 repayment_amount = get_borrowable_amount(amount_to_be_pledged);
        uint256 interest_amount = get_interest_cost(amount_to_be_pledged);
        uint256 borrow_ccy_out_amount = 0;
        if (repayment_amount > interest_amount) {
            borrow_ccy_out_amount = repayment_amount.sub(interest_amount);
        }
        return (borrow_ccy_out_amount, interest_amount, repayment_amount);
    }

    function get_lending_terms(uint256 amount_to_be_repaid)
        public view ammPeriodActive
        returns (uint256, uint256, uint256){
        uint256 pledgeable_amount = get_pledgeable_amount(amount_to_be_repaid);
        uint256 interest_amount = get_interest_cost(pledgeable_amount);
        if (amount_to_be_repaid < interest_amount) {
            interest_amount = 0;
        }
        uint256 borrow_ccy_in_amount = amount_to_be_repaid.sub(
            interest_amount);
        return (borrow_ccy_in_amount, pledgeable_amount, interest_amount);
    }

    function borrow(uint256 min_borrow_ccy_out_amount, uint256 pledge_amount)
    public ammPeriodActive
    {
        (
            uint256 borrow_ccy_out_amount,
            uint256 interest_amount,
            uint256 repayment_amount
        ) = get_borrowing_terms(pledge_amount);
        require(
            borrow_ccy_out_amount >= min_borrow_ccy_out_amount,
            "borrow_ccy_out_amount must be at least min_borrow_ccy_out_amount"
        );
        collateral_ccy_token.transferFrom(
            msg.sender,
            address(this),
            pledge_amount
        );
        collateral_ccy_supply = collateral_ccy_supply.add(pledge_amount);

        borrow_ccy_token.transfer(msg.sender, borrow_ccy_out_amount);
        borrow_ccy_supply = borrow_ccy_supply.sub(borrow_ccy_out_amount);

        amm_constant = collateral_ccy_supply.mul(borrow_ccy_supply);

        Loan memory loan = Loan(
            block.number,
            borrow_ccy_out_amount,
            repayment_amount,
            interest_amount,
            pledge_amount,
            LoanState.OPEN
        );
        borrows[msg.sender].push(loan);

        emit Borrow(
            msg.sender,
            borrow_ccy_out_amount,
            repayment_amount,
            interest_amount,
            pledge_amount,
            collateral_price,
            collateral_price_annualized_vol
        );
    }

    function lend(uint256 max_borow_ccy_in_amount, uint256 repayment_amount)
    public ammPeriodActive
    {
        (
            uint256 borow_ccy_in_amount,
            uint256 pledge_amount,
            uint256 interest_amount
        ) = get_lending_terms(repayment_amount);
        require(
            borow_ccy_in_amount <= max_borow_ccy_in_amount,
            "borow_ccy_in_amount must not exceed max_borow_ccy_in_amount"
        );
        borrow_ccy_token.transferFrom(
            msg.sender,
            address(this),
            borow_ccy_in_amount
        );
        borrow_ccy_supply = borrow_ccy_supply.add(borow_ccy_in_amount);

        collateral_ccy_supply = collateral_ccy_supply.sub(pledge_amount);

        amm_constant = collateral_ccy_supply.mul(borrow_ccy_supply);

        Loan memory loan = Loan(
            block.number,
            borow_ccy_in_amount,
            repayment_amount,
            interest_amount,
            pledge_amount,
            LoanState.OPEN
        );
        lends[msg.sender].push(loan);

        emit Lend(
            msg.sender,
            borow_ccy_in_amount,
            repayment_amount,
            interest_amount,
            pledge_amount,
            collateral_price,
            collateral_price_annualized_vol
        );
    }

    function get_time_to_expiry() ammPeriodActive public view returns
        (
            uint256 time_to_expiry,
            uint256 sqrt_time_to_expiry
        )
    {
        uint256 _time_to_expiry = amm_end.sub(block.number).mul(decimals).div(
            blocks_per_year);
        uint256 _sqrt_time_to_expiry = Math.sqrt(_time_to_expiry.mul(decimals)
        );
        return (_time_to_expiry, _sqrt_time_to_expiry);
    }

    function repay_loan_and_reclaim_collateral(uint loan_idx)
        public settlementPeriodActive
    {
        require(
            borrows[msg.sender].length > 0,
            "Sender doesn`t have outstanding loans"
        );
        require(
            loan_idx < borrows[msg.sender].length,
            "loan_idx out of range"
        );
        Loan storage loan = borrows[msg.sender][loan_idx];
        require(
            loan.state == LoanState.OPEN,
            "Must be an open loan"
        );

        borrow_ccy_token.transferFrom(
            msg.sender,
            address(this),
            loan.repayment_amount
        );
        borrow_ccy_supply = borrow_ccy_supply.add(loan.repayment_amount);

        collateral_ccy_token.transfer(msg.sender, loan.pledged_amount);
        collateral_ccy_supply = collateral_ccy_supply.sub(loan.pledged_amount);

        loan.state = LoanState.REPAID;

        emit RepayBorrow(
            msg.sender,
            loan_idx,
            loan.repayment_amount,
            loan.pledged_amount
        );
    }

    function amm_repay_loan_and_reclaim_collateral(
        address lender,
        uint loan_idx
    )
        public settlementPeriodActive onlyOwner
    {
        require(
            lends[lender].length > 0,
            "Provided address didn`t lend to AMM"
        );
        require(
            loan_idx < lends[lender].length,
            "loan_idx out of range"
        );
        Loan storage loan = lends[lender][loan_idx];
        require(
            loan.state == LoanState.OPEN,
            "Must be an open loan"
        );

        borrow_ccy_token.transfer(lender, loan.repayment_amount);
        borrow_ccy_supply = borrow_ccy_supply.sub(loan.repayment_amount);

        collateral_ccy_supply = collateral_ccy_supply.add(loan.pledged_amount);

        loan.state = LoanState.REPAID;

        emit RepayLend(
            msg.sender,
            loan_idx,
            loan.repayment_amount,
            loan.pledged_amount
        );
    }

    function reclaim_collateral(uint loan_idx)
    public postSettlementPeriodActive {
        require(
            loan_idx < lends[msg.sender].length,
            "loan_idx out of range"
        );
        Loan storage loan = lends[msg.sender][loan_idx];
        require(
            loan.state == LoanState.OPEN,
            "Must be an open loan"
        );

        collateral_ccy_token.transfer(msg.sender, loan.pledged_amount);
        loan.state = LoanState.RECLAIMED;

        emit ReclaimCollateral(
            msg.sender,
            loan_idx,
            loan.repayment_amount,
            loan.pledged_amount
        );
    }

    function redeem_shares() public postSettlementPeriodActive {
        require(pool_shares[msg.sender] > 0, "User must hold > 0 shares");
        uint256 _pool_shares = pool_shares[msg.sender];
        uint256 pro_rata_collateral_ccy_share = collateral_ccy_supply.mul(
            _pool_shares).mul(decimals).div(total_pool_shares).div(
            decimals);
        uint256 pro_rata_borrow_ccy_share = borrow_ccy_supply.mul(
            _pool_shares).mul(decimals).div(total_pool_shares).div(
            decimals);
        collateral_ccy_token.transfer(
            msg.sender,
            pro_rata_collateral_ccy_share
        );
        collateral_ccy_supply.sub(pro_rata_collateral_ccy_share);
        borrow_ccy_token.transfer(
            msg.sender,
            pro_rata_borrow_ccy_share
        );
        borrow_ccy_supply.sub(pro_rata_borrow_ccy_share);
        total_pool_shares.sub(_pool_shares);
        pool_shares[msg.sender] = 0;

        emit RedeemShares(
            msg.sender,
            _pool_shares,
            pro_rata_collateral_ccy_share,
            pro_rata_borrow_ccy_share
        );
    }

    function get_borrowable_amount(
        uint256 amount_to_be_pledged
    )
        public view returns (uint256)
    {
        uint256 borrowable_amount = borrow_ccy_supply.sub(amm_constant.div(
            collateral_ccy_supply.add(amount_to_be_pledged)));
        return borrowable_amount;
    }

    function get_pledgeable_amount(
        uint256 amount_to_be_loaned
    )
        public view returns (uint256)
    {
        uint256 pledgeable_amount = collateral_ccy_supply.sub(
            amm_constant.div(borrow_ccy_supply.add(amount_to_be_loaned)));
        return pledgeable_amount;
    }

    function get_interest_cost(uint256 pledged_amount)
    public view returns (uint256)
    {
        (,uint256 sqrt_time_to_expiry) = get_time_to_expiry();
        uint256 oblivious_put_price = get_oblivious_put_price(
            sqrt_time_to_expiry
        );
        uint256 collateral_ccy_decimals = collateral_ccy_token.decimals();
        uint256 interest_cost = oblivious_put_price.mul(pledged_amount).div(
            10**collateral_ccy_decimals);
        return interest_cost;
    }

    function get_oblivious_put_price(uint256 sqrt_time_to_expiry)
        public view returns (uint256)
    {
        return alpha.mul(collateral_price).mul(
            collateral_price_annualized_vol).mul(sqrt_time_to_expiry).div(
            decimals).div(decimals).div(decimals);
    }

    function update_oblivious_put_price_params(
        uint256 _collateral_price,
        uint256 _collateral_price_annualized_vol,
        uint256 _blocks_per_year
    )
        public onlyOwner
    {
        require(_collateral_price > 0, "New collateral price must be > 0");
        require(_collateral_price_annualized_vol > 0,
                "New collateral price vol must be > 0"
        );
        require(_blocks_per_year > 0,
                "New blocks per year must be > 0"
        );
        collateral_price = _collateral_price;
        collateral_price_annualized_vol = _collateral_price_annualized_vol;
        blocks_per_year = _blocks_per_year;
        emit UpdateObliviousPutPriceParams(
            collateral_price,
            collateral_price_annualized_vol,
            blocks_per_year
        );
    }

}
