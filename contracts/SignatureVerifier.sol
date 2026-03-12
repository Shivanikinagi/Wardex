// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SignatureVerifier — ECDSA signature verification for ENS ownership proofs
 * @notice Proves that an agent's action was authorized by its ENS record owner.
 *         Uses EIP-712 typed structured data for secure signature verification.
 *
 * Flow:
 *   1. ENS owner signs a structured message: "I authorize <agent> to <action>"
 *   2. Agent submits signature + action to this contract
 *   3. Contract recovers signer via ecrecover and verifies against ENS owner
 *   4. If signer matches ENS owner → action authorized
 *
 * Prevents unauthorized agents from claiming ENS-linked permissions.
 */

interface IDarkAgentRegistry {
    function getAgent(address agentAddress) external view returns (
        address owner, string memory ensName, bytes32 capabilityHash,
        string[] memory capabilities, uint256 reputationScore, uint8 status,
        bytes32 attestationHash, uint256 attestationTime, uint256 registeredAt
    );
}

contract SignatureVerifier {
    // ═══════════════════════════════════════════════════════════════
    //                        ERRORS
    // ═══════════════════════════════════════════════════════════════

    error InvalidSignature();
    error SignatureExpired();
    error NonceAlreadyUsed();
    error NotAdmin();
    error AgentNotRegistered();
    error SignerNotOwner(address signer, address owner);

    // ═══════════════════════════════════════════════════════════════
    //                        STRUCTS
    // ═══════════════════════════════════════════════════════════════

    struct Authorization {
        address agent;          // Agent being authorized
        string action;          // Action being authorized (e.g., "yield-farming")
        uint256 nonce;          // Replay protection
        uint256 deadline;       // Signature expiry timestamp
        bytes signature;        // ECDSA signature from ENS owner
        address recoveredSigner;
        bool verified;
        uint256 verifiedAt;
    }

    struct VerificationStats {
        uint256 totalVerified;
        uint256 totalFailed;
        uint256 totalExpired;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   EIP-712 CONSTANTS
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public constant AUTHORIZATION_TYPEHASH = keccak256(
        "Authorization(address agent,string action,uint256 nonce,uint256 deadline)"
    );

    // ═══════════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════════

    address public admin;
    IDarkAgentRegistry public registry;
    bytes32 public immutable DOMAIN_SEPARATOR;

    mapping(address => mapping(uint256 => bool)) public usedNonces;
    mapping(bytes32 => Authorization) public authorizations;
    mapping(address => bytes32[]) public agentAuthorizations;
    VerificationStats public stats;

    // ═══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ═══════════════════════════════════════════════════════════════

    event AuthorizationVerified(
        address indexed agent,
        address indexed signer,
        string action,
        uint256 nonce,
        bytes32 authId
    );

    event AuthorizationFailed(
        address indexed agent,
        address recoveredSigner,
        address expectedOwner,
        string reason
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

        DOMAIN_SEPARATOR = keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256("DarkAgent"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }

    // ═══════════════════════════════════════════════════════════════
    //                     CORE VERIFICATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Verify that an action was authorized by the agent's ENS owner
     * @param agent Agent address
     * @param action Action being authorized
     * @param nonce Unique nonce for replay protection
     * @param deadline Signature expiry timestamp
     * @param signature ECDSA signature (65 bytes: r + s + v)
     * @return verified Whether the signature is valid and signer matches ENS owner
     */
    function verifyAuthorization(
        address agent,
        string calldata action,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external returns (bool verified) {
        // Check deadline
        if (block.timestamp > deadline) {
            stats.totalExpired++;
            emit AuthorizationFailed(agent, address(0), address(0), "expired");
            revert SignatureExpired();
        }

        // Check nonce hasn't been used
        if (usedNonces[agent][nonce]) revert NonceAlreadyUsed();
        usedNonces[agent][nonce] = true;

        // Get the agent's owner from registry
        (address owner, , , , , uint8 status, , ,) = registry.getAgent(agent);
        if (status == 0) revert AgentNotRegistered();

        // Build EIP-712 digest
        bytes32 structHash = keccak256(abi.encode(
            AUTHORIZATION_TYPEHASH,
            agent,
            keccak256(bytes(action)),
            nonce,
            deadline
        ));

        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            structHash
        ));

        // Recover signer
        address signer = _recoverSigner(digest, signature);

        // Generate authorization ID
        bytes32 authId = keccak256(abi.encodePacked(agent, action, nonce));

        // Verify signer matches owner
        if (signer != owner) {
            stats.totalFailed++;
            emit AuthorizationFailed(agent, signer, owner, "signer_mismatch");
            revert SignerNotOwner(signer, owner);
        }

        // Store authorization
        authorizations[authId] = Authorization({
            agent: agent,
            action: action,
            nonce: nonce,
            deadline: deadline,
            signature: signature,
            recoveredSigner: signer,
            verified: true,
            verifiedAt: block.timestamp
        });

        agentAuthorizations[agent].push(authId);
        stats.totalVerified++;

        emit AuthorizationVerified(agent, signer, action, nonce, authId);
        return true;
    }

    /**
     * @notice Check if a specific authorization exists and is valid
     */
    function isAuthorized(
        address agent,
        string calldata action,
        uint256 nonce
    ) external view returns (bool) {
        bytes32 authId = keccak256(abi.encodePacked(agent, action, nonce));
        return authorizations[authId].verified;
    }

    // ═══════════════════════════════════════════════════════════════
    //                     VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function getAuthorization(bytes32 authId) external view returns (Authorization memory) {
        return authorizations[authId];
    }

    function getAgentAuthorizations(address agent) external view returns (bytes32[] memory) {
        return agentAuthorizations[agent];
    }

    function getStats() external view returns (
        uint256 totalVerified,
        uint256 totalFailed,
        uint256 totalExpired
    ) {
        return (stats.totalVerified, stats.totalFailed, stats.totalExpired);
    }

    // ═══════════════════════════════════════════════════════════════
    //                     INTERNAL
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Recover signer from ECDSA signature
     * @dev Splits 65-byte signature into (r, s, v) and calls ecrecover
     */
    function _recoverSigner(
        bytes32 digest,
        bytes memory signature
    ) internal pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        // EIP-2: Ensure s is in the lower half of the curve order
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignature();
        }

        if (v != 27 && v != 28) revert InvalidSignature();

        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();

        return signer;
    }

    // ═══════════════════════════════════════════════════════════════
    //                     ADMIN
    // ═══════════════════════════════════════════════════════════════

    function updateRegistry(address _newRegistry) external onlyAdmin {
        registry = IDarkAgentRegistry(_newRegistry);
    }
}
