// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IBitGoWallet - Interface for BitGo wallet integration
 * @notice Defines spending controls and circuit breaker for agent wallets
 */
interface IBitGoWallet {
    /// @notice Spending policy for an agent
    struct SpendingPolicy {
        uint256 maxPerTransaction;    // Max amount per single transaction (in wei)
        uint256 maxPerDay;            // Max daily spending (in wei)
        uint256 alertThreshold;       // Alert owner above this amount (in wei)
        bool onlyVerifiedRecipients;  // Can only pay verified agents
        bool frozen;                  // Whether the wallet is frozen
    }

    /// @notice Emitted when a wallet is frozen
    event WalletFrozen(address indexed agent, string reason);

    /// @notice Emitted when a wallet is unfrozen
    event WalletUnfrozen(address indexed agent);

    /// @notice Emitted when spending policy is updated
    event PolicyUpdated(address indexed agent, SpendingPolicy policy);

    /// @notice Emitted when a spending alert is triggered
    event SpendingAlert(address indexed agent, uint256 amount, uint256 threshold);

    /// @notice Freeze an agent's wallet (circuit breaker)
    function freezeWallet(address agent) external;

    /// @notice Unfreeze an agent's wallet
    function unfreezeWallet(address agent) external;

    /// @notice Set spending policy for an agent
    function setSpendingPolicy(address agent, SpendingPolicy calldata policy) external;

    /// @notice Get spending policy for an agent
    function getSpendingPolicy(address agent) external view returns (SpendingPolicy memory);

    /// @notice Check if a transaction is within limits
    function checkTransaction(address agent, uint256 amount, address recipient) external view returns (bool);

    /// @notice Record a spend for daily tracking
    function recordSpend(address agent, uint256 amount) external;
}
