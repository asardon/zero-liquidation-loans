pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

enum PoolState {
    UNDEFINED,
    LP,
    PENDING_INITIALIZATION,
    AMM,
    SETTLEMENT,
    POST_SETTLMENT
}

contract ZeroLiquidationLoanLP is ERC20Upgradeable, AccessControlUpgradeable {

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant MAINTAINER_ROLE = keccak256("MAINTAINER_ROLE");
    ERC20 public borrowCcyToken;
    ERC20 public collateralCcyToken;
    uint256 public lpEnd;
    uint256 public ammEnd;
    uint256 public settlementEnd;
    uint256 public borrowCcySupply;
    uint256 public collateralCcySupply;
    uint256 public ammConstant;
    bool public ammIsInitialized;
    uint256 public alpha;
    uint256 public collateralPrice;
    uint256 public collateralPriceAnnualizedVol;
    uint256 public calcDecimals;

    function initialize(
        string memory name_,
        string memory symbol_,
        address borrowCcy_,
        address collateralCcy_,
        uint256 lpDuration,
        uint256 ammDuration,
        uint256 settlementDuration,
        uint256 calcDecimals_,
        address owner,
        address maintainer
    )
        public virtual initializer
    {
        __ERC20_init(name_, symbol_);
        __AccessControl_init();
        borrowCcyToken = ERC20(borrowCcy_);
        collateralCcyToken = ERC20(collateralCcy_);
        lpEnd = block.number.add(lpDuration);
        ammEnd = lpEnd.add(ammDuration);
        settlementEnd = ammEnd.add(settlementDuration);
        calcDecimals = calcDecimals_;
        grantRole(OWNER_ROLE, owner);
        grantRole(MAINTAINER_ROLE, maintainer);
    }

    function getState() public view returns (PoolState) {
        PoolState state = PoolState.UNDEFINED;
        if(isLpPeriodActive()) {
            state = PoolState.LP;
        } else if(isPendingInitialization()) {
            state = PoolState.PENDING_INITIALIZATION;
        } else if(isAmmPeriodActive()) {
            state = PoolState.AMM;
        } else if(isSettlementPeriodActive()) {
            state = PoolState.SETTLEMENT;
        } else if(isPostSettlementPeriodActive()) {
            state = PoolState.POST_SETTLMENT;
        }
        return state;
    }

    function isLpPeriodActive() public view returns (bool) {
        return block.number <= lpEnd;
    }

    function isPendingInitialization() public view returns (bool) {
        return (
            !ammIsInitialized &&
            block.number > lpEnd &&
            block.number <= ammEnd);
    }

    function isAmmPeriodActive() public view returns (bool) {
        return (
            ammIsInitialized &&
            block.number > lpEnd &&
            block.number <= ammEnd);
    }

    function isSettlementPeriodActive() public view returns (bool) {
        return block.number > ammEnd && block.number <= settlementEnd;
    }

    function isPostSettlementPeriodActive() public view returns (bool) {
        return block.number > settlementEnd;
    }

    function addToCollateralCcySupply(
        uint256 amount
    )
        external
    {
        require(hasRole(OWNER_ROLE, msg.sender), "not OWNER_ROLE");
        collateralCcySupply = collateralCcySupply.add(amount);
    }

    function subFromCollateralCcySupply(
        uint256 amount
    )
        external
    {
        require(hasRole(OWNER_ROLE, msg.sender), "not OWNER_ROLE");
        collateralCcySupply = collateralCcySupply.sub(amount);
    }

    function addToBorrowCcySupply(
        uint256 amount
    )
        external
    {
        require(hasRole(OWNER_ROLE, msg.sender), "not OWNER_ROLE");
        borrowCcySupply = borrowCcySupply.add(amount);
    }

    function subFromBorrowCcySupply(
        uint256 amount
    )
        external
    {
        require(hasRole(OWNER_ROLE, msg.sender), "not OWNER_ROLE");
        borrowCcySupply = borrowCcySupply.sub(amount);
    }

    function updateAmmConstant() external {
        require(hasRole(MAINTAINER_ROLE, msg.sender), "not MAINTAINER_ROLE");
        ammConstant = collateralCcySupply.mul(borrowCcySupply);
    }

    function setAlpha(uint256 alpha_) external {
        require(hasRole(MAINTAINER_ROLE, msg.sender), "not MAINTAINER_ROLE");
        require(alpha != 0, "alpha must not be zero");
        alpha = alpha_;
    }

    function setCollateralPrice(uint256 collateralPrice_) external {
        require(hasRole(MAINTAINER_ROLE, msg.sender), "not MAINTAINER_ROLE");
        require(collateralPrice_ != 0, "collateralPrice must not be zero");
        collateralPrice = collateralPrice_;
    }

    function setCollateralPriceAnnualizedVol(
        uint256 collateralPriceAnnualizedVol_
    )
        external
    {
        require(hasRole(MAINTAINER_ROLE, msg.sender), "not MAINTAINER_ROLE");
        require(
            collateralPriceAnnualizedVol_ != 0,
            "setCollateralPriceAnnualizedVol must not be zero"
        );
        collateralPriceAnnualizedVol = collateralPriceAnnualizedVol_;
    }

    function transferBorrowCcy(
        address receiver,
        uint256 amount
    )
        external
    {
        require(hasRole(OWNER_ROLE, msg.sender), "not OWNER_ROLE");
        borrowCcyToken.transfer(receiver, amount);
    }
}
