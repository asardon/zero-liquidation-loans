pragma solidity ^0.6.12;

import './utils/Math.sol';
import './ZeroLiquidationLoanLP.sol';
import './ZeroLiquidationLoanLPFactory.sol';
import "@openzeppelin/contracts/math/SafeMath.sol";

contract ZeroLiquidationLoanAMM is ZeroLiquidationLoanLPFactory {
    using SafeMath for uint256;

    uint256 constant BLOCKS_PER_YEAR = 2372500;

    function borrow(
        address LP,
        uint256 minBorrowCcyOutAmount,
        uint256 pledgeAmount
    )
        public
    {
        require(
            ZeroLiquidationLoanLP(LP).isAmmPeriodActive(),
            "AMM period not active"
        );
        (
            uint256 borrowCcyOutAmount,
            uint256 interestAmount,
            uint256 repaymentAmount
        ) = getBorrowingTerms(LP, pledgeAmount);
        require(
            borrowCcyOutAmount >= minBorrowCcyOutAmount,
            "borrowCcyOutAmount must be at least minBorrowCcyOutAmount"
        );

        ZeroLiquidationLoanLP(LP).collateralCcyToken().transferFrom(
            msg.sender,
            LP,
            pledgeAmount
        );

        ZeroLiquidationLoanLP(LP).addToCollateralCcySupply(pledgeAmount);
        ZeroLiquidationLoanLP(LP).transferBorrowCcy(msg.sender,
            borrowCcyOutAmount);
        ZeroLiquidationLoanLP(LP).subFromBorrowCcySupply(borrowCcyOutAmount);
        ZeroLiquidationLoanLP(LP).updateAmmConstant();

        zeroLiquidationLoans.safeMint(msg.sender, 1);
        // ToDo: add meta data, i.e., pledgeAmount (qty of calls),
        // repaymentAmount/pledgeAmount (strike of call),
        // time to expiry
    }

    function getBorrowingTerms(
        address LP,
        uint256 amountToBePledged
    )
        public view returns (uint256, uint256, uint256)
    {
        uint256 repaymentAmount = getBorrowableAmount(LP, amountToBePledged);
        uint256 interestAmount = getInterestCost(LP, amountToBePledged);
        uint256 borrowCcyOutAmount = 0;
        if (repaymentAmount > interestAmount) {
            borrowCcyOutAmount = repaymentAmount.sub(interestAmount);
        }
        return (borrowCcyOutAmount, interestAmount, repaymentAmount);
    }

    function getBorrowableAmount(
        address LP,
        uint256 amountToBePledged
    )
        public view returns (uint256)
    {
        uint256 borrowCcySupply = ZeroLiquidationLoanLP(LP).borrowCcySupply();
        uint256 ammConstant = ZeroLiquidationLoanLP(LP).ammConstant();
        uint256 collateralCcySupply = ZeroLiquidationLoanLP(LP
            ).collateralCcySupply();

        uint256 borrowableAmount = borrowCcySupply.sub(ammConstant.div(
            collateralCcySupply.add(amountToBePledged)));
        return borrowableAmount;
    }

    function getInterestCost(
        address LP,
        uint256 pledgedAmount
    )
        public view returns (uint256)
    {
        (,uint256 sqrtTimeToExpiry) = getTimeToExpiry(LP);
        uint256 obliviousPutPrice = getObliviousPutPrice(LP, sqrtTimeToExpiry);
        uint256 collateralCcyDecimals = ZeroLiquidationLoanLP(LP
            ).collateralCcyToken().decimals();
        uint256 interestCost = obliviousPutPrice.mul(pledgedAmount).div(
            10**collateralCcyDecimals);
        return interestCost;
    }

    function getObliviousPutPrice(
        address LP,
        uint256 sqrtTimeToExpiry
    )
        public view returns (uint256)
    {
        uint256 alpha = ZeroLiquidationLoanLP(LP).alpha();
        require(alpha > 0, "alpha must be set and greater zero");
        uint256 collateralPrice = ZeroLiquidationLoanLP(LP).collateralPrice();
        require(
            collateralPrice > 0,
            "collateralPrice must be set and greater zero"
        );
        uint256 collateralPriceAnnualizedVol = ZeroLiquidationLoanLP(
            LP).collateralPriceAnnualizedVol();
        require(
            collateralPriceAnnualizedVol > 0,
            "collateralPriceAnnualizedVol must be set and greater zero"
        );
        uint256 calcDecimals = ZeroLiquidationLoanLP(LP).calcDecimals();
        return alpha.mul(collateralPrice).mul(
            collateralPriceAnnualizedVol).mul(sqrtTimeToExpiry).div(
            calcDecimals).div(calcDecimals).div(calcDecimals);
    }

    function getTimeToExpiry(address LP) public view returns
        (
            uint256 timeToExpiry,
            uint256 sqrtTimeToExpiry
        )
    {
        require(
            ZeroLiquidationLoanLP(LP).ammEnd() > block.number,
            "must be before AMM end"
        );
        uint256 timeToExpiry_ = ZeroLiquidationLoanLP(LP).ammEnd().sub(
            block.number).mul(ZeroLiquidationLoanLP(LP).calcDecimals()).div(
            BLOCKS_PER_YEAR);
        uint256 sqrtTimeToExpiry_ = Math.sqrt(timeToExpiry_.mul(
            ZeroLiquidationLoanLP(LP).calcDecimals()));
        return (timeToExpiry_, sqrtTimeToExpiry_);
    }

    function getPledgeableAmount(
        address LP,
        uint256 amountToBeLoaned
    )
        public view returns (uint256)
    {
        uint256 collateralCcySupply = ZeroLiquidationLoanLP(LP
            ).collateralCcySupply();
        uint256 ammConstant = ZeroLiquidationLoanLP(LP).ammConstant();
        uint256 borrowCcySupply = ZeroLiquidationLoanLP(LP).borrowCcySupply();

        uint256 pledgeableAmount = collateralCcySupply.sub(
            ammConstant.div(borrowCcySupply.add(amountToBeLoaned)));
        return pledgeableAmount;
    }
}
