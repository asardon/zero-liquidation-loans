pragma solidity ^0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

struct CollateralizedCallOption {
    address collateralCcyAddr;
    address borrowCcyAddr;
    address lender;
    uint256 repaymentAmount;
    uint256 pledgedAmount;
    uint256 expiry;
}

contract ZeroLiquidationLoans is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private zeroLiquidationLoanIds;
    mapping (uint256 => CollateralizedCallOption) public metaData;

    constructor() ERC721("ZeroLiquidationLoan", "MYSO") public { }

    function issue(
        address borrower,
        address lender,
        address collateralCcyAddr,
        address borrowCcyAddr,
        uint256 repaymentAmount,
        uint256 pledgeAmount,
        uint256 expiry
    )
        external onlyOwner returns(uint256)
    {
        zeroLiquidationLoanIds.increment();
        uint256 newZeroLiquidationLoanId = zeroLiquidationLoanIds.current();
        CollateralizedCallOption memory callOption = CollateralizedCallOption(
            collateralCcyAddr,
            borrowCcyAddr,
            lender,
            repaymentAmount,
            pledgeAmount,
            expiry
        );
        metaData[newZeroLiquidationLoanId] = callOption;
        _safeMint(borrower, newZeroLiquidationLoanId);
        return newZeroLiquidationLoanId;
    }

    function redeem() external {

    }

    function _mint(address to, uint256 tokenId) internal override onlyOwner {
        _mint(to, tokenId);
    }

    function _safeMint(address to, uint256 tokenId) internal override onlyOwner {
        _safeMint(to, tokenId);
    }

    function _safeMint(
        address to,
        uint256 tokenId,
        bytes memory _data
    )
        internal override onlyOwner
    {
        _safeMint(to, tokenId, _data);
    }
}
