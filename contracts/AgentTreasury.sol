// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IWstETH {
    function getStETHByWstETH(uint256 wstETHAmount) external view returns (uint256);
}

/**
 * @title AgentTreasury
 * @notice Holds principal in wstETH and allows the WARDEX executor to spend yield only.
 */
contract AgentTreasury {
    address public immutable owner;
    address public immutable agent;
    address public immutable wstETH;

    uint256 public principalWstETH;
    uint256 public depositedStETH;
    uint256 public yieldSpentStETH;
    uint256 public perTxCapStETH;

    mapping(address => bool) public whitelistedRecipients;

    event PrincipalDeposited(uint256 stETHAmount, uint256 wstETHAmount);
    event YieldSpent(address indexed recipient, uint256 amountStETH);
    event RecipientWhitelisted(address indexed recipient, bool isAllowed);
    event PerTxCapUpdated(uint256 perTxCapStETH);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "Only WARDEX");
        _;
    }

    constructor(address _agent, address _wstETH, uint256 _perTxCapStETH) {
        require(_agent != address(0), "Agent required");
        require(_wstETH != address(0), "wstETH required");
        owner = msg.sender;
        agent = _agent;
        wstETH = _wstETH;
        perTxCapStETH = _perTxCapStETH;
    }

    /**
     * @dev Demo path: records principal in 1:1 stETH/wstETH terms.
     * Production deployments should route through canonical stETH->wstETH wrapping.
     */
    function depositPrincipal() external payable onlyOwner {
        require(msg.value > 0, "Must deposit ETH");
        depositedStETH += msg.value;
        principalWstETH += msg.value;
        emit PrincipalDeposited(msg.value, msg.value);
    }

    function availableYieldStETH() public view returns (uint256) {
        if (principalWstETH == 0) {
            return 0;
        }

        uint256 currentValueStETH = IWstETH(wstETH).getStETHByWstETH(principalWstETH);
        if (currentValueStETH <= depositedStETH) {
            return 0;
        }

        uint256 grossYield = currentValueStETH - depositedStETH;
        if (grossYield <= yieldSpentStETH) {
            return 0;
        }
        return grossYield - yieldSpentStETH;
    }

    function spendYield(address recipient, uint256 amountStETH) external onlyAgent {
        require(recipient != address(0), "Recipient required");
        require(whitelistedRecipients[recipient], "Recipient not whitelisted");
        require(amountStETH <= perTxCapStETH, "Exceeds per-tx cap");
        require(amountStETH <= availableYieldStETH(), "Insufficient yield");

        yieldSpentStETH += amountStETH;
        payable(recipient).transfer(amountStETH);
        emit YieldSpent(recipient, amountStETH);
    }

    function setRecipientWhitelist(address recipient, bool isAllowed) external onlyOwner {
        whitelistedRecipients[recipient] = isAllowed;
        emit RecipientWhitelisted(recipient, isAllowed);
    }

    function setPerTxCapStETH(uint256 nextCapStETH) external onlyOwner {
        perTxCapStETH = nextCapStETH;
        emit PerTxCapUpdated(nextCapStETH);
    }
}