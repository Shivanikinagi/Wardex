// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DarkAgent - Core Agent Registry & Security Infrastructure
 * @author DarkAgent Team — ETHMumbai 2026
 * @notice Registers AI agents with verified identity, spending controls,
 *         TEE attestation tracking, and circuit breaker functionality.
 * @dev Deployed on Base Sepolia. Central hub of the DarkAgent system.
 *
 * Key features:
 *   1. Agent registration with ENS subname linking
 *   2. Capability enforcement via on-chain capability hashes
 *   3. TEE attestation tracking and validation
 *   4. Circuit breaker: instant wallet freeze on tamper detection
 *   5. Spending controls per agent (max per tx, max per day, alerts)
 *   6. ZK compliance proof posting and verification
 */
contract DarkAgent {
    // ===============================================================
    //                       CUSTOM ERRORS
    // ===============================================================

    error NotAdmin();
    error NotAgentOwner();
    error AgentNotActive();
    error AgentNotExist();
    error ZeroAddress();
    error AlreadyRegistered();
    error EmptyENSName();
    error NoCapabilities();
    error UnauthorizedCircuitBreaker();
    error AgentNotFrozen();
    error ExceedsPerTxLimit(uint256 amount, uint256 limit);
    error ExceedsDailyLimit(uint256 projected, uint256 limit);
    error RecipientNotVerified(address recipient);
    error CapabilityViolationError(address agent, string action);
    // ===============================================================
    //                          STRUCTS
    // ===============================================================

    /// @notice Full agent profile stored on-chain
    struct Agent {
        address owner;             // Who owns/controls this agent
        string ensName;            // e.g., "trading-agent.darkagent.eth"
        bytes32 capabilityHash;    // Hash of what this agent is allowed to do
        string[] capabilities;     // Human-readable capability list
        uint256 reputationScore;   // Agent reputation (0-100)
        AgentStatus status;        // Current operational status
        bytes32 attestationHash;   // Latest TEE attestation hash
        uint256 attestationTime;   // When the attestation was last updated
        uint256 registeredAt;      // Registration timestamp
        uint256 dailySpent;        // Amount spent today
        uint256 lastSpendReset;    // Last time daily counter was reset
    }

    /// @notice Agent operational status
    enum AgentStatus {
        Inactive,   // Not yet activated
        Active,     // Running normally
        Frozen,     // Circuit breaker fired -- wallet frozen
        Suspended   // Manually suspended by owner
    }

    /// @notice Spending policy per agent
    struct SpendingPolicy {
        uint256 maxPerTransaction;    // Max per single tx (wei)
        uint256 maxPerDay;            // Max daily (wei)
        uint256 alertThreshold;       // Alert above this (wei)
        bool onlyVerifiedRecipients;  // Only pay other verified agents
    }

    /// @notice Circuit breaker event log
    struct CircuitBreakerEvent {
        uint256 timestamp;
        string reason;
        bytes32 oldAttestationHash;
        bytes32 newAttestationHash;
    }

    /// @notice ZK compliance proof record
    struct ComplianceProof {
        bytes32 proofHash;         // Hash of the ZK proof
        uint256 timestamp;         // When proof was submitted
        bool verified;             // Whether proof was verified
        string proofType;          // "spending_limit", "whitelist", "sanctions"
    }

    // ===============================================================
    //                        STATE VARIABLES
    // ===============================================================

    /// @notice Contract deployer / admin
    address public admin;

    /// @notice Agent address -> Agent profile
    mapping(address => Agent) public agents;

    /// @notice All registered agent addresses
    address[] public agentAddresses;

    /// @notice Agent address -> spending policy
    mapping(address => SpendingPolicy) public spendingPolicies;

    /// @notice Agent address -> circuit breaker events
    mapping(address => CircuitBreakerEvent[]) public circuitBreakerEvents;

    /// @notice Agent address -> compliance proofs
    mapping(address => ComplianceProof[]) public complianceProofs;

    /// @notice ENS name hash -> agent address (reverse lookup)
    mapping(bytes32 => address) public ensToAgent;

    /// @notice Verified agent addresses (whitelist)
    mapping(address => bool) public verifiedAgents;

    /// @notice Total number of registered agents
    uint256 public totalAgents;

    /// @notice Total circuit breaker events fired
    uint256 public totalCircuitBreakerEvents;

    // ===============================================================
    //                          EVENTS
    // ===============================================================

    event AgentRegistered(
        address indexed agentAddress,
        address indexed owner,
        string ensName,
        bytes32 capabilityHash
    );

    event AgentStatusChanged(
        address indexed agentAddress,
        AgentStatus oldStatus,
        AgentStatus newStatus
    );

    event AttestationUpdated(
        address indexed agentAddress,
        bytes32 oldHash,
        bytes32 newHash,
        uint256 timestamp
    );

    event CircuitBreakerFired(
        address indexed agentAddress,
        string reason,
        bytes32 attestationHash,
        uint256 timestamp
    );

    event WalletFrozen(
        address indexed agentAddress,
        string reason,
        uint256 timestamp
    );

    event WalletUnfrozen(
        address indexed agentAddress,
        uint256 timestamp
    );

    event SpendingPolicySet(
        address indexed agentAddress,
        uint256 maxPerTransaction,
        uint256 maxPerDay,
        uint256 alertThreshold
    );

    event SpendingAlert(
        address indexed agentAddress,
        uint256 amount,
        uint256 threshold
    );

    event CapabilityViolation(
        address indexed agentAddress,
        string attemptedAction,
        bytes32 capabilityHash
    );

    event ComplianceProofPosted(
        address indexed agentAddress,
        bytes32 proofHash,
        string proofType,
        bool verified
    );

    event ReputationUpdated(
        address indexed agentAddress,
        uint256 oldScore,
        uint256 newScore
    );

    // ===============================================================
    //                        MODIFIERS
    // ===============================================================

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyAgentOwner(address agentAddress) {
        if (agents[agentAddress].owner != msg.sender) revert NotAgentOwner();
        _;
    }

    modifier onlyActiveAgent(address agentAddress) {
        if (agents[agentAddress].status != AgentStatus.Active) revert AgentNotActive();
        _;
    }

    modifier agentExists(address agentAddress) {
        if (agents[agentAddress].owner == address(0)) revert AgentNotExist();
        _;
    }

    // ===============================================================
    //                       CONSTRUCTOR
    // ===============================================================

    constructor() {
        admin = msg.sender;
    }

    // ===============================================================
    //                   AGENT REGISTRATION
    // ===============================================================

    /**
     * @notice Register a new AI agent with identity and capabilities
     * @param agentAddress The agent's on-chain address
     * @param ensName Human-readable ENS subname (e.g., "trading-agent.darkagent.eth")
     * @param capabilities List of capabilities the agent is allowed to perform
     * @param maxPerTx Maximum spending per transaction (wei)
     * @param maxPerDay Maximum daily spending (wei)
     * @param alertThreshold Alert owner above this spend (wei)
     */
    function registerAgent(
        address agentAddress,
        string calldata ensName,
        string[] calldata capabilities,
        uint256 maxPerTx,
        uint256 maxPerDay,
        uint256 alertThreshold
    ) external {
        if (agentAddress == address(0)) revert ZeroAddress();
        if (agents[agentAddress].owner != address(0)) revert AlreadyRegistered();
        if (bytes(ensName).length == 0) revert EmptyENSName();
        if (capabilities.length == 0) revert NoCapabilities();

        // Generate capability hash from the list of capabilities
        bytes32 capHash = _generateCapabilityHash(capabilities);

        // Create agent profile
        agents[agentAddress] = Agent({
            owner: msg.sender,
            ensName: ensName,
            capabilityHash: capHash,
            capabilities: capabilities,
            reputationScore: 50, // Start at neutral reputation
            status: AgentStatus.Active,
            attestationHash: bytes32(0),
            attestationTime: 0,
            registeredAt: block.timestamp,
            dailySpent: 0,
            lastSpendReset: block.timestamp
        });

        // Set spending policy
        spendingPolicies[agentAddress] = SpendingPolicy({
            maxPerTransaction: maxPerTx,
            maxPerDay: maxPerDay,
            alertThreshold: alertThreshold,
            onlyVerifiedRecipients: true
        });

        // Register in lookup tables
        bytes32 ensNode = keccak256(abi.encodePacked(ensName));
        ensToAgent[ensNode] = agentAddress;
        agentAddresses.push(agentAddress);
        verifiedAgents[agentAddress] = true;
        totalAgents++;

        emit AgentRegistered(agentAddress, msg.sender, ensName, capHash);
        emit SpendingPolicySet(agentAddress, maxPerTx, maxPerDay, alertThreshold);
    }

    // ===============================================================
    //                   CAPABILITY ENFORCEMENT
    // ===============================================================

    /**
     * @notice Check if an agent is allowed to perform a specific action
     * @param agentAddress The agent to check
     * @param action The action being attempted
     * @return allowed Whether the action is within the agent's capabilities
     */
    function checkCapability(
        address agentAddress,
        string calldata action
    ) external view agentExists(agentAddress) returns (bool allowed) {
        Agent storage agent = agents[agentAddress];
        
        // Agent must be active
        if (agent.status != AgentStatus.Active) {
            return false;
        }

        // Check if action matches any declared capability
        for (uint256 i = 0; i < agent.capabilities.length; i++) {
            if (keccak256(bytes(agent.capabilities[i])) == keccak256(bytes(action))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @notice Execute action with capability enforcement
     * @dev Reverts if agent doesn't have the capability
     * @param agentAddress The agent performing the action
     * @param action The action being performed
     */
    function executeWithCapabilityCheck(
        address agentAddress,
        string calldata action
    ) external onlyActiveAgent(agentAddress) {
        Agent storage agent = agents[agentAddress];
        bool hasCapability = false;

        for (uint256 i = 0; i < agent.capabilities.length; i++) {
            if (keccak256(bytes(agent.capabilities[i])) == keccak256(bytes(action))) {
                hasCapability = true;
                break;
            }
        }

        if (!hasCapability) {
            emit CapabilityViolation(agentAddress, action, agent.capabilityHash);
            revert CapabilityViolationError(agentAddress, action);
        }
    }

    // ===============================================================
    //                   TEE ATTESTATION
    // ===============================================================

    /**
     * @notice Update TEE attestation for an agent
     * @param agentAddress The agent whose attestation to update
     * @param newAttestationHash New hardware attestation hash from TEE
     */
    function updateAttestation(
        address agentAddress,
        bytes32 newAttestationHash
    ) external onlyAgentOwner(agentAddress) onlyActiveAgent(agentAddress) {
        Agent storage agent = agents[agentAddress];
        bytes32 oldHash = agent.attestationHash;

        agent.attestationHash = newAttestationHash;
        agent.attestationTime = block.timestamp;

        emit AttestationUpdated(agentAddress, oldHash, newAttestationHash, block.timestamp);
    }

    /**
     * @notice Verify that an agent's attestation is valid and recent
     * @param agentAddress The agent to verify
     * @param expectedHash The expected attestation hash
     * @return valid Whether attestation matches and is recent (within 1 hour)
     */
    function verifyAttestation(
        address agentAddress,
        bytes32 expectedHash
    ) external view agentExists(agentAddress) returns (bool valid) {
        Agent storage agent = agents[agentAddress];
        
        // Check hash matches
        if (agent.attestationHash != expectedHash) {
            return false;
        }

        // Check attestation is recent (within 1 hour)
        if (block.timestamp - agent.attestationTime > 1 hours) {
            return false;
        }

        return true;
    }

    // ===============================================================
    //                   CIRCUIT BREAKER
    // ===============================================================

    /**
     * @notice Fire the circuit breaker -- freeze agent wallet immediately
     * @dev This is THE kill switch. Called when TEE attestation fails.
     * @param agentAddress The compromised agent
     * @param reason Why the circuit breaker was fired
     * @param invalidAttestationHash The invalid attestation that triggered this
     */
    function fireCircuitBreaker(
        address agentAddress,
        string calldata reason,
        bytes32 invalidAttestationHash
    ) external agentExists(agentAddress) {
        // Can be called by admin or agent owner
        if (msg.sender != admin && msg.sender != agents[agentAddress].owner) {
            revert UnauthorizedCircuitBreaker();
        }

        Agent storage agent = agents[agentAddress];
        AgentStatus oldStatus = agent.status;

        // FREEZE EVERYTHING
        agent.status = AgentStatus.Frozen;

        // Log the event
        circuitBreakerEvents[agentAddress].push(CircuitBreakerEvent({
            timestamp: block.timestamp,
            reason: reason,
            oldAttestationHash: agent.attestationHash,
            newAttestationHash: invalidAttestationHash
        }));

        totalCircuitBreakerEvents++;

        // Update reputation (severe penalty)
        uint256 oldReputation = agent.reputationScore;
        agent.reputationScore = agent.reputationScore > 20 ? agent.reputationScore - 20 : 0;

        emit CircuitBreakerFired(agentAddress, reason, invalidAttestationHash, block.timestamp);
        emit WalletFrozen(agentAddress, reason, block.timestamp);
        emit AgentStatusChanged(agentAddress, oldStatus, AgentStatus.Frozen);
        emit ReputationUpdated(agentAddress, oldReputation, agent.reputationScore);
    }

    /**
     * @notice Unfreeze an agent after security review
     * @param agentAddress The agent to unfreeze
     * @param newAttestationHash Fresh attestation from re-validated TEE
     */
    function unfreezeAgent(
        address agentAddress,
        bytes32 newAttestationHash
    ) external onlyAgentOwner(agentAddress) {
        Agent storage agent = agents[agentAddress];
        if (agent.status != AgentStatus.Frozen) revert AgentNotFrozen();

        agent.status = AgentStatus.Active;
        agent.attestationHash = newAttestationHash;
        agent.attestationTime = block.timestamp;

        emit WalletUnfrozen(agentAddress, block.timestamp);
        emit AgentStatusChanged(agentAddress, AgentStatus.Frozen, AgentStatus.Active);
    }

    // ===============================================================
    //                   SPENDING CONTROLS
    // ===============================================================

    /**
     * @notice Check and record a spending transaction
     * @param agentAddress The agent spending
     * @param amount Amount being spent (wei)
     * @param recipient Who receives the funds
     * @return approved Whether the transaction is approved
     */
    function processTransaction(
        address agentAddress,
        uint256 amount,
        address recipient
    ) external onlyActiveAgent(agentAddress) returns (bool approved) {
        Agent storage agent = agents[agentAddress];
        SpendingPolicy storage policy = spendingPolicies[agentAddress];

        // Reset daily counter if needed
        if (block.timestamp - agent.lastSpendReset >= 1 days) {
            agent.dailySpent = 0;
            agent.lastSpendReset = block.timestamp;
        }

        // Check per-transaction limit
        if (amount > policy.maxPerTransaction) {
            revert ExceedsPerTxLimit(amount, policy.maxPerTransaction);
        }

        // Check daily limit
        if (agent.dailySpent + amount > policy.maxPerDay) {
            revert ExceedsDailyLimit(agent.dailySpent + amount, policy.maxPerDay);
        }

        // Check verified recipient requirement
        if (policy.onlyVerifiedRecipients && !verifiedAgents[recipient]) {
            revert RecipientNotVerified(recipient);
        }

        // Record the spend
        agent.dailySpent += amount;

        // Emit alert if above threshold
        if (amount >= policy.alertThreshold) {
            emit SpendingAlert(agentAddress, amount, policy.alertThreshold);
        }

        // Increase reputation for successful transaction
        if (agent.reputationScore < 100) {
            agent.reputationScore++;
            emit ReputationUpdated(agentAddress, agent.reputationScore - 1, agent.reputationScore);
        }

        return true;
    }

    /**
     * @notice Update spending policy for an agent
     */
    function updateSpendingPolicy(
        address agentAddress,
        uint256 maxPerTx,
        uint256 maxPerDay,
        uint256 alertThreshold,
        bool onlyVerified
    ) external onlyAgentOwner(agentAddress) {
        spendingPolicies[agentAddress] = SpendingPolicy({
            maxPerTransaction: maxPerTx,
            maxPerDay: maxPerDay,
            alertThreshold: alertThreshold,
            onlyVerifiedRecipients: onlyVerified
        });

        emit SpendingPolicySet(agentAddress, maxPerTx, maxPerDay, alertThreshold);
    }

    // ===============================================================
    //                   ZK COMPLIANCE PROOFS
    // ===============================================================

    /**
     * @notice Post a ZK compliance proof for an agent action
     * @param agentAddress The agent this proof is for
     * @param proofHash Hash of the ZK proof
     * @param proofType Type of compliance being proved
     * @param verified Whether the proof was verified off-chain
     */
    function postComplianceProof(
        address agentAddress,
        bytes32 proofHash,
        string calldata proofType,
        bool verified
    ) external agentExists(agentAddress) {
        complianceProofs[agentAddress].push(ComplianceProof({
            proofHash: proofHash,
            timestamp: block.timestamp,
            verified: verified,
            proofType: proofType
        }));

        emit ComplianceProofPosted(agentAddress, proofHash, proofType, verified);
    }

    /**
     * @notice Query compliance status -- returns YES/NO only (privacy preserving)
     * @param agentAddress The agent to query
     * @return compliant Whether all recent proofs are verified
     * @return totalProofs Number of compliance proofs on record
     */
    function queryCompliance(
        address agentAddress
    ) external view agentExists(agentAddress) returns (bool compliant, uint256 totalProofs) {
        ComplianceProof[] storage proofs = complianceProofs[agentAddress];
        totalProofs = proofs.length;

        if (totalProofs == 0) {
            return (false, 0);
        }

        // Check last 10 proofs (or all if less than 10)
        uint256 startIdx = totalProofs > 10 ? totalProofs - 10 : 0;
        compliant = true;

        for (uint256 i = startIdx; i < totalProofs; i++) {
            if (!proofs[i].verified) {
                compliant = false;
                break;
            }
        }

        return (compliant, totalProofs);
    }

    // ===============================================================
    //                   VIEW FUNCTIONS
    // ===============================================================

    /**
     * @notice Get full agent profile
     */
    function getAgent(address agentAddress) external view returns (
        address owner,
        string memory ensName,
        bytes32 capabilityHash,
        string[] memory capabilities,
        uint256 reputationScore,
        AgentStatus status,
        bytes32 attestationHash,
        uint256 attestationTime,
        uint256 registeredAt
    ) {
        Agent storage agent = agents[agentAddress];
        return (
            agent.owner,
            agent.ensName,
            agent.capabilityHash,
            agent.capabilities,
            agent.reputationScore,
            agent.status,
            agent.attestationHash,
            agent.attestationTime,
            agent.registeredAt
        );
    }

    /**
     * @notice Get agent's spending info
     */
    function getSpendingInfo(address agentAddress) external view returns (
        uint256 dailySpent,
        uint256 maxPerTransaction,
        uint256 maxPerDay,
        uint256 alertThreshold,
        bool onlyVerifiedRecipients
    ) {
        Agent storage agent = agents[agentAddress];
        SpendingPolicy storage policy = spendingPolicies[agentAddress];
        return (
            agent.dailySpent,
            policy.maxPerTransaction,
            policy.maxPerDay,
            policy.alertThreshold,
            policy.onlyVerifiedRecipients
        );
    }

    /**
     * @notice Get circuit breaker history for an agent
     */
    function getCircuitBreakerHistory(
        address agentAddress
    ) external view returns (CircuitBreakerEvent[] memory) {
        return circuitBreakerEvents[agentAddress];
    }

    /**
     * @notice Get all registered agent addresses
     */
    function getAllAgents() external view returns (address[] memory) {
        return agentAddresses;
    }

    /**
     * @notice Check if an address is a verified agent
     */
    function isVerifiedAgent(address agentAddress) external view returns (bool) {
        return verifiedAgents[agentAddress];
    }

    /**
     * @notice Get agent status as string for frontend display
     */
    function getAgentStatusString(address agentAddress) external view returns (string memory) {
        AgentStatus status = agents[agentAddress].status;
        if (status == AgentStatus.Active) return "ACTIVE";
        if (status == AgentStatus.Frozen) return "FROZEN";
        if (status == AgentStatus.Suspended) return "SUSPENDED";
        return "INACTIVE";
    }

    // ===============================================================
    //                   ADMIN FUNCTIONS
    // ===============================================================

    /**
     * @notice Add an address to verified agents whitelist
     */
    function addVerifiedAgent(address agentAddress) external onlyAdmin {
        verifiedAgents[agentAddress] = true;
    }

    /**
     * @notice Remove an address from verified agents whitelist
     */
    function removeVerifiedAgent(address agentAddress) external onlyAdmin {
        verifiedAgents[agentAddress] = false;
    }

    /**
     * @notice Emergency freeze all agents (nuclear option)
     */
    function emergencyFreezeAll() external onlyAdmin {
        for (uint256 i = 0; i < agentAddresses.length; i++) {
            if (agents[agentAddresses[i]].status == AgentStatus.Active) {
                agents[agentAddresses[i]].status = AgentStatus.Frozen;
                emit WalletFrozen(agentAddresses[i], "Emergency freeze all", block.timestamp);
            }
        }
    }

    /**
     * @notice Transfer admin role
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        admin = newAdmin;
    }

    // ===============================================================
    //                   INTERNAL FUNCTIONS
    // ===============================================================

    /**
     * @notice Generate capability hash from list of capabilities
     */
    function _generateCapabilityHash(
        string[] calldata capabilities
    ) internal pure returns (bytes32) {
        bytes memory packed;
        for (uint256 i = 0; i < capabilities.length; i++) {
            packed = abi.encodePacked(packed, capabilities[i]);
        }
        return keccak256(packed);
    }
}
