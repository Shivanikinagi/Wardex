/**
 * deploy-verifier.js
 *
 * Deploys only the Verifier contract using the already-deployed DarkAgent.
 * Uses explicit nonce management to avoid Hardhat nonce caching bugs.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-verifier.js --network base_sepolia
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DARK_AGENT_ADDRESS      = "0xA77f8507838CC8719ac5B59567D2c260c007A366";
const CAPABILITY_CHECK_ADDRESS = "0x357cC7108B86221AC83920713c0dA5B1e4800794";

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("     🔒 DarkAgent — Deploying Verifier + Final Setup");
    console.log("═══════════════════════════════════════════════════════════\n");

    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

    // Fetch the latest confirmed nonce explicitly
    const nonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
    console.log("🔢 Current nonce:", nonce, "\n");

    // ─── Step 3: Verifier ────────────────────────────────────────
    console.log("━━━ Step 3: Deploying Verifier.sol ━━━");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(DARK_AGENT_ADDRESS, { nonce });
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier deployed to:", verifierAddress, "\n");

    // Attach to existing contracts for setup
    const DarkAgent = await ethers.getContractFactory("DarkAgent");
    const darkAgent = DarkAgent.attach(DARK_AGENT_ADDRESS);
    const CapabilityCheck = await ethers.getContractFactory("CapabilityCheck");
    const capabilityCheck = CapabilityCheck.attach(CAPABILITY_CHECK_ADDRESS);

    // ─── Step 4: Register Demo Agents ────────────────────────────
    console.log("━━━ Step 4: Registering Demo Agents ━━━");
    const tradingAgentWallet = ethers.Wallet.createRandom();
    const dataAgentWallet    = ethers.Wallet.createRandom();
    console.log("🤖 Trading Agent:", tradingAgentWallet.address);
    console.log("🤖 Data Agent:   ", dataAgentWallet.address);

    let currentNonce = nonce + 1;

    const tx1 = await darkAgent.registerAgent(
        tradingAgentWallet.address,
        "trading-agent.darkagent.eth",
        ["yield-farming", "token-swap", "payment"],
        ethers.parseEther("0.01"),
        ethers.parseEther("0.1"),
        ethers.parseEther("0.05"),
        { nonce: currentNonce++ }
    );
    await tx1.wait();
    console.log("✅ trading-agent.darkagent.eth registered");

    const tx2 = await darkAgent.registerAgent(
        dataAgentWallet.address,
        "data-agent.darkagent.eth",
        ["data-analysis", "reporting", "payment"],
        ethers.parseEther("0.005"),
        ethers.parseEther("0.05"),
        ethers.parseEther("0.025"),
        { nonce: currentNonce++ }
    );
    await tx2.wait();
    console.log("✅ data-agent.darkagent.eth registered\n");

    // ─── Step 5: Grant Capabilities ──────────────────────────────
    console.log("━━━ Step 5: Granting Capabilities ━━━");
    const tx3 = await capabilityCheck.grantCapabilities(
        tradingAgentWallet.address,
        ["yield-farming", "token-swap", "payment"],
        { nonce: currentNonce++ }
    );
    await tx3.wait();
    console.log("✅ Trading agent capabilities granted");

    const tx4 = await capabilityCheck.grantCapabilities(
        dataAgentWallet.address,
        ["data-analysis", "reporting", "payment"],
        { nonce: currentNonce++ }
    );
    await tx4.wait();
    console.log("✅ Data agent capabilities granted\n");

    // ─── Step 6: TEE Attestation ──────────────────────────────────
    console.log("━━━ Step 6: Setting Initial TEE Attestation ━━━");
    const attestationHash = ethers.keccak256(
        ethers.toUtf8Bytes("darkagent-tee-attestation-v1-" + Date.now())
    );
    const tx5 = await darkAgent.updateAttestation(
        tradingAgentWallet.address,
        attestationHash,
        { nonce: currentNonce++ }
    );
    await tx5.wait();
    console.log("✅ TEE attestation set for trading agent");
    console.log("   Hash:", attestationHash, "\n");

    // ─── Summary ──────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════════");
    console.log("     🎉 DEPLOYMENT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════\n");
    console.log("📋 Contract Addresses:");
    console.log("   DarkAgent:       ", DARK_AGENT_ADDRESS);
    console.log("   CapabilityCheck: ", CAPABILITY_CHECK_ADDRESS);
    console.log("   Verifier:        ", verifierAddress);
    console.log("\n🤖 Agent Addresses:");
    console.log("   Trading Agent:   ", tradingAgentWallet.address);
    console.log("   Data Agent:      ", dataAgentWallet.address);
    console.log("\n📝 Copy these to your .env:");
    console.log(`DARKAGENT_CONTRACT=${DARK_AGENT_ADDRESS}`);
    console.log(`CAPABILITY_CHECK_CONTRACT=${CAPABILITY_CHECK_ADDRESS}`);
    console.log(`VERIFIER_CONTRACT=${verifierAddress}`);
    console.log(`TRADING_AGENT_ADDRESS=${tradingAgentWallet.address}`);
    console.log(`DATA_AGENT_ADDRESS=${dataAgentWallet.address}`);
    console.log(`TRADING_AGENT_PRIVATE_KEY=${tradingAgentWallet.privateKey}`);
    console.log(`DATA_AGENT_PRIVATE_KEY=${dataAgentWallet.privateKey}`);
    console.log("\n🔗 BaseScan:");
    console.log(`   https://sepolia.basescan.org/address/${DARK_AGENT_ADDRESS}`);
    console.log(`   https://sepolia.basescan.org/address/${CAPABILITY_CHECK_ADDRESS}`);
    console.log(`   https://sepolia.basescan.org/address/${verifierAddress}\n`);

    // Save deployment info for frontend
    const deployment = {
        network: "base_sepolia",
        chainId: 84532,
        deployer: deployer.address,
        contracts: {
            DarkAgent: DARK_AGENT_ADDRESS,
            CapabilityCheck: CAPABILITY_CHECK_ADDRESS,
            Verifier: verifierAddress,
        },
        agents: {
            tradingAgent: {
                address: tradingAgentWallet.address,
                ensName: "trading-agent.darkagent.eth",
                capabilities: ["yield-farming", "token-swap", "payment"],
            },
            dataAgent: {
                address: dataAgentWallet.address,
                ensName: "data-agent.darkagent.eth",
                capabilities: ["data-analysis", "reporting", "payment"],
            },
        },
        attestationHash,
        explorerUrl: `https://sepolia.basescan.org/address/${DARK_AGENT_ADDRESS}`,
        deployedAt: new Date().toISOString(),
    };

    const configPath = path.join(__dirname, "..", "frontend", "src", "contracts");
    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(configPath, { recursive: true });
    }
    fs.writeFileSync(
        path.join(configPath, "deployment.json"),
        JSON.stringify(deployment, null, 2)
    );
    console.log("✅ Saved to frontend/src/contracts/deployment.json");

    return { verifierAddress, tradingAgentWallet, dataAgentWallet };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Failed:", error.message);
        process.exit(1);
    });
