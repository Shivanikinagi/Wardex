// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Verifier - ZK Compliance Proof Verifier
 * @notice Verifies ZK proofs submitted by AI agents for compliance.
 *         Provides privacy-preserving audit: YES/NO answers only.
 *
 * @dev Supports verification of Noir-generated proofs.
 *      In production, this would use a real ZK verifier (e.g., UltraPlonk).
 *      For the hackathon, we simulate proof verification while maintaining
 *      the correct interface and data flow.
 *
 * Proof types supported:
 *   - spending_limit:      Proves transaction was within spending limits
 *   - whitelist:           Proves agent only contacted whitelisted agents
 *   - sanctions:           Proves no sanctioned entities were involved
 *   - attestation:         Proves TEE attestation was valid at time of action
 *   - ens_rule_compliance: Proves transaction followed ENS-defined rules without revealing the rules
 *   - slippage_check:      Proves swap slippage was within ENS-defined tolerance
 *   - signature_auth:      Proves action was authorized by ENS owner signature
 */
contract Verifier {
    // ===============================================================
    //                       CUSTOM ERRORS
    // ===============================================================

    error NotAdmin();
    error InvalidProofType(string proofType);
    error ProofAlreadySubmitted(bytes32 proofHash);
    error ArrayLengthMismatch();

    // ===============================================================
    //                          STRUCTS
    // ===============================================================

    /// @notice A submitted proof with verification result
    struct Proof {
        address agent;           // Which agent submitted this
        bytes32 proofHash;       // Hash of the proof data
        string proofType;        // Type of compliance proof
        uint256[2] publicInputs; // Public inputs to the proof
        bool verified;           // Verification result
        uint256 timestamp;       // When it was verified
        uint256 blockNumber;     // Block at verification time
    }

    /// @notice Aggregated compliance status for an agent
    struct ComplianceStatus {
        bool isCompliant;          // Overall compliance status
        uint256 totalProofs;       // Number of proofs submitted
        uint256 verifiedProofs;    // Number of verified proofs
        uint256 failedProofs;      // Number of failed proofs
        uint256 lastProofTime;     // Most recent proof timestamp
        string lastProofType;      // Most recent proof type
    }

    // ===============================================================
    //                        STATE VARIABLES
    // ===============================================================

    address public admin;
    address public darkAgentRegistry;

    /// @notice Agent -> list of proofs
    mapping(address => Proof[]) public agentProofs;

    /// @notice Agent -> compliance status
    mapping(address => ComplianceStatus) public complianceStatuses;

    /// @notice Proof hash -> whether it exists (prevent replay)
    mapping(bytes32 => bool) public proofExists;

    /// @notice Valid proof types
    mapping(string => bool) public validProofTypes;

    /// @notice Total proofs verified across all agents
    uint256 public totalProofsVerified;

    /// @notice Total proofs failed across all agents
    uint256 public totalProofsFailed;

    // ===============================================================
    //                          EVENTS
    // ===============================================================

    event ProofSubmitted(
        address indexed agent,
        bytes32 indexed proofHash,
        string proofType,
        uint256 timestamp
    );

    event ProofVerified(
        address indexed agent,
        bytes32 indexed proofHash,
        bool result,
        uint256 timestamp
    );

    event ComplianceQueried(
        address indexed agent,
        bool isCompliant,
        uint256 totalProofs,
        uint256 timestamp
    );

    event ProofTypeRegistered(string proofType);

    // ===============================================================
    //                        MODIFIERS
    // ===============================================================

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ===============================================================
    //                       CONSTRUCTOR
    // ===============================================================

    constructor(address _darkAgentRegistry) {
        admin = msg.sender;
        darkAgentRegistry = _darkAgentRegistry;

        // Register default proof types
        validProofTypes["spending_limit"] = true;
        validProofTypes["whitelist"] = true;
        validProofTypes["sanctions"] = true;
        validProofTypes["attestation"] = true;
        validProofTypes["ens_rule_compliance"] = true;
        validProofTypes["slippage_check"] = true;
        validProofTypes["signature_auth"] = true;

        emit ProofTypeRegistered("spending_limit");
        emit ProofTypeRegistered("whitelist");
        emit ProofTypeRegistered("sanctions");
        emit ProofTypeRegistered("attestation");
        emit ProofTypeRegistered("ens_rule_compliance");
        emit ProofTypeRegistered("slippage_check");
        emit ProofTypeRegistered("signature_auth");
    }

    // ===============================================================
    //                   PROOF SUBMISSION & VERIFICATION
    // ===============================================================

    /**
     * @notice Submit and verify a ZK compliance proof
     * @dev In production, this would call a real ZK verifier.
     *      For the hackathon, we verify the proof structure and hash.
     * @param agent The agent this proof is for
     * @param proofData The raw proof data (would be Noir proof bytes in production)
     * @param proofType Type of compliance being proved
     * @param publicInputs Public inputs to the ZK proof
     * @return verified Whether the proof was verified successfully
     */
    function submitAndVerifyProof(
        address agent,
        bytes calldata proofData,
        string calldata proofType,
        uint256[2] calldata publicInputs
    ) external returns (bool verified) {
        if (!validProofTypes[proofType]) revert InvalidProofType(proofType);

        bytes32 proofHash = keccak256(abi.encodePacked(
            agent,
            proofData,
            proofType,
            publicInputs[0],
            publicInputs[1],
            block.timestamp
        ));

        if (proofExists[proofHash]) revert ProofAlreadySubmitted(proofHash);

        emit ProofSubmitted(agent, proofHash, proofType, block.timestamp);

        // =======================================================
        // PROOF VERIFICATION LOGIC
        // In production: call UltraPlonk/Groth16 verifier
        // For hackathon: verify proof structure and constraints
        // =======================================================

        verified = _verifyProof(proofData, proofType, publicInputs);

        // Store the proof
        agentProofs[agent].push(Proof({
            agent: agent,
            proofHash: proofHash,
            proofType: proofType,
            publicInputs: publicInputs,
            verified: verified,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));

        proofExists[proofHash] = true;

        // Update compliance status
        ComplianceStatus storage status = complianceStatuses[agent];
        status.totalProofs++;
        status.lastProofTime = block.timestamp;
        status.lastProofType = proofType;

        if (verified) {
            status.verifiedProofs++;
            totalProofsVerified++;
        } else {
            status.failedProofs++;
            totalProofsFailed++;
        }

        // Recalculate overall compliance
        status.isCompliant = (status.failedProofs == 0) || 
            (status.verifiedProofs * 100 / status.totalProofs >= 95); // 95% threshold

        emit ProofVerified(agent, proofHash, verified, block.timestamp);

        return verified;
    }

    /**
     * @notice Batch submit multiple proofs
     */
    function batchSubmitProofs(
        address agent,
        bytes[] calldata proofDatas,
        string[] calldata proofTypes,
        uint256[2][] calldata publicInputsArray
    ) external returns (bool[] memory results) {
        if (
            proofDatas.length != proofTypes.length || 
            proofTypes.length != publicInputsArray.length
        ) revert ArrayLengthMismatch();

        results = new bool[](proofDatas.length);

        for (uint256 i = 0; i < proofDatas.length; i++) {
            bytes32 proofHash = keccak256(abi.encodePacked(
                agent, proofDatas[i], proofTypes[i],
                publicInputsArray[i][0], publicInputsArray[i][1],
                block.timestamp
            ));

            if (proofExists[proofHash] || !validProofTypes[proofTypes[i]]) {
                results[i] = false;
                continue;
            }

            bool verified = _verifyProof(proofDatas[i], proofTypes[i], publicInputsArray[i]);

            agentProofs[agent].push(Proof({
                agent: agent,
                proofHash: proofHash,
                proofType: proofTypes[i],
                publicInputs: publicInputsArray[i],
                verified: verified,
                timestamp: block.timestamp,
                blockNumber: block.number
            }));

            proofExists[proofHash] = true;
            results[i] = verified;

            ComplianceStatus storage status = complianceStatuses[agent];
            status.totalProofs++;
            if (verified) {
                status.verifiedProofs++;
                totalProofsVerified++;
            } else {
                status.failedProofs++;
                totalProofsFailed++;
            }

            emit ProofVerified(agent, proofHash, verified, block.timestamp);
        }

        return results;
    }

    // ===============================================================
    //                   COMPLIANCE QUERIES
    // ===============================================================

    /**
     * @notice Query compliance status -- privacy preserving
     * @dev Returns YES/NO only. No transaction data revealed.
     *      This is what the regulator calls.
     * @param agent The agent to query
     * @return compliant YES or NO
     * @return totalProofs Number of proofs on record
     */
    function queryCompliance(
        address agent
    ) external returns (bool compliant, uint256 totalProofs) {
        ComplianceStatus storage status = complianceStatuses[agent];

        emit ComplianceQueried(agent, status.isCompliant, status.totalProofs, block.timestamp);

        return (status.isCompliant, status.totalProofs);
    }

    /**
     * @notice Get compliance status (view only, no event)
     */
    function getComplianceStatus(
        address agent
    ) external view returns (ComplianceStatus memory) {
        return complianceStatuses[agent];
    }

    /**
     * @notice Get proofs for a specific agent and type
     */
    function getProofsByType(
        address agent,
        string calldata proofType
    ) external view returns (Proof[] memory) {
        Proof[] storage allProofs = agentProofs[agent];
        
        // First pass: count matching proofs
        uint256 count = 0;
        for (uint256 i = 0; i < allProofs.length; i++) {
            if (keccak256(bytes(allProofs[i].proofType)) == keccak256(bytes(proofType))) {
                count++;
            }
        }

        // Second pass: collect matching proofs
        Proof[] memory result = new Proof[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allProofs.length; i++) {
            if (keccak256(bytes(allProofs[i].proofType)) == keccak256(bytes(proofType))) {
                result[idx] = allProofs[i];
                idx++;
            }
        }

        return result;
    }

    /**
     * @notice Get all proofs for an agent
     */
    function getAllProofs(address agent) external view returns (Proof[] memory) {
        return agentProofs[agent];
    }

    /**
     * @notice Get verification statistics
     */
    function getStats() external view returns (
        uint256 totalVerified,
        uint256 totalFailed,
        uint256 verificationRate
    ) {
        totalVerified = totalProofsVerified;
        totalFailed = totalProofsFailed;
        
        uint256 total = totalVerified + totalFailed;
        verificationRate = total > 0 ? (totalVerified * 100) / total : 0;
    }

    // ===============================================================
    //                   ADMIN FUNCTIONS
    // ===============================================================

    /**
     * @notice Register a new proof type
     */
    function registerProofType(string calldata proofType) external onlyAdmin {
        validProofTypes[proofType] = true;
        emit ProofTypeRegistered(proofType);
    }

    /**
     * @notice Update the DarkAgent registry address
     */
    function updateRegistry(address _newRegistry) external onlyAdmin {
        darkAgentRegistry = _newRegistry;
    }

    // ===============================================================
    //                   INTERNAL VERIFICATION
    // ===============================================================

    /**
     * @notice Internal proof verification logic
     * @dev For hackathon: verifies proof structure and basic constraints.
     *      In production: would call a real ZK verifier contract.
     *
     * Verification rules:
     *   - spending_limit:      publicInputs[0] (spent) <= publicInputs[1] (limit)
     *   - whitelist:           publicInputs[0] must be non-zero (valid whitelist hash)
     *   - sanctions:           publicInputs[0] must be 0 (no sanctions match)
     *   - attestation:         publicInputs[0] must be non-zero (valid attestation)
     *   - ens_rule_compliance: publicInputs[0] (rule hash) != 0, publicInputs[1] (compliant flag) == 1
     *   - slippage_check:      publicInputs[0] (actual bps) <= publicInputs[1] (max bps)
     *   - signature_auth:      publicInputs[0] (sig valid flag) must be 1
     */
    function _verifyProof(
        bytes calldata proofData,
        string calldata proofType,
        uint256[2] calldata publicInputs
    ) internal pure returns (bool) {
        // Proof data must not be empty
        if (proofData.length == 0) return false;

        bytes32 typeHash = keccak256(bytes(proofType));

        // Spending limit: spent amount must be <= limit
        if (typeHash == keccak256("spending_limit")) {
            return publicInputs[0] <= publicInputs[1];
        }

        // Whitelist: must have valid whitelist hash
        if (typeHash == keccak256("whitelist")) {
            return publicInputs[0] != 0;
        }

        // Sanctions: no sanctions match (input should be 0)
        if (typeHash == keccak256("sanctions")) {
            return publicInputs[0] == 0;
        }

        // Attestation: must have valid attestation hash
        if (typeHash == keccak256("attestation")) {
            return publicInputs[0] != 0;
        }

        // ENS Rule Compliance: proves tx followed ENS rules without revealing them
        // publicInputs[0] = hash of the ENS rules (non-zero proves rules exist)
        // publicInputs[1] = 1 if compliant, 0 if not
        if (typeHash == keccak256("ens_rule_compliance")) {
            return publicInputs[0] != 0 && publicInputs[1] == 1;
        }

        // Slippage Check: actual slippage BPS <= max allowed BPS
        if (typeHash == keccak256("slippage_check")) {
            return publicInputs[0] <= publicInputs[1];
        }

        // Signature Auth: ENS owner signature verification
        // publicInputs[0] = 1 if signature is valid
        if (typeHash == keccak256("signature_auth")) {
            return publicInputs[0] == 1;
        }

        return false;
    }
}
