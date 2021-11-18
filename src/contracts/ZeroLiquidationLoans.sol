pragma solidity ^0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ZeroLiquidationLoans is ERC721, Ownable {
    constructor() ERC721("ZeroLiquidationLoan", "MYSO") public { }

    function safeMint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
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
