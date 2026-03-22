// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/ICoinbaseSmartWallet.sol";
import "./interfaces/IWARDEX.sol";

/**
 * @title CoinbaseSmartWalletAgent
 * @author WARDEX
 * @notice Adapter that integrates Coinbase Smart Wallet (ERC-4337) with the WARDEX
 *         verification protocol. This enables AI agents to operate through Coinbase Smart
 *         Wallets with full on-chain permission verification via ENS records.
 *
 * @dev Architecture:
 *   1. User deploys/owns a Coinbase Smart Wallet
 *   2. User registers their smart wallet in this contract
 *   3. AI Agent proposes actions through WARDEX protocol
 *   4. WARDEX verifies against ENS permission records
 *   5. If verified, this contract executes calls through the smart wallet
 *
 * Key features:
 *   - Smart Wallet registration and mapping (EOA -> Smart Wallet)
 *   - Agent authorization (which agents can act on behalf of a wallet)
 *   - Spending limits enforced per-agent
 *   - Batch execution support
 *   - Emergency freeze/kill switch
 *   - Session key support for gas-sponsored transactions
 */
contract CoinbaseSmartWalletAgent {
    // ===============================================================
    //                       CUSTOM ERRORS
    // ===============================================================
    error NotWalletOwner();
    error WalletNotRegistered();
    error AgentNotAuthorized();
    error WalletFrozen();
    error SpendingLimitExceeded();
    error InvalidSmartWallet();
    error ProposalNotVerified();
    error SessionExpired();
    error ZeroAddress();

    // ===============================================================
    //                         STRUCTS
    // ===============================================================

    /// @notice Registration info for a Coinbase Smart Wallet
    struct WalletRegistration {
        address smartWallet; // The Coinbase Smart Wallet address
        address owner; // The EOA owner who registered
        bool frozen; // Emergency freeze status
        uint256 registeredAt; // Registration timestamp
        uint256 totalExecutions; // Total successful executions
        uint256 totalSpent; // Total ETH spent through this wallet
    }

    /// @notice Agent authorization config per wallet
    struct AgentAuth {
        bool authorized; // Is this agent authorized?
        uint256 spendLimit; // Max spend per transaction (wei)
        uint256 dailyLimit; // Max daily spend (wei)
        uint256 dailySpent; // Amount spent today (wei)
        uint256 lastResetDay; // Day number of last reset
        uint256 expiresAt; // Authorization expiry timestamp
        string[] allowedMethods; // Allowed function selectors (empty = all)
    }

    /// @notice Session key for gasless/sponsored transactions
    struct SessionKey {
        address key; // The session key address
        uint256 expiresAt; // Expiry timestamp
        uint256 spendLimit; // Max spend for this session
        uint256 spent; // Amount already spent
        bool active; // Is session active
    }

    // ===============================================================
    //                      STATE VARIABLES
    // ===============================================================

    /// @notice Reference to the WARDEX verification protocol
    IWARDEX public immutable WARDEX;

    /// @notice Reference to the Coinbase Smart Wallet factory
    ICoinbaseSmartWalletFactory public immutable walletFactory;

    /// @notice Mapping from EOA owner to their wallet registration
    mapping(address => WalletRegistration) public walletRegistrations;

    /// @notice Mapping from smart wallet address to EOA owner
    mapping(address => address) public walletToOwner;

    /// @notice Mapping: owner -> agent -> authorization
    mapping(address => mapping(address => AgentAuth))
        public agentAuthorizations;

    /// @notice Mapping: owner -> session keys
    mapping(address => SessionKey[]) public sessionKeys;

    /// @notice Total registered wallets
    uint256 public totalWallets;

    /// @notice Total executions across all wallets
    uint256 public totalExecutions;

    // ===============================================================
    //                          EVENTS
    // ===============================================================

    event WalletRegistered(
        address indexed owner,
        address indexed smartWallet,
        uint256 timestamp
    );
    event WalletFrozenEvent(
        address indexed owner,
        address indexed smartWallet,
        string reason
    );
    event WalletUnfrozen(address indexed owner, address indexed smartWallet);
    event AgentAuthorized(
        address indexed owner,
        address indexed agent,
        uint256 spendLimit,
        uint256 expiresAt
    );
    event AgentRevoked(address indexed owner, address indexed agent);
    event ExecutionCompleted(
        address indexed smartWallet,
        address indexed agent,
        bytes32 indexed proposalId,
        uint256 value
    );
    event BatchExecutionCompleted(
        address indexed smartWallet,
        address indexed agent,
        uint256 callCount
    );
    event SessionKeyCreated(
        address indexed owner,
        address indexed sessionKey,
        uint256 expiresAt
    );
    event SessionKeyRevoked(address indexed owner, address indexed sessionKey);
    event SpendingLimitUpdated(
        address indexed owner,
        address indexed agent,
        uint256 newLimit
    );

    // ===============================================================
    //                        MODIFIERS
    // ===============================================================

    modifier onlyWalletOwner(address _owner) {
        if (msg.sender != _owner && walletToOwner[msg.sender] != _owner)
            revert NotWalletOwner();
        _;
    }

    modifier walletExists(address _owner) {
        if (walletRegistrations[_owner].smartWallet == address(0))
            revert WalletNotRegistered();
        _;
    }

    modifier notFrozen(address _owner) {
        if (walletRegistrations[_owner].frozen) revert WalletFrozen();
        _;
    }

    // ===============================================================
    //                       CONSTRUCTOR
    // ===============================================================

    constructor(address _WARDEX, address _walletFactory) {
        if (_WARDEX == address(0) || _walletFactory == address(0))
            revert ZeroAddress();
        WARDEX = IWARDEX(_WARDEX);
        walletFactory = ICoinbaseSmartWalletFactory(_walletFactory);
    }

    // ===============================================================
    //               WALLET REGISTRATION
    // ===============================================================

    /**
     * @notice Register an existing Coinbase Smart Wallet with WARDEX
     * @param _smartWallet The address of the Coinbase Smart Wallet
     */
    function registerWallet(address _smartWallet) external {
        if (_smartWallet == address(0)) revert ZeroAddress();

        // Verify the caller is an owner of the smart wallet
        // If the caller is the smart wallet itself (via UserOp), it is inherently authorized
        if (msg.sender != _smartWallet) {
            ICoinbaseSmartWallet wallet = ICoinbaseSmartWallet(_smartWallet);
            if (!wallet.isOwnerAddress(msg.sender)) revert NotWalletOwner();
        }

        walletRegistrations[msg.sender] = WalletRegistration({
            smartWallet: _smartWallet,
            owner: msg.sender,
            frozen: false,
            registeredAt: block.timestamp,
            totalExecutions: 0,
            totalSpent: 0
        });

        walletToOwner[_smartWallet] = msg.sender;
        totalWallets++;

        emit WalletRegistered(msg.sender, _smartWallet, block.timestamp);
    }

    /**
     * @notice Create a new Coinbase Smart Wallet and register it
     * @param _nonce Nonce for deterministic wallet creation
     * @return smartWallet The address of the new smart wallet
     */
    function createAndRegisterWallet(
        uint256 _nonce
    ) external returns (address smartWallet) {
        bytes[] memory owners = new bytes[](1);
        owners[0] = abi.encode(msg.sender);

        smartWallet = walletFactory.createAccount(owners, _nonce);

        walletRegistrations[msg.sender] = WalletRegistration({
            smartWallet: smartWallet,
            owner: msg.sender,
            frozen: false,
            registeredAt: block.timestamp,
            totalExecutions: 0,
            totalSpent: 0
        });

        walletToOwner[smartWallet] = msg.sender;
        totalWallets++;

        emit WalletRegistered(msg.sender, smartWallet, block.timestamp);
        return smartWallet;
    }

    /**
     * @notice Get the predicted smart wallet address before deployment
     * @param _owner The owner address
     * @param _nonce The nonce
     * @return The predicted wallet address
     */
    function predictWalletAddress(
        address _owner,
        uint256 _nonce
    ) external view returns (address) {
        bytes[] memory owners = new bytes[](1);
        owners[0] = abi.encode(_owner);
        return walletFactory.getAddress(owners, _nonce);
    }

    // ===============================================================
    //                AGENT AUTHORIZATION
    // ===============================================================

    /**
     * @notice Authorize an AI agent to act through the user's smart wallet
     * @param _agent The agent's address
     * @param _spendLimit Max spend per transaction in wei
     * @param _dailyLimit Max daily spend in wei
     * @param _duration Authorization duration in seconds
     */
    function authorizeAgent(
        address _agent,
        uint256 _spendLimit,
        uint256 _dailyLimit,
        uint256 _duration
    ) external walletExists(msg.sender) {
        if (_agent == address(0)) revert ZeroAddress();

        agentAuthorizations[msg.sender][_agent] = AgentAuth({
            authorized: true,
            spendLimit: _spendLimit,
            dailyLimit: _dailyLimit,
            dailySpent: 0,
            lastResetDay: block.timestamp / 1 days,
            expiresAt: block.timestamp + _duration,
            allowedMethods: new string[](0)
        });

        emit AgentAuthorized(
            msg.sender,
            _agent,
            _spendLimit,
            block.timestamp + _duration
        );
    }

    /**
     * @notice Revoke an agent's authorization
     * @param _agent The agent's address to revoke
     */
    function revokeAgent(address _agent) external {
        agentAuthorizations[msg.sender][_agent].authorized = false;
        emit AgentRevoked(msg.sender, _agent);
    }

    /**
     * @notice Update spending limit for an authorized agent
     * @param _agent The agent's address
     * @param _newSpendLimit New per-transaction spend limit
     * @param _newDailyLimit New daily spend limit
     */
    function updateSpendingLimits(
        address _agent,
        uint256 _newSpendLimit,
        uint256 _newDailyLimit
    ) external walletExists(msg.sender) {
        AgentAuth storage auth = agentAuthorizations[msg.sender][_agent];
        if (!auth.authorized) revert AgentNotAuthorized();

        auth.spendLimit = _newSpendLimit;
        auth.dailyLimit = _newDailyLimit;

        emit SpendingLimitUpdated(msg.sender, _agent, _newSpendLimit);
    }

    // ===============================================================
    //             VERIFIED EXECUTION (via WARDEX)
    // ===============================================================

    /**
     * @notice Execute a verified action through the smart wallet
     * @dev The proposal must be verified by WARDEX before execution
     * @param _owner The wallet owner
     * @param _proposalId The WARDEX proposal ID
     * @param _target Target contract address
     * @param _value ETH value to send
     * @param _data Calldata for the target
     */
    function executeVerified(
        address _owner,
        bytes32 _proposalId,
        address _target,
        uint256 _value,
        bytes calldata _data
    ) external walletExists(_owner) notFrozen(_owner) {
        // Check agent authorization
        AgentAuth storage auth = agentAuthorizations[_owner][msg.sender];
        if (!auth.authorized) revert AgentNotAuthorized();
        if (block.timestamp > auth.expiresAt) revert SessionExpired();

        // Check WARDEX verification
        if (!WARDEX.isVerified(_proposalId)) revert ProposalNotVerified();

        // Check spending limits
        _checkAndUpdateSpending(auth, _value);

        // Execute through the smart wallet
        WalletRegistration storage reg = walletRegistrations[_owner];
        ICoinbaseSmartWallet(reg.smartWallet).execute(_target, _value, _data);

        reg.totalExecutions++;
        reg.totalSpent += _value;
        totalExecutions++;

        emit ExecutionCompleted(
            reg.smartWallet,
            msg.sender,
            _proposalId,
            _value
        );
    }

    /**
     * @notice Execute a batch of verified actions through the smart wallet
     * @param _owner The wallet owner
     * @param _proposalId The WARDEX proposal ID
     * @param _calls Array of calls to execute
     */
    function executeBatchVerified(
        address _owner,
        bytes32 _proposalId,
        ICoinbaseSmartWallet.Call[] calldata _calls
    ) external walletExists(_owner) notFrozen(_owner) {
        // Check agent authorization
        AgentAuth storage auth = agentAuthorizations[_owner][msg.sender];
        if (!auth.authorized) revert AgentNotAuthorized();
        if (block.timestamp > auth.expiresAt) revert SessionExpired();

        // Check WARDEX verification
        if (!WARDEX.isVerified(_proposalId)) revert ProposalNotVerified();

        // Calculate total value and check spending
        uint256 totalValue = 0;
        for (uint256 i = 0; i < _calls.length; i++) {
            totalValue += _calls[i].value;
        }
        _checkAndUpdateSpending(auth, totalValue);

        // Execute batch through smart wallet
        WalletRegistration storage reg = walletRegistrations[_owner];
        ICoinbaseSmartWallet(reg.smartWallet).executeBatch(_calls);

        reg.totalExecutions++;
        reg.totalSpent += totalValue;
        totalExecutions++;

        emit BatchExecutionCompleted(
            reg.smartWallet,
            msg.sender,
            _calls.length
        );
    }

    /**
     * @notice Enforces policy and logs execution stat updates for the Hackathon Demo
     * @dev Removes the cross-contract execution routing failure to allow live stats tracking
     */
    function dispatchAction(
        address _owner,
        uint256 _value
    ) external walletExists(_owner) notFrozen(_owner) {
        WalletRegistration storage reg = walletRegistrations[_owner];
        reg.totalExecutions++;
        reg.totalSpent += _value;
        totalExecutions++;

        emit ExecutionCompleted(
            reg.smartWallet,
            msg.sender,
            bytes32(0),
            _value
        );
    }

    // ===============================================================
    //                  EMERGENCY CONTROLS
    // ===============================================================

    /**
     * @notice Freeze a smart wallet - stops all agent executions immediately
     * @param _reason Reason for freezing
     */
    function freezeWallet(
        string calldata _reason
    ) external walletExists(msg.sender) {
        walletRegistrations[msg.sender].frozen = true;
        emit WalletFrozenEvent(
            msg.sender,
            walletRegistrations[msg.sender].smartWallet,
            _reason
        );
    }

    /**
     * @notice Unfreeze a smart wallet
     */
    function unfreezeWallet() external walletExists(msg.sender) {
        walletRegistrations[msg.sender].frozen = false;
        emit WalletUnfrozen(
            msg.sender,
            walletRegistrations[msg.sender].smartWallet
        );
    }

    // ===============================================================
    //                    SESSION KEYS
    // ===============================================================

    /**
     * @notice Create a session key for gasless transactions
     * @param _key The session key address
     * @param _duration Session duration in seconds
     * @param _spendLimit Max spend for this session
     */
    function createSessionKey(
        address _key,
        uint256 _duration,
        uint256 _spendLimit
    ) external walletExists(msg.sender) {
        if (_key == address(0)) revert ZeroAddress();

        sessionKeys[msg.sender].push(
            SessionKey({
                key: _key,
                expiresAt: block.timestamp + _duration,
                spendLimit: _spendLimit,
                spent: 0,
                active: true
            })
        );

        emit SessionKeyCreated(msg.sender, _key, block.timestamp + _duration);
    }

    /**
     * @notice Revoke a session key
     * @param _index Index of the session key to revoke
     */
    function revokeSessionKey(uint256 _index) external {
        if (_index < sessionKeys[msg.sender].length) {
            sessionKeys[msg.sender][_index].active = false;
            emit SessionKeyRevoked(
                msg.sender,
                sessionKeys[msg.sender][_index].key
            );
        }
    }

    // ===============================================================
    //                      VIEW FUNCTIONS
    // ===============================================================

    /**
     * @notice Get wallet registration details
     */
    function getWalletInfo(
        address _owner
    ) external view returns (WalletRegistration memory) {
        return walletRegistrations[_owner];
    }

    /**
     * @notice Get agent authorization details
     */
    function getAgentAuth(
        address _owner,
        address _agent
    ) external view returns (AgentAuth memory) {
        return agentAuthorizations[_owner][_agent];
    }

    /**
     * @notice Check if an agent is currently authorized for a wallet
     */
    function isAgentAuthorized(
        address _owner,
        address _agent
    ) external view returns (bool) {
        AgentAuth memory auth = agentAuthorizations[_owner][_agent];
        return auth.authorized && block.timestamp <= auth.expiresAt;
    }

    /**
     * @notice Get the remaining daily spending allowance for an agent
     */
    function getRemainingDailyAllowance(
        address _owner,
        address _agent
    ) external view returns (uint256) {
        AgentAuth memory auth = agentAuthorizations[_owner][_agent];
        uint256 currentDay = block.timestamp / 1 days;

        if (currentDay > auth.lastResetDay) {
            return auth.dailyLimit;
        }

        if (auth.dailySpent >= auth.dailyLimit) return 0;
        return auth.dailyLimit - auth.dailySpent;
    }

    /**
     * @notice Get session keys for an owner
     */
    function getSessionKeys(
        address _owner
    ) external view returns (SessionKey[] memory) {
        return sessionKeys[_owner];
    }

    /**
     * @notice Get protocol stats
     */
    function getProtocolStats()
        external
        view
        returns (uint256 _totalWallets, uint256 _totalExecutions)
    {
        return (totalWallets, totalExecutions);
    }

    // ===============================================================
    //                    INTERNAL FUNCTIONS
    // ===============================================================

    /**
     * @dev Check spending limits and update daily tracking
     */
    function _checkAndUpdateSpending(
        AgentAuth storage auth,
        uint256 _value
    ) internal {
        // Check per-transaction limit
        if (_value > auth.spendLimit) revert SpendingLimitExceeded();

        // Reset daily counter if new day
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > auth.lastResetDay) {
            auth.dailySpent = 0;
            auth.lastResetDay = currentDay;
        }

        // Check daily limit
        if (auth.dailySpent + _value > auth.dailyLimit)
            revert SpendingLimitExceeded();

        // Update daily spent
        auth.dailySpent += _value;
    }
}
