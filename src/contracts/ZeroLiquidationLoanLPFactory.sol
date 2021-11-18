pragma solidity ^0.6.12;

import './ZeroLiquidationLoans.sol';
import './ZeroLiquidationLoanLP.sol';
import "@openzeppelin/contracts/proxy/Clones.sol";

contract ZeroLiquidationLoanLPFactory {
    address immutable zeroLiquidationLoanLPImplementation;
    address[] public zeroLiquidationLoanLPs;
    ZeroLiquidationLoans public zeroLiquidationLoans;

    constructor() public {
        zeroLiquidationLoanLPImplementation = address(new
            ZeroLiquidationLoanLP());
        zeroLiquidationLoans = new ZeroLiquidationLoans();
    }

    function createLP(
        string memory name_,
        string memory symbol_,
        address borrowCcy_,
        address collateralCcy_,
        uint256 lpDuration_,
        uint256 ammDuration_,
        uint256 calcDecimals_,
        uint256 settlementDuration_,
        address maintainer
    )
        external returns (address)
    {
        address clone = Clones.clone(zeroLiquidationLoanLPImplementation);
        ZeroLiquidationLoanLP(clone).initialize(
            name_,
            symbol_,
            borrowCcy_,
            collateralCcy_,
            lpDuration_,
            ammDuration_,
            settlementDuration_,
            calcDecimals_,
            address(this),
            maintainer
        );
        zeroLiquidationLoanLPs.push(clone);
        return clone;
    }

    function getLPs() external view returns(address[] memory){
        return zeroLiquidationLoanLPs;
    }
}
