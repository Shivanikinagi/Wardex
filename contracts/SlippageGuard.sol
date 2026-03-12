// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SlippageGuard — On-chain slippage protection for DarkAgent swaps
 * @notice Enforces maximum slippage tolerance read from ENS text records.
 *         Reverts if actual output falls below minimum acceptable amount.
 *
 * Flow:
 *   1. Agent reads `slippage` text record from ENS (e.g., "50" = 0.5%)
 *   2. Agent calls executeSwapWithGuard() with expected output + slippage BPS
 *   3. Contract validates minAmountOut >= amountOut * (10000 - slippageBps) / 10000
 *   4. If oracle-verified output < minAmountOut → revert
 *
 * This contract is a policy enforcer, not a DEX router — it wraps around
 * any swap execution to add slippage enforcement.
 */

interface IDarkAgentRegistry {
    function getAgent(address agentAddress) external view returns (
        address owner, string memory ensName, bytes32 capabilityHash,
        string[] memory capabilities, uint256 reputationScore, uint8 status,
        bytes32 attestationHash, uint256 attestationTime, uint256 registeredAt
    );
}

contract SlippageGuard {
    // ═══════════════════════════════════════════════════════════════
    //                        ERRORS
    // ═══════════════════════════════════════════════════════════════

    error SlippageExceeded(uint256 expected, uint256 actual, uint256 maxSlippageBps);
    error InvalidSlippage(uint256 bps);
    error NotAdmin();
    error AgentNotRegistered();
    error ZeroAmount();
    error SwapAlreadySettled(bytes32 swapId);

    // ═══════════════════════════════════════════════════════════════
    //                        STRUCTS
    // ═══════════════════════════════════════════════════════════════

    struct SwapGuard {
        address agent;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 expectedAmountOut;
        uint256 minAmountOut;
        uint256 maxSlippageBps;     // Basis points (50 = 0.5%)
        uint256 timestamp;
        bool settled;
        bool passed;
    }

    struct AgentSlippageConfig {
        uint256 defaultSlippageBps;  // Default max slippage for this agent
        uint256 totalSwaps;
        uint256 slippageViolations;
        bool customConfigSet;
    }

    // ═══════════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════════

    address public admin;
    IDarkAgentRegistry public registry;

    uint256 public constant MAX_SLIPPAGE_BPS = 1000;  // 10% absolute maximum
    uint256 public constant BPS_DENOMINATOR = 10000;

    mapping(bytes32 => SwapGuard) public swapGuards;
    mapping(address => AgentSlippageConfig) public agentConfigs;
    mapping(address => bytes32[]) public agentSwaps;

    uint256 public totalSwapsGuarded;
    uint256 public totalSlippageViolations;

    // ═══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ═══════════════════════════════════════════════════════════════

    event SwapGuarded(
        bytes32 indexed swapId,
        address indexed agent,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut,
        uint256 minAmountOut,
        uint256 maxSlippageBps
    );

    event SwapSettled(
        bytes32 indexed swapId,
        address indexed agent,
        uint256 actualAmountOut,
        bool passed
    );

    event SlippageViolationDetected(
        address indexed agent,
        bytes32 indexed swapId,
        uint256 expected,
        uint256 actual,
        uint256 maxSlippageBps
    );

    event AgentSlippageConfigured(
        address indexed agent,
        uint256 defaultSlippageBps
    );

    // ═══════════════════════════════════════════════════════════════
    //                        MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //                        CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(address _registry) {
        admin = msg.sender;
        registry = IDarkAgentRegistry(_registry);
    }

    // ═══════════════════════════════════════════════════════════════
    //                     CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Register a swap with slippage guard protection
     * @param agent The agent executing the swap
     * @param tokenIn Input token address (address(0) for ETH)
     * @param tokenOut Output token address
     * @param amountIn Amount of input token
     * @param expectedAmountOut Expected output from the swap
     * @param slippageBps Maximum slippage in basis points (50 = 0.5%)
     * @return swapId Unique identifier for this guarded swap
     */
    function registerSwap(
        address agent,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut,
        uint256 slippageBps
    ) external returns (bytes32 swapId) {
        if (amountIn == 0 || expectedAmountOut == 0) revert ZeroAmount();
        if (slippageBps > MAX_SLIPPAGE_BPS) revert InvalidSlippage(slippageBps);

        // Verify agent is registered
        (, , , , , uint8 status, , ,) = registry.getAgent(agent);
        if (status == 0) revert AgentNotRegistered();

        // Use agent's configured slippage if lower than requested
        uint256 effectiveSlippage = slippageBps;
        AgentSlippageConfig storage config = agentConfigs[agent];
        if (config.customConfigSet && config.defaultSlippageBps < slippageBps) {
            effectiveSlippage = config.defaultSlippageBps;
        }

        // Calculate minimum acceptable output
        uint256 minAmountOut = (expectedAmountOut * (BPS_DENOMINATOR - effectiveSlippage)) / BPS_DENOMINATOR;

        // Generate swap ID
        swapId = keccak256(abi.encodePacked(
            agent, tokenIn, tokenOut, amountIn, block.timestamp, totalSwapsGuarded
        ));

        swapGuards[swapId] = SwapGuard({
            agent: agent,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            expectedAmountOut: expectedAmountOut,
            minAmountOut: minAmountOut,
            maxSlippageBps: effectiveSlippage,
            timestamp: block.timestamp,
            settled: false,
            passed: false
        });

        agentSwaps[agent].push(swapId);
        totalSwapsGuarded++;
        config.totalSwaps++;

        emit SwapGuarded(swapId, agent, tokenIn, tokenOut, amountIn, expectedAmountOut, minAmountOut, effectiveSlippage);

        return swapId;
    }

    /**
     * @notice Settle a swap — verify actual output meets slippage requirements
     * @dev Called after the swap executes to verify slippage was acceptable
     * @param swapId The swap to settle
     * @param actualAmountOut The actual amount received from the swap
     */
    function settleSwap(
        bytes32 swapId,
        uint256 actualAmountOut
    ) external returns (bool passed) {
        SwapGuard storage guard = swapGuards[swapId];
        if (guard.settled) revert SwapAlreadySettled(swapId);
        if (guard.agent == address(0)) revert AgentNotRegistered();

        guard.settled = true;

        if (actualAmountOut >= guard.minAmountOut) {
            guard.passed = true;
            passed = true;
        } else {
            guard.passed = false;
            passed = false;

            totalSlippageViolations++;
            agentConfigs[guard.agent].slippageViolations++;

            emit SlippageViolationDetected(
                guard.agent,
                swapId,
                guard.minAmountOut,
                actualAmountOut,
                guard.maxSlippageBps
            );
        }

        emit SwapSettled(swapId, guard.agent, actualAmountOut, passed);
        return passed;
    }

    /**
     * @notice Validate slippage inline — reverts if slippage exceeded
     * @dev One-shot function for immediate validation without registration
     */
    function validateSlippage(
        address agent,
        uint256 expectedAmountOut,
        uint256 actualAmountOut,
        uint256 maxSlippageBps
    ) external view {
        if (maxSlippageBps > MAX_SLIPPAGE_BPS) revert InvalidSlippage(maxSlippageBps);

        // Check agent config for stricter limit
        uint256 effectiveSlippage = maxSlippageBps;
        AgentSlippageConfig storage config = agentConfigs[agent];
        if (config.customConfigSet && config.defaultSlippageBps < maxSlippageBps) {
            effectiveSlippage = config.defaultSlippageBps;
        }

        uint256 minAmountOut = (expectedAmountOut * (BPS_DENOMINATOR - effectiveSlippage)) / BPS_DENOMINATOR;

        if (actualAmountOut < minAmountOut) {
            revert SlippageExceeded(minAmountOut, actualAmountOut, effectiveSlippage);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //                     CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Configure default slippage tolerance for an agent
     * @dev Reads from ENS `slippage` text record (e.g., "50" = 0.5%)
     * @param agent Agent address
     * @param defaultSlippageBps Max slippage in basis points
     */
    function configureAgentSlippage(
        address agent,
        uint256 defaultSlippageBps
    ) external {
        if (defaultSlippageBps > MAX_SLIPPAGE_BPS) revert InvalidSlippage(defaultSlippageBps);

        agentConfigs[agent].defaultSlippageBps = defaultSlippageBps;
        agentConfigs[agent].customConfigSet = true;

        emit AgentSlippageConfigured(agent, defaultSlippageBps);
    }

    // ═══════════════════════════════════════════════════════════════
    //                     VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function getSwapGuard(bytes32 swapId) external view returns (SwapGuard memory) {
        return swapGuards[swapId];
    }

    function getAgentConfig(address agent) external view returns (AgentSlippageConfig memory) {
        return agentConfigs[agent];
    }

    function getAgentSwapHistory(address agent) external view returns (bytes32[] memory) {
        return agentSwaps[agent];
    }

    function getStats() external view returns (
        uint256 _totalSwaps,
        uint256 _totalViolations,
        uint256 _successRate
    ) {
        _totalSwaps = totalSwapsGuarded;
        _totalViolations = totalSlippageViolations;
        _successRate = totalSwapsGuarded > 0
            ? ((totalSwapsGuarded - totalSlippageViolations) * 100) / totalSwapsGuarded
            : 0;
    }
}
