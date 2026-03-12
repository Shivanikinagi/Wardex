// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CapabilityCheck - On-chain Capability Enforcement
 * @notice Enforces what each AI agent is allowed to do.
 *         If an agent tries to act outside its declared capability -> blocked on-chain.
 *
 * @dev Works in tandem with DarkAgent.sol.
 *      Capabilities are stored as hashes for gas efficiency.
 *      Human-readable capability names are mapped to hashes for lookup.
 *
 * Capability categories:
 *   - "yield-farming"     -> Agent can perform yield farming operations
 *   - "token-swap"        -> Agent can swap tokens on DEXs
 *   - "data-analysis"     -> Agent can analyze on-chain data
 *   - "portfolio-rebalance" -> Agent can rebalance portfolios
 *   - "bridge-transfer"   -> Agent can bridge assets cross-chain
 *   - "nft-trading"       -> Agent can trade NFTs
 */
contract CapabilityCheck {
    // ===============================================================
    //                       CUSTOM ERRORS
    // ===============================================================

    error NotAdmin();
    error NotAuthorized();
    error UnknownCapability(string name);
    error ActionNotAllowed(address agent, string action);

    // ===============================================================
    //                          STRUCTS
    // ===============================================================

    /// @notice A capability definition
    struct Capability {
        string name;             // Human-readable name
        bytes32 nameHash;        // keccak256 of the name
        string description;      // What this capability allows
        bool requiresAttestation; // Does this need valid TEE attestation?
        uint256 riskLevel;       // 1-5 risk rating
    }

    /// @notice Result of a capability check
    struct CheckResult {
        bool allowed;
        string reason;
        uint256 timestamp;
    }

    // ===============================================================
    //                        STATE VARIABLES
    // ===============================================================

    /// @notice Admin address
    address public admin;

    /// @notice Reference to DarkAgent registry
    address public darkAgentRegistry;

    /// @notice Capability name hash -> Capability definition
    mapping(bytes32 => Capability) public capabilities;

    /// @notice All registered capability name hashes
    bytes32[] public capabilityHashes;

    /// @notice Agent address -> capability hash -> whether granted
    mapping(address => mapping(bytes32 => bool)) public agentCapabilities;

    /// @notice Agent address -> check results log
    mapping(address => CheckResult[]) public checkHistory;

    /// @notice Total capability violations detected
    uint256 public totalViolations;

    /// @notice Total successful capability checks
    uint256 public totalSuccessfulChecks;

    // ===============================================================
    //                          EVENTS
    // ===============================================================

    event CapabilityRegistered(
        string name,
        bytes32 indexed nameHash,
        uint256 riskLevel
    );

    event CapabilityGranted(
        address indexed agent,
        bytes32 indexed capabilityHash,
        string capabilityName
    );

    event CapabilityRevoked(
        address indexed agent,
        bytes32 indexed capabilityHash,
        string capabilityName
    );

    event CapabilityCheckPassed(
        address indexed agent,
        string action,
        uint256 timestamp
    );

    event CapabilityViolationDetected(
        address indexed agent,
        string attemptedAction,
        uint256 timestamp
    );

    // ===============================================================
    //                        MODIFIERS
    // ===============================================================

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyRegistry() {
        if (msg.sender != darkAgentRegistry && msg.sender != admin) revert NotAuthorized();
        _;
    }

    // ===============================================================
    //                       CONSTRUCTOR
    // ===============================================================

    constructor(address _darkAgentRegistry) {
        admin = msg.sender;
        darkAgentRegistry = _darkAgentRegistry;

        // Register default capabilities
        _registerCapability("yield-farming", "Execute yield farming strategies", true, 3);
        _registerCapability("token-swap", "Swap tokens on decentralized exchanges", true, 2);
        _registerCapability("data-analysis", "Analyze on-chain data and metrics", false, 1);
        _registerCapability("portfolio-rebalance", "Rebalance portfolio allocations", true, 4);
        _registerCapability("bridge-transfer", "Bridge assets across chains", true, 5);
        _registerCapability("nft-trading", "Trade NFTs on marketplaces", true, 3);
        _registerCapability("payment", "Send payments to other agents", true, 2);
        _registerCapability("reporting", "Generate compliance reports", false, 1);
    }

    // ===============================================================
    //                   CAPABILITY MANAGEMENT
    // ===============================================================

    /**
     * @notice Register a new capability type in the system
     */
    function registerCapability(
        string calldata name,
        string calldata description,
        bool requiresAttestation,
        uint256 riskLevel
    ) external onlyAdmin {
        _registerCapability(name, description, requiresAttestation, riskLevel);
    }

    /**
     * @notice Grant a capability to an agent
     */
    function grantCapability(
        address agent,
        string calldata capabilityName
    ) external onlyRegistry {
        bytes32 capHash = keccak256(abi.encodePacked(capabilityName));
        if (capabilities[capHash].nameHash == bytes32(0)) revert UnknownCapability(capabilityName);

        agentCapabilities[agent][capHash] = true;
        emit CapabilityGranted(agent, capHash, capabilityName);
    }

    /**
     * @notice Revoke a capability from an agent
     */
    function revokeCapability(
        address agent,
        string calldata capabilityName
    ) external onlyRegistry {
        bytes32 capHash = keccak256(abi.encodePacked(capabilityName));
        agentCapabilities[agent][capHash] = false;
        emit CapabilityRevoked(agent, capHash, capabilityName);
    }

    /**
     * @notice Bulk grant capabilities to an agent
     */
    function grantCapabilities(
        address agent,
        string[] calldata capabilityNames
    ) external onlyRegistry {
        for (uint256 i = 0; i < capabilityNames.length; i++) {
            bytes32 capHash = keccak256(abi.encodePacked(capabilityNames[i]));
            if (capabilities[capHash].nameHash == bytes32(0)) revert UnknownCapability(capabilityNames[i]);
            agentCapabilities[agent][capHash] = true;
            emit CapabilityGranted(agent, capHash, capabilityNames[i]);
        }
    }

    // ===============================================================
    //                   CAPABILITY CHECKING
    // ===============================================================

    /**
     * @notice Check if an agent is allowed to perform a specific action
     * @param agent The agent address
     * @param action The action being attempted
     * @return allowed Whether the action is permitted
     */
    function check(
        address agent,
        string calldata action
    ) external returns (bool allowed) {
        bytes32 actionHash = keccak256(abi.encodePacked(action));

        if (agentCapabilities[agent][actionHash]) {
            // Capability check passed
            totalSuccessfulChecks++;
            
            checkHistory[agent].push(CheckResult({
                allowed: true,
                reason: "Capability verified",
                timestamp: block.timestamp
            }));

            emit CapabilityCheckPassed(agent, action, block.timestamp);
            return true;
        } else {
            // VIOLATION -- agent tried to act outside its capability
            totalViolations++;

            checkHistory[agent].push(CheckResult({
                allowed: false,
                reason: "Capability violation: action not granted",
                timestamp: block.timestamp
            }));

            emit CapabilityViolationDetected(agent, action, block.timestamp);
            return false;
        }
    }

    /**
     * @notice Check capability without modifying state (view only)
     */
    function checkView(
        address agent,
        string calldata action
    ) external view returns (bool allowed) {
        bytes32 actionHash = keccak256(abi.encodePacked(action));
        return agentCapabilities[agent][actionHash];
    }

    /**
     * @notice Enforce capability -- reverts if agent doesn't have it
     */
    function enforce(
        address agent,
        string calldata action
    ) external {
        bytes32 actionHash = keccak256(abi.encodePacked(action));

        if (!agentCapabilities[agent][actionHash]) {
            totalViolations++;

            checkHistory[agent].push(CheckResult({
                allowed: false,
                reason: "Capability enforcement failed",
                timestamp: block.timestamp
            }));

            emit CapabilityViolationDetected(agent, action, block.timestamp);
            revert ActionNotAllowed(agent, action);
        }

        totalSuccessfulChecks++;

        checkHistory[agent].push(CheckResult({
            allowed: true,
            reason: "Capability enforced successfully",
            timestamp: block.timestamp
        }));

        emit CapabilityCheckPassed(agent, action, block.timestamp);
    }

    // ===============================================================
    //                   VIEW FUNCTIONS
    // ===============================================================

    /**
     * @notice Get all registered capability definitions
     */
    function getAllCapabilities() external view returns (Capability[] memory) {
        Capability[] memory result = new Capability[](capabilityHashes.length);
        for (uint256 i = 0; i < capabilityHashes.length; i++) {
            result[i] = capabilities[capabilityHashes[i]];
        }
        return result;
    }

    /**
     * @notice Get check history for an agent
     */
    function getCheckHistory(address agent) external view returns (CheckResult[] memory) {
        return checkHistory[agent];
    }

    /**
     * @notice Check if agent has a specific capability
     */
    function hasCapability(
        address agent,
        string calldata capabilityName
    ) external view returns (bool) {
        bytes32 capHash = keccak256(abi.encodePacked(capabilityName));
        return agentCapabilities[agent][capHash];
    }

    /**
     * @notice Get system statistics
     */
    function getStats() external view returns (
        uint256 registeredCapabilities,
        uint256 violations,
        uint256 successfulChecks
    ) {
        return (capabilityHashes.length, totalViolations, totalSuccessfulChecks);
    }

    // ===============================================================
    //                   INTERNAL FUNCTIONS
    // ===============================================================

    function _registerCapability(
        string memory name,
        string memory description,
        bool requiresAttestation,
        uint256 riskLevel
    ) internal {
        bytes32 nameHash = keccak256(abi.encodePacked(name));

        capabilities[nameHash] = Capability({
            name: name,
            nameHash: nameHash,
            description: description,
            requiresAttestation: requiresAttestation,
            riskLevel: riskLevel
        });

        capabilityHashes.push(nameHash);
        emit CapabilityRegistered(name, nameHash, riskLevel);
    }

    /**
     * @notice Update the DarkAgent registry address
     */
    function updateRegistry(address _newRegistry) external onlyAdmin {
        darkAgentRegistry = _newRegistry;
    }
}
