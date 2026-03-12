/**
 * DarkAgent SDK — Policy Management
 * ====================================
 * Manages spending policies, circuit breaker operations,
 * and compliance verification for AI agents.
 *
 * Key features:
 *   - Set/update spending policies
 *   - Fire circuit breaker (freeze wallet)
 *   - Unfreeze after security review
 *   - Submit ZK compliance proofs
 *   - Query compliance status
 */

const { ethers } = require("ethers");

// Contract ABIs
const DARKAGENT_ABI = [
    "function updateSpendingPolicy(address agentAddress, uint256 maxPerTx, uint256 maxPerDay, uint256 alertThreshold, bool onlyVerified) external",
    "function processTransaction(address agentAddress, uint256 amount, address recipient) external returns (bool)",
    "function fireCircuitBreaker(address agentAddress, string reason, bytes32 invalidAttestationHash) external",
    "function unfreezeAgent(address agentAddress, bytes32 newAttestationHash) external",
    "function getSpendingInfo(address agentAddress) external view returns (uint256 dailySpent, uint256 maxPerTransaction, uint256 maxPerDay, uint256 alertThreshold, bool onlyVerifiedRecipients)",
    "function getCircuitBreakerHistory(address agentAddress) external view returns (tuple(uint256 timestamp, string reason, bytes32 oldAttestationHash, bytes32 newAttestationHash)[])",
    "function getAgentStatusString(address agentAddress) external view returns (string)",
    "function postComplianceProof(address agentAddress, bytes32 proofHash, string proofType, bool verified) external",
    "function queryCompliance(address agentAddress) external view returns (bool compliant, uint256 totalProofs)",
    "event CircuitBreakerFired(address indexed agentAddress, string reason, bytes32 attestationHash, uint256 timestamp)",
    "event WalletFrozen(address indexed agentAddress, string reason, uint256 timestamp)",
    "event SpendingAlert(address indexed agentAddress, uint256 amount, uint256 threshold)",
];

const VERIFIER_ABI = [
    "function submitAndVerifyProof(address agent, bytes proofData, string proofType, uint256[2] publicInputs) external returns (bool)",
    "function queryCompliance(address agent) external returns (bool compliant, uint256 totalProofs)",
    "function getComplianceStatus(address agent) external view returns (tuple(bool isCompliant, uint256 totalProofs, uint256 verifiedProofs, uint256 failedProofs, uint256 lastProofTime, string lastProofType))",
    "function getStats() external view returns (uint256 totalVerified, uint256 totalFailed, uint256 verificationRate)",
];

const DEFAULT_CONFIG = {
    rpcUrl: "https://sepolia.base.org",
    chainId: 84532,
    darkAgentAddress: process.env.DARKAGENT_CONTRACT || "",
    verifierAddress: process.env.VERIFIER_CONTRACT || "",
};

// ═══════════════════════════════════════════════════════════════
// SPENDING POLICY MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Update spending policy for an agent
 */
async function updateSpendingPolicy({
    agentAddress,
    maxPerTransaction,
    maxPerDay,
    alertThreshold,
    onlyVerifiedRecipients = true,
    privateKey,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const darkAgent = new ethers.Contract(
        cfg.darkAgentAddress,
        DARKAGENT_ABI,
        signer
    );

    console.log(`📝 Updating spending policy for ${agentAddress.slice(0, 10)}...`);

    const tx = await darkAgent.updateSpendingPolicy(
        agentAddress,
        ethers.parseEther(maxPerTransaction),
        ethers.parseEther(maxPerDay),
        ethers.parseEther(alertThreshold),
        onlyVerifiedRecipients
    );

    const receipt = await tx.wait();

    console.log(`✅ Policy updated in block ${receipt.blockNumber}`);

    return {
        success: true,
        txHash: tx.hash,
        policy: {
            maxPerTransaction,
            maxPerDay,
            alertThreshold,
            onlyVerifiedRecipients,
        },
    };
}

/**
 * Get current spending info
 */
async function getSpendingInfo(agentAddress, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const darkAgent = new ethers.Contract(
        cfg.darkAgentAddress,
        DARKAGENT_ABI,
        provider
    );

    const info = await darkAgent.getSpendingInfo(agentAddress);

    return {
        dailySpent: ethers.formatEther(info[0]),
        maxPerTransaction: ethers.formatEther(info[1]),
        maxPerDay: ethers.formatEther(info[2]),
        alertThreshold: ethers.formatEther(info[3]),
        onlyVerifiedRecipients: info[4],
    };
}

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════

/**
 * 🚨 Fire the circuit breaker — freeze agent wallet immediately
 * This is the kill switch used in the demo.
 */
async function fireCircuitBreaker({
    agentAddress,
    reason,
    invalidAttestationHash,
    privateKey,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const darkAgent = new ethers.Contract(
        cfg.darkAgentAddress,
        DARKAGENT_ABI,
        signer
    );

    console.log("\n🚨 ═══════════════════════════════════════════════ 🚨");
    console.log("   FIRING CIRCUIT BREAKER");
    console.log("🚨 ═══════════════════════════════════════════════ 🚨");
    console.log(`   Agent: ${agentAddress.slice(0, 10)}...`);
    console.log(`   Reason: ${reason}`);

    const tx = await darkAgent.fireCircuitBreaker(
        agentAddress,
        reason,
        invalidAttestationHash ||
        ethers.keccak256(ethers.toUtf8Bytes("TAMPERED"))
    );

    const receipt = await tx.wait();

    console.log("\n   ❄️  Wallet: FROZEN");
    console.log("   🛑 Agent:  SUSPENDED");
    console.log("   💰 Funds:  SAFE");
    console.log(`   📋 TX: ${tx.hash}`);
    console.log(`   📦 Block: ${receipt.blockNumber}`);
    console.log("\n🚨 ═══════════════════════════════════════════════ 🚨\n");

    return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        agentAddress,
        reason,
        frozenAt: new Date().toISOString(),
    };
}

/**
 * Unfreeze an agent after security review
 */
async function unfreezeAgent({
    agentAddress,
    newAttestationHash,
    privateKey,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const darkAgent = new ethers.Contract(
        cfg.darkAgentAddress,
        DARKAGENT_ABI,
        signer
    );

    console.log(`🔓 Unfreezing agent ${agentAddress.slice(0, 10)}...`);

    const tx = await darkAgent.unfreezeAgent(agentAddress, newAttestationHash);
    const receipt = await tx.wait();

    console.log(`✅ Agent unfrozen in block ${receipt.blockNumber}`);

    return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
    };
}

/**
 * Get circuit breaker history
 */
async function getCircuitBreakerHistory(agentAddress, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const darkAgent = new ethers.Contract(
        cfg.darkAgentAddress,
        DARKAGENT_ABI,
        provider
    );

    const events = await darkAgent.getCircuitBreakerHistory(agentAddress);

    return events.map((event) => ({
        timestamp: Number(event.timestamp),
        reason: event.reason,
        oldAttestationHash: event.oldAttestationHash,
        newAttestationHash: event.newAttestationHash,
        date: new Date(Number(event.timestamp) * 1000).toISOString(),
    }));
}

// ═══════════════════════════════════════════════════════════════
// ZK COMPLIANCE
// ═══════════════════════════════════════════════════════════════

/**
 * Submit a ZK compliance proof
 */
async function submitComplianceProof({
    agentAddress,
    proofData,
    proofType,
    publicInputs,
    privateKey,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    const verifier = new ethers.Contract(
        cfg.verifierAddress,
        VERIFIER_ABI,
        signer
    );

    console.log(`📜 Submitting ${proofType} proof for ${agentAddress.slice(0, 10)}...`);

    const tx = await verifier.submitAndVerifyProof(
        agentAddress,
        proofData || ethers.toUtf8Bytes("darkagent-compliance-proof"),
        proofType,
        publicInputs || [0, 0]
    );

    const receipt = await tx.wait();

    console.log(`✅ Proof verified in block ${receipt.blockNumber}`);

    return {
        success: true,
        txHash: tx.hash,
        proofType,
        blockNumber: receipt.blockNumber,
    };
}

/**
 * Query compliance status (privacy preserving — YES/NO only)
 */
async function queryCompliance(agentAddress, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const verifier = new ethers.Contract(
        cfg.verifierAddress,
        VERIFIER_ABI,
        provider
    );

    const status = await verifier.getComplianceStatus(agentAddress);

    return {
        compliant: status.isCompliant,
        answer: status.isCompliant ? "YES" : "NO",
        totalProofs: Number(status.totalProofs),
        verifiedProofs: Number(status.verifiedProofs),
        failedProofs: Number(status.failedProofs),
        lastProofTime: Number(status.lastProofTime),
        lastProofType: status.lastProofType,
    };
}

/**
 * Get overall verifier statistics
 */
async function getVerifierStats(config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const verifier = new ethers.Contract(
        cfg.verifierAddress,
        VERIFIER_ABI,
        provider
    );

    const stats = await verifier.getStats();

    return {
        totalVerified: Number(stats[0]),
        totalFailed: Number(stats[1]),
        verificationRate: Number(stats[2]),
    };
}

// ═══════════════════════════════════════════════════════════════
// AGENT STATUS
// ═══════════════════════════════════════════════════════════════

/**
 * Get agent status string
 */
async function getAgentStatus(agentAddress, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const darkAgent = new ethers.Contract(
        cfg.darkAgentAddress,
        DARKAGENT_ABI,
        provider
    );

    return await darkAgent.getAgentStatusString(agentAddress);
}

module.exports = {
    updateSpendingPolicy,
    getSpendingInfo,
    fireCircuitBreaker,
    unfreezeAgent,
    getCircuitBreakerHistory,
    submitComplianceProof,
    queryCompliance,
    getVerifierStats,
    getAgentStatus,
    DARKAGENT_ABI,
    VERIFIER_ABI,
    DEFAULT_CONFIG,
};
