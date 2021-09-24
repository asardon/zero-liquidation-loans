pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ZeroLiquidationLoanPool is Ownable {

    using SafeMath for uint256;

    uint256 public lp_end;
    uint256 public amm_end;
    uint256 public settlement_end;
    ERC20 public collateral_ccy_token;
    ERC20 public borrow_ccy_token;
    uint256 public borrow_ccy_to_collateral_ccy_ratio;
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
        uint256 collateral_amount;
        uint256 upfront_received_amount;
        uint256 repayment_amount;
        bool is_repaid;
    }
    mapping(address => Loan[]) public borrows;
    mapping(address => Loan[]) public lends;

    event LiquidityProvided(
        address liquidity_provider,
        uint256 block_number,
        uint256 collateral_ccy_amount,
        uint256 borrow_ccy_amount,
        uint256 shares,
        uint256 total_shares
    );
    event NewLoan(
        bool user_is_borrower,
        address user,
        uint256 block_number,
        uint256 collateral_amount,
        uint256 upfront_received_amount,
        uint256 repayment_amount,
        uint256 collateral_price,
        uint256 collateral_price_vol,
        uint256 time_to_expiry
    );
    event UpdateObliviousPutPriceParams(
        uint256 block_number,
        uint256 collateral_price,
        uint256 collateral_price_vol,
        uint256 blocks_per_year
    );
    event LoanRepaid(
        address borrower,
        address lender,
        uint256 loan_idx,
        uint256 block_number,
        uint256 repayment_amount,
        uint256 collateral_amount
    );

    constructor(
        uint256 _lp_duration,
        uint256 _amm_duration,
        uint256 _settlement_duration,
        address _collateral_ccy,
        address _borrow_ccy,
        uint256 _borrow_ccy_to_collateral_ccy_ratio,
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
            "_init_collateral_price_annualized_vol must be > 0"
        );
        require(_blocks_per_year > 0, "_blocks_per_year must be > 0");
        require(_decimals > 0, "_decimals must be > 0");

        lp_end = block.number.add(_lp_duration);
        amm_end = lp_end.add(_amm_duration);
        settlement_end = amm_end.add(_settlement_duration);
        collateral_ccy_token = ERC20(_collateral_ccy);
        borrow_ccy_token = ERC20(_borrow_ccy);
        borrow_ccy_to_collateral_ccy_ratio = _borrow_ccy_to_collateral_ccy_ratio;
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

    modifier settlementPeriodActive {
        require(is_settlement_period_active(), "Settlement period not active");
        _;
    }

    function is_lp_period_active() public view returns (bool) {
        return block.number <= lp_end;
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

    function provide_liquidity_and_receive_shares(
        uint256 collateral_ccy_amount,
        uint256 borrow_ccy_amount
    )
        public lpPeriodActive
    {

        uint256 ratio = borrow_ccy_amount.mul(decimals).div(
            collateral_ccy_amount
        );
        require(
            ratio == borrow_ccy_to_collateral_ccy_ratio,
            "Must provide ccys in proper ratio"
        );
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

        emit LiquidityProvided(
            msg.sender,
            block.number,
            collateral_ccy_amount,
            borrow_ccy_amount,
            pool_shares[msg.sender],
            total_pool_shares
        );
    }

    function initialize_amm() public {
        require(
            block.number > lp_end,
            "Can initialize AMM only after LP period"
        );
        require(block.number <= amm_end, "Must initialize amm before amm_end");
        amm_constant = collateral_ccy_supply.mul(borrow_ccy_supply);
        amm_is_initialized = true;
    }

    function borrow(uint256 collateral_ccy_pledged) public ammPeriodActive {
        uint256 repayment_amount = get_borrowable_amount(
            collateral_ccy_pledged
        );

        (
            uint256 time_to_expiry,
            uint256 sqrt_time_to_expiry
        ) = get_time_to_expiry();
        uint256 oblivious_put_price = get_oblivious_put_price(
            sqrt_time_to_expiry
        );

        uint256 upfront_received_amount = repayment_amount.sub(
            oblivious_put_price
        );

        collateral_ccy_token.transferFrom(
            msg.sender,
            address(this),
            collateral_ccy_pledged
        );
        borrow_ccy_token.transfer(msg.sender, upfront_received_amount);

        collateral_ccy_supply.add(collateral_ccy_pledged);
        borrow_ccy_supply.sub(upfront_received_amount);
        amm_constant = collateral_ccy_supply.mul(borrow_ccy_supply);

        Loan memory loan = Loan(
            collateral_ccy_pledged,
            upfront_received_amount,
            repayment_amount,
            false
        );
        borrows[msg.sender].push(loan);
        emit NewLoan(
            true,
            msg.sender,
            block.number,
            loan.collateral_amount,
            loan.upfront_received_amount,
            loan.repayment_amount,
            collateral_price,
            collateral_price_annualized_vol,
            time_to_expiry
        );
    }

    function lend(uint256 collateral_ccy_received) public ammPeriodActive {
        uint256 upfront_received_amount = get_loanable_amount(
            collateral_ccy_received
        );

        (
            uint256 time_to_expiry,
            uint256 sqrt_time_to_expiry
        ) = get_time_to_expiry();
        uint256 oblivious_put_price = get_oblivious_put_price(
            sqrt_time_to_expiry
        );

        uint256 repayment_amount = upfront_received_amount.add(
            oblivious_put_price
        );

        borrow_ccy_token.transferFrom(
            msg.sender,
            address(this),
            upfront_received_amount
        );

        collateral_ccy_supply.sub(collateral_ccy_received);
        borrow_ccy_supply.add(upfront_received_amount);
        amm_constant = collateral_ccy_supply.mul(borrow_ccy_supply);

        Loan memory loan = Loan(
            collateral_ccy_received,
            upfront_received_amount,
            repayment_amount,
            false
        );
        lends[msg.sender].push(loan);
        emit NewLoan(
            false,
            msg.sender,
            block.number,
            loan.collateral_amount,
            loan.upfront_received_amount,
            loan.repayment_amount,
            collateral_price,
            collateral_price_annualized_vol,
            time_to_expiry
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
        uint256 _sqrt_time_to_expiry = sqrt(_time_to_expiry.mul(decimals));
        return (_time_to_expiry, _sqrt_time_to_expiry);
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
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
            !(loan.is_repaid),
            "Must be a loan that has not been repaid yet"
        );
        borrow_ccy_token.transferFrom(
            msg.sender,
            address(this),
            loan.repayment_amount
        );
        collateral_ccy_token.transfer(msg.sender, loan.collateral_amount);
        borrow_ccy_supply.add(loan.repayment_amount);
        collateral_ccy_supply.sub(loan.collateral_amount);
        loan.is_repaid = true;
        emit LoanRepaid(
            msg.sender,
            address(this),
            loan_idx,
            block.number,
            loan.repayment_amount,
            loan.collateral_amount
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
            loan_idx < borrows[lender].length,
            "loan_idx out of range"
        );
        Loan storage loan = lends[lender][loan_idx];
        require(
            !(loan.is_repaid),
            "Must be a loan that has not been repaid yet"
        );
        borrow_ccy_token.transfer(msg.sender, loan.repayment_amount);
        borrow_ccy_supply.sub(loan.repayment_amount);
        collateral_ccy_supply.add(loan.collateral_amount);
        loan.is_repaid = true;
        emit LoanRepaid(
            address(this),
            msg.sender,
            loan_idx,
            block.number,
            loan.repayment_amount,
            loan.collateral_amount
        );
    }

    function redeem_shares() public {
        require(
            block.number > settlement_end,
            "Can redeem only after settlement_end"
        );
        require(pool_shares[msg.sender] > 0, "User must hold > 0 shares");
        uint256 pro_rata_collateral_ccy_share = collateral_ccy_supply.mul(
            pool_shares[msg.sender]).mul(decimals).div(total_pool_shares).div(
            decimals);
        uint256 pro_rata_borrow_ccy_share = borrow_ccy_supply.mul(
            pool_shares[msg.sender]).mul(decimals).div(total_pool_shares).div(
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
        total_pool_shares.sub(pool_shares[msg.sender]);
        pool_shares[msg.sender] = 0;
    }

    function get_borrowable_amount(
        uint256 collateral_ccy_pledged
    )
        public view returns (uint256)
    {
        uint256 borrowable_amount = borrow_ccy_supply.sub(amm_constant.div(
            collateral_ccy_supply.add(collateral_ccy_pledged)));
        return borrowable_amount;
    }

    function get_loanable_amount(
        uint256 collateral_ccy_received
    )
        public view returns (uint256)
    {
        require(
            collateral_ccy_received < collateral_ccy_supply,
            "Collateral ccy to be paid out must be less than AMM`s inventory"
        );
        uint256 loanable_amount = amm_constant.div(collateral_ccy_supply.sub(
            collateral_ccy_received)).sub(borrow_ccy_supply);
        return loanable_amount;
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
            block.number,
            collateral_price,
            collateral_price_annualized_vol,
            blocks_per_year
        );
    }

}
