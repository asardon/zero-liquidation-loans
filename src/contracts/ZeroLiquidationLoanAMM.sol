pragma solidity ^0.6.12;

import './utils/Math.sol';
import './ZeroLiquidationLoans.sol';
import './ZeroLiquidationLoanLP.sol';
import './ZeroLiquidationLoanLPFactory.sol';
import "@openzeppelin/contracts/math/SafeMath.sol";

contract ZeroLiquidationLoanAMM is ZeroLiquidationLoanLPFactory {
    using SafeMath for uint256;

    uint256 constant BLOCKS_PER_YEAR = 2372500;
    ZeroLiquidationLoans public zeroLiquidationLoans;

    constructor() ZeroLiquidationLoanLPFactory() public {
        zeroLiquidationLoans = new ZeroLiquidationLoans();
    }

    function borrow(
        address poolAddr,
        uint256 minBorrowCcyOutAmount,
        uint256 pledgeAmount
    )
        public
    {
        require(
            ZeroLiquidationLoanLP(poolAddr).isAmmPeriodActive(),
            "AMM period not active"
        );
        (
            uint256 borrowCcyOutAmount,
            uint256 interestAmount,
            uint256 repaymentAmount
        ) = getBorrowingTerms(poolAddr, pledgeAmount);
        require(
            borrowCcyOutAmount >= minBorrowCcyOutAmount,
            "borrowCcyOutAmount must be at least minBorrowCcyOutAmount"
        );

        ZeroLiquidationLoanLP(poolAddr).collateralCcyToken().transferFrom(
            msg.sender,
            poolAddr,
            pledgeAmount
        );

        ZeroLiquidationLoanLP(poolAddr).addToCollateralCcySupply(pledgeAmount);
        ZeroLiquidationLoanLP(poolAddr).transferBorrowCcy(msg.sender,
            borrowCcyOutAmount);
        ZeroLiquidationLoanLP(poolAddr).subFromBorrowCcySupply(
            borrowCcyOutAmount);
        ZeroLiquidationLoanLP(poolAddr).updateAmmConstant();

        zeroLiquidationLoans.issue(
            msg.sender,
            poolAddr,
            address(ZeroLiquidationLoanLP(poolAddr).collateralCcyToken()),
            address(ZeroLiquidationLoanLP(poolAddr).borrowCcyToken()),
            repaymentAmount,
            pledgeAmount,
            ZeroLiquidationLoanLP(poolAddr).ammEnd()
        );
    }

    function getBorrowingTerms(
        address poolAddr,
        uint256 amountToBePledged
    )
        public view returns (uint256, uint256, uint256)
    {
        uint256 repaymentAmount = getBorrowableAmount(poolAddr,
            amountToBePledged);
        uint256 interestAmount = getInterestCost(poolAddr, amountToBePledged);
        uint256 borrowCcyOutAmount = 0;
        if (repaymentAmount > interestAmount) {
            borrowCcyOutAmount = repaymentAmount.sub(interestAmount);
        }
        return (borrowCcyOutAmount, interestAmount, repaymentAmount);
    }

    function getBorrowableAmount(
        address poolAddr,
        uint256 amountToBePledged
    )
        public view returns (uint256)
    {
        uint256 borrowCcySupply = ZeroLiquidationLoanLP(
            poolAddr).borrowCcySupply();
        uint256 ammConstant = ZeroLiquidationLoanLP(poolAddr).ammConstant();
        uint256 collateralCcySupply = ZeroLiquidationLoanLP(poolAddr
            ).collateralCcySupply();

        uint256 borrowableAmount = borrowCcySupply.sub(ammConstant.div(
            collateralCcySupply.add(amountToBePledged)));
        return borrowableAmount;
    }

    function getInterestCost(
        address poolAddr,
        uint256 pledgedAmount
    )
        public view returns (uint256)
    {
        (,uint256 sqrtTimeToExpiry) = getTimeToExpiry(poolAddr);
        uint256 obliviousPutPrice = getObliviousPutPrice(poolAddr,
            sqrtTimeToExpiry);
        uint256 collateralCcyDecimals = ZeroLiquidationLoanLP(poolAddr
            ).collateralCcyToken().decimals();
        uint256 interestCost = obliviousPutPrice.mul(pledgedAmount).div(
            10**collateralCcyDecimals);
        return interestCost;
    }

    function getObliviousPutPrice(
        address poolAddr,
        uint256 sqrtTimeToExpiry
    )
        public view returns (uint256)
    {
        uint256 alpha = ZeroLiquidationLoanLP(poolAddr).alpha();
        require(alpha > 0, "alpha must be set and greater zero");
        uint256 collateralPrice = ZeroLiquidationLoanLP(
            poolAddr).collateralPrice();
        require(
            collateralPrice > 0,
            "collateralPrice must be set and greater zero"
        );
        uint256 collateralPriceAnnualizedVol = ZeroLiquidationLoanLP(
            poolAddr).collateralPriceAnnualizedVol();
        require(
            collateralPriceAnnualizedVol > 0,
            "collateralPriceAnnualizedVol must be set and greater zero"
        );
        uint256 calcDecimals = ZeroLiquidationLoanLP(poolAddr).calcDecimals();
        return alpha.mul(collateralPrice).mul(
            collateralPriceAnnualizedVol).mul(sqrtTimeToExpiry).div(
            calcDecimals).div(calcDecimals).div(calcDecimals);
    }

    function getTimeToExpiry(address poolAddr) public view returns
        (
            uint256 timeToExpiry,
            uint256 sqrtTimeToExpiry
        )
    {
        require(
            ZeroLiquidationLoanLP(poolAddr).ammEnd() > block.number,
            "must be before AMM end"
        );
        uint256 timeToExpiry_ = ZeroLiquidationLoanLP(poolAddr).ammEnd().sub(
            block.number).mul(ZeroLiquidationLoanLP(poolAddr).calcDecimals()
            ).div(BLOCKS_PER_YEAR);
        uint256 sqrtTimeToExpiry_ = Math.sqrt(timeToExpiry_.mul(
            ZeroLiquidationLoanLP(poolAddr).calcDecimals()));
        return (timeToExpiry_, sqrtTimeToExpiry_);
    }

    function getPledgeableAmount(
        address poolAddr,
        uint256 amountToBeLoaned
    )
        public view returns (uint256)
    {
        uint256 collateralCcySupply = ZeroLiquidationLoanLP(poolAddr
            ).collateralCcySupply();
        uint256 ammConstant = ZeroLiquidationLoanLP(poolAddr).ammConstant();
        uint256 borrowCcySupply = ZeroLiquidationLoanLP(
            poolAddr).borrowCcySupply();

        uint256 pledgeableAmount = collateralCcySupply.sub(
            ammConstant.div(borrowCcySupply.add(amountToBeLoaned)));
        return pledgeableAmount;
    }
}
