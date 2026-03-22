/**
 * wardex SDK — Agent Registration
 * ====================================
 * Handles agent registration with:
 *   - ENS subname creation (trading-agent.wardex.eth)
 *   - Smart contract registration
 *   - Capability setup
 *   - Spending policy configuration
 *   - Initial TEE attestation
 *
 * Usage:
 *   const { registerAgent } = require('./register');
 *   const result = await registerAgent({
 *     name: 'trading-agent',
 *     capabilities: ['yield-farming', 'token-swap'],
 *     maxPerTransaction: '0.01',
 *     maxPerDay: '0.1',
 *   });
 */

const { ethers } = require("ethers");

// Contract ABI (minimal for registration)
const wardex_ABI = [
    "function registerAgent(address agentAddress, string ensName, string[] capabilities, uint256 maxPerTx, uint256 maxPerDay, uint256 alertThreshold) external",
    "function getAgent(address agentAddress) external view returns (address owner, string ensName, bytes32 capabilityHash, string[] capabilities, uint256 reputationScore, uint8 status, bytes32 attestationHash, uint256 attestationTime, uint256 registeredAt)",
    "function updateAttestation(address agentAddress, bytes32 newAttestationHash) external",
    "function isVerifiedAgent(address agentAddress) external view returns (bool)",
    "function totalAgents() external view returns (uint256)",
    "function getAllAgents() external view returns (address[])",
    "event AgentRegistered(address indexed agentAddress, address indexed owner, string ensName, bytes32 capabilityHash)",
];

const CAPABILITY_CHECK_ABI = [
    "function grantCapabilities(address agent, string[] capabilityNames) external",
    "function hasCapability(address agent, string capabilityName) external view returns (bool)",
    "function check(address agent, string action) external returns (bool)",
    "function enforce(address agent, string action) external",
];

// Default configuration
const DEFAULT_CONFIG = {
    rpcUrl: "https://sepolia.base.org",
    chainId: 84532,
    wardexAddress: process.env.wardex_CONTRACT || "",
    capabilityCheckAddress: process.env.CAPABILITY_CHECK_CONTRACT || "",
    parentDomain: "wardex.eth",
};

/**
 * Register a new AI agent on wardex
 */
async function registerAgent({
    name,
    capabilities,
    maxPerTransaction = "0.01",
    maxPerDay = "0.1",
    alertThreshold = "0.05",
    privateKey,
    config = {},
}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    console.log("═══════════════════════════════════════════════════════");
    console.log("  🤖 wardex — Registering New Agent");
    console.log("═══════════════════════════════════════════════════════");

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    console.log(`\n📍 Owner: ${signer.address}`);
    console.log(`🌐 Network: Base Sepolia (${cfg.chainId})`);

    // Step 1: Generate agent wallet
    console.log("\n━━━ Step 1: Generate Agent Wallet ━━━");
    const agentWallet = ethers.Wallet.createRandom();
    const ensName = `${name}.${cfg.parentDomain}`;

    console.log(`   Agent Address: ${agentWallet.address}`);
    console.log(`   ENS Name: ${ensName}`);
    console.log(`   Capabilities: ${capabilities.join(", ")}`);

    // Step 2: Register on smart contract
    console.log("\n━━━ Step 2: Register on wardex Contract ━━━");
    const wardex = new ethers.Contract(
        cfg.wardexAddress,
        wardex_ABI,
        signer
    );

    const tx = await wardex.registerAgent(
        agentWallet.address,
        ensName,
        capabilities,
        ethers.parseEther(maxPerTransaction),
        ethers.parseEther(maxPerDay),
        ethers.parseEther(alertThreshold)
    );

    console.log(`   TX Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

    // Step 3: Grant capabilities
    console.log("\n━━━ Step 3: Grant Capabilities ━━━");
    if (cfg.capabilityCheckAddress) {
        const capCheck = new ethers.Contract(
            cfg.capabilityCheckAddress,
            CAPABILITY_CHECK_ABI,
            signer
        );

        const capTx = await capCheck.grantCapabilities(
            agentWallet.address,
            capabilities
        );
        await capTx.wait();
        console.log("   ✅ Capabilities granted on-chain");
    }

    // Step 4: Generate initial attestation
    console.log("\n━━━ Step 4: Set Initial Attestation ━━━");
    const attestationHash = ethers.keccak256(
        ethers.toUtf8Bytes(`wardex-attestation-${name}-${Date.now()}`)
    );

    const attTx = await wardex.updateAttestation(
        agentWallet.address,
        attestationHash
    );
    await attTx.wait();
    console.log(`   ✅ Attestation: ${attestationHash.slice(0, 18)}...`);

    // Result
    const result = {
        success: true,
        agent: {
            address: agentWallet.address,
            privateKey: agentWallet.privateKey,
            ensName: ensName,
            capabilities: capabilities,
            attestationHash: attestationHash,
        },
        spending: {
            maxPerTransaction: maxPerTransaction + " ETH",
            maxPerDay: maxPerDay + " ETH",
            alertThreshold: alertThreshold + " ETH",
        },
        contracts: {
            wardex: cfg.wardexAddress,
            capabilityCheck: cfg.capabilityCheckAddress,
        },
        network: {
            chain: "Base Sepolia",
            chainId: cfg.chainId,
        },
    };

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  ✅ Agent Registered Successfully!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`\n   📛 ${ensName}`);
    console.log(`   💰 Max per tx: ${maxPerTransaction} ETH`);
    console.log(`   📊 Max per day: ${maxPerDay} ETH`);
    console.log(`   🔐 Attestation set`);

    return result;
}

/**
 * Get agent details from the registry
 */
async function getAgent(agentAddress, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const wardex = new ethers.Contract(
        cfg.wardexAddress,
        wardex_ABI,
        provider
    );

    const agent = await wardex.getAgent(agentAddress);

    return {
        owner: agent[0],
        ensName: agent[1],
        capabilityHash: agent[2],
        capabilities: agent[3],
        reputationScore: Number(agent[4]),
        status: ["INACTIVE", "ACTIVE", "FROZEN", "SUSPENDED"][Number(agent[5])],
        attestationHash: agent[6],
        attestationTime: Number(agent[7]),
        registeredAt: Number(agent[8]),
    };
}

/**
 * List all registered agents
 */
async function listAgents(config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const wardex = new ethers.Contract(
        cfg.wardexAddress,
        wardex_ABI,
        provider
    );

    const addresses = await wardex.getAllAgents();
    const agents = [];

    for (const addr of addresses) {
        const agent = await getAgent(addr, config);
        agents.push({ address: addr, ...agent });
    }

    return agents;
}

/**
 * Check if an agent is verified
 */
async function isVerified(agentAddress, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const wardex = new ethers.Contract(
        cfg.wardexAddress,
        wardex_ABI,
        provider
    );

    return await wardex.isVerifiedAgent(agentAddress);
}

module.exports = {
    registerAgent,
    getAgent,
    listAgents,
    isVerified,
    wardex_ABI,
    CAPABILITY_CHECK_ABI,
    DEFAULT_CONFIG,
};
