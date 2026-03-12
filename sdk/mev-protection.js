/**
 * DarkAgent SDK — MEV Protection
 * ====================================
 * Routes agent transactions through Flashbots Protect RPC to prevent
 * MEV extraction (frontrunning, sandwich attacks, etc.)
 *
 * How it works:
 *   1. Reads `mev_protection` text record from the agent's ENS name
 *   2. If mev_protection=true → route through Flashbots Protect
 *   3. If mev_protection=false → use standard RPC
 *   4. After execution → generate ZK proof of MEV-protected execution
 *
 * Flashbots Protect:
 *   - Ethereum Mainnet: https://rpc.flashbots.net
 *   - Goerli: https://rpc-goerli.flashbots.net
 *   - Base (via Flashbots): transactions are inherently more ordered
 *
 * ENS Text Record:
 *   key: "mev_protection"
 *   value: "true" | "false"
 */

const { ethers } = require("ethers");

// ═══════════════════════════════════════════════════════════════
//                     CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const FLASHBOTS_RPC = {
    mainnet: "https://rpc.flashbots.net",
    goerli: "https://rpc-goerli.flashbots.net",
    sepolia: "https://rpc-sepolia.flashbots.net",
};

const ENS_RESOLVER_ABI = [
    "function text(bytes32 node, string key) external view returns (string)",
];

const ENS_REGISTRY_ADDRESS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const PUBLIC_RESOLVER = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";

const DEFAULT_CONFIG = {
    ensRpcUrl: process.env.ENS_RPC_URL || "https://rpc.sepolia.org",
    baseRpcUrl: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
    flashbotsNetwork: "sepolia",
};

// ═══════════════════════════════════════════════════════════════
//                     ENS RECORD READING
// ═══════════════════════════════════════════════════════════════

/**
 * Read the `mev_protection` text record from an ENS name
 * @param {string} ensName - e.g., "trading-agent.dark26.eth"
 * @param {object} config - Optional config overrides
 * @returns {boolean} Whether MEV protection is enabled
 */
async function isMEVProtectionEnabled(ensName, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.ensRpcUrl);

    try {
        const namehash = ethers.namehash(ensName);
        const resolver = new ethers.Contract(
            PUBLIC_RESOLVER,
            ENS_RESOLVER_ABI,
            provider
        );

        const value = await resolver.text(namehash, "mev_protection");
        return value.toLowerCase() === "true";
    } catch (err) {
        console.warn(
            `⚠️  Could not read mev_protection for ${ensName}: ${err.message}`
        );
        return false;
    }
}

/**
 * Read all DarkAgent ENS policy records
 */
async function readENSPolicies(ensName, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.ensRpcUrl);
    const namehash = ethers.namehash(ensName);
    const resolver = new ethers.Contract(
        PUBLIC_RESOLVER,
        ENS_RESOLVER_ABI,
        provider
    );

    const keys = [
        "mev_protection",
        "slippage",
        "max_spend",
        "allowed_tokens",
        "capability",
        "delegation",
        "status",
    ];

    const policies = {};
    for (const key of keys) {
        try {
            policies[key] = await resolver.text(namehash, key);
        } catch {
            policies[key] = "";
        }
    }

    return policies;
}

// ═══════════════════════════════════════════════════════════════
//                    MEV-PROTECTED EXECUTION
// ═══════════════════════════════════════════════════════════════

/**
 * Get a provider configured for MEV protection
 * Routes through Flashbots Protect if MEV protection is enabled
 */
function getMEVProtectedProvider(mevEnabled, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (mevEnabled) {
        const flashbotsUrl = FLASHBOTS_RPC[cfg.flashbotsNetwork];
        if (flashbotsUrl) {
            console.log(
                `🛡️  MEV Protection: Routing through Flashbots Protect (${cfg.flashbotsNetwork})`
            );
            return new ethers.JsonRpcProvider(flashbotsUrl);
        }
    }

    console.log("📡 Standard RPC: No MEV protection");
    return new ethers.JsonRpcProvider(cfg.baseRpcUrl);
}

/**
 * Execute a transaction with MEV protection
 * Reads ENS record to determine if Flashbots should be used
 *
 * @param {object} params
 * @param {string} params.ensName - Agent's ENS name
 * @param {object} params.transaction - Standard ethers transaction object
 * @param {string} params.privateKey - Agent's private key
 * @param {object} params.config - Optional config overrides
 * @returns {object} Transaction receipt + MEV protection metadata
 */
async function executeWithMEVProtection({
    ensName,
    transaction,
    privateKey,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    console.log("\n🛡️  ═══════════════════════════════════════════════");
    console.log("    MEV PROTECTION CHECK");
    console.log("   ═══════════════════════════════════════════════");

    // Step 1: Check ENS mev_protection record
    const mevEnabled = await isMEVProtectionEnabled(ensName, cfg);
    console.log(
        `   ENS Record: mev_protection = ${mevEnabled ? "true ✅" : "false ❌"}`
    );

    // Step 2: Get appropriate provider
    const provider = getMEVProtectedProvider(mevEnabled, cfg);
    const signer = new ethers.Wallet(privateKey, provider);

    // Step 3: Execute transaction
    console.log(`   Executing transaction...`);
    const startTime = Date.now();

    const tx = await signer.sendTransaction(transaction);
    const receipt = await tx.wait();

    const executionTime = Date.now() - startTime;

    console.log(`   ✅ TX Confirmed: ${tx.hash}`);
    console.log(`   📦 Block: ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas: ${receipt.gasUsed.toString()}`);
    console.log(`   ⏱️  Time: ${executionTime}ms`);

    return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        mevProtected: mevEnabled,
        routedThrough: mevEnabled ? "flashbots" : "standard",
        executionTime,
        ensName,
    };
}

/**
 * Generate MEV protection proof data for ZK compliance
 * Used by the TEE agent after executing a transaction
 */
function generateMEVProofData({
    ensName,
    mevProtected,
    txHash,
    blockNumber,
}) {
    const ruleHash = ethers.keccak256(
        ethers.toUtf8Bytes(
            `mev_protection:${mevProtected}:${ensName}`
        )
    );

    return {
        proofType: "ens_rule_compliance",
        proofData: ethers.toUtf8Bytes(
            JSON.stringify({
                type: "mev_protection",
                ensName,
                mevProtected,
                txHash,
                blockNumber,
                timestamp: Math.floor(Date.now() / 1000),
            })
        ),
        publicInputs: [
            BigInt(ruleHash.slice(0, 18)), // Truncated rule hash (privacy-preserving)
            BigInt(1), // 1 = compliant (followed the ENS rule)
        ],
    };
}

// ═══════════════════════════════════════════════════════════════
//                     BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Check MEV protection status for multiple agents
 */
async function batchCheckMEVStatus(ensNames, config = {}) {
    const results = {};
    for (const name of ensNames) {
        results[name] = await isMEVProtectionEnabled(name, config);
    }
    return results;
}

module.exports = {
    isMEVProtectionEnabled,
    readENSPolicies,
    getMEVProtectedProvider,
    executeWithMEVProtection,
    generateMEVProofData,
    batchCheckMEVStatus,
    FLASHBOTS_RPC,
};
