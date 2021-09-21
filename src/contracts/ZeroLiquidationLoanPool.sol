pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

contract ZeroLiquidationLoanPool {

    using SafeMath for uint256;

    AggregatorV3Interface internal priceFeed;
    uint256 public lp_end;
    uint256 public amm_end;
    uint256 public settlement_end;
    IERC20 public collateral_ccy_token;
    IERC20 public borrow_ccy_token;
    uint256 public borrow_ccy_to_collateral_ccy_ratio;
    uint256 public alpha;
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
    }
    mapping(address => Loan[]) borrows;
    mapping(address => Loan[]) lends;

    event NewLoan(
        bool user_is_borrower,
        address user,
        uint256 block_number,
        uint256 collateral_amount,
        uint256 upfront_received_amount,
        uint256 repayment_amount,
        uint256 spot,
        uint256 sigma,
        uint256 time_to_expiry
    );

    constructor(
        uint256 _lp_end,
        uint256 _amm_end,
        uint256 _settlement_end,
        address _collateral_ccy,
        address _borrow_ccy,
        uint256 _borrow_ccy_to_collateral_ccy_ratio,
        uint256 _alpha,
        address _price_feed_address
    )
        public
    {
        require(
            block.number < _lp_end,
            "Liquidity provisioning must end in the future"
        );
        require(
            _lp_end < _amm_end,
            "Liquidity provisioning end must be before AMM starts"
        );
        require(
            _amm_end < _settlement_end,
            "AMM must end before settlement starts"
        );

        lp_end = _lp_end;
        amm_end = _amm_end;
        settlement_end = _settlement_end;
        collateral_ccy_token = IERC20(_collateral_ccy);
        borrow_ccy_token = IERC20(_borrow_ccy);
        borrow_ccy_to_collateral_ccy_ratio = _borrow_ccy_to_collateral_ccy_ratio;
        alpha = _alpha;
        priceFeed = AggregatorV3Interface(_price_feed_address);
    }

    modifier _ammIsActive {
        require(amm_is_initialized);
        require(block.number > lp_end);
        require(block.number <= amm_end);
        _;
    }

    function provide_liquidity_and_receive_shares(
        uint256 collateral_ccy_amount,
        uint256 borrow_ccy_amount
    )
        public
    {
        require(
            block.number <= lp_end,
            "Must provide liquidity before lp_end"
        );
        uint256 ratio = borrow_ccy_amount.div(collateral_ccy_amount);
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
        borrow_ccy_supply= borrow_ccy_supply.add(borrow_ccy_amount);

        total_pool_shares = total_pool_shares.add(borrow_ccy_amount);
        pool_shares[msg.sender] = pool_shares[msg.sender].add(
            borrow_ccy_amount
        );
    }

    function initialize_amm() public {
        require(
            block.number > lp_end,
            "Market can only start after liquidity provisioning"
        );
        require(block.number <= amm_end, "Market must start before end");
        amm_constant = collateral_ccy_supply.mul(borrow_ccy_supply);
        amm_is_initialized = true;
    }

    function borrow(uint256 collateral_ccy_pledged) public _ammIsActive {
        uint256 repayment_amount = get_borrowable_amount(
            collateral_ccy_pledged
        );

        (
            uint256 spot,
            uint256 sigma,
            uint256 time_to_expiry,
            uint256 oblivious_put_price
        ) = get_lending_and_borrowing_values();

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
            repayment_amount
        );
        borrows[msg.sender].push(loan);
        emit NewLoan(
            true,
            msg.sender,
            block.number,
            loan.collateral_amount,
            loan.upfront_received_amount,
            loan.repayment_amount,
            spot,
            sigma,
            time_to_expiry
        );
    }

    function lend(uint256 collateral_ccy_received) public _ammIsActive {
        uint256 upfront_received_amount = get_loanable_amount(
            collateral_ccy_received
        );

        (
            uint256 spot,
            uint256 sigma,
            uint256 time_to_expiry,
            uint256 oblivious_put_price
        ) = get_lending_and_borrowing_values();

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
            repayment_amount
        );
        lends[msg.sender].push(loan);
        emit NewLoan(
            false,
            msg.sender,
            block.number,
            loan.collateral_amount,
            loan.upfront_received_amount,
            loan.repayment_amount,
            spot,
            sigma,
            time_to_expiry
        );
    }

    function get_lending_and_borrowing_values()
        public view
        returns (
            uint256 spot,
            uint256 sigma,
            uint256 time_to_expiry,
            uint256 oblivious_put_price
        )
    {
        uint256 _spot = getLatestPrice();
        uint256 _sigma = 1;
        uint256 _time_to_expiry = amm_end.sub(block.number);
        uint256 _oblivious_put_price = get_oblivious_put_price(
            _spot,
            _sigma,
            _time_to_expiry,
            alpha
        );
        return (_spot, _sigma, _time_to_expiry, _oblivious_put_price);
    }

    function repay_loan_and_reclaim_collateral(uint loan_idx) public {
        return;
    }

    function get_borrowable_amount(
        uint256 collateral_ccy_pledged
    )
        public view returns (uint256)
    {
        uint256 borrowable_amount = borrow_ccy_supply.sub(
            amm_constant.div(collateral_ccy_supply.add(collateral_ccy_pledged))
        );
        return borrowable_amount;
    }

    function get_loanable_amount(
        uint256 collateral_ccy_received
    )
        public view returns (uint256)
    {
        uint256 loanable_amount = amm_constant.div(
            collateral_ccy_supply.sub(collateral_ccy_received)
        ).sub(borrow_ccy_supply);
        return loanable_amount;
    }

    function get_oblivious_put_price(
        uint256 spot,
        uint256 sigma,
        uint256 time_to_expiry,
        uint256 _alpha
    )
        public pure returns (uint256)
    {
        int128 tmp = int128(time_to_expiry);
        uint256 tmp2 = uint256(ABDKMath64x64.sqrt(tmp));
        return tmp2;
    }

    function getLatestPrice() public view returns (uint256) {
        (
            uint80 roundID,
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        return uint256(price);
    }

}
