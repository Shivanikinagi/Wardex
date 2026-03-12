const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("     🔒 DarkAgent — Deploying to Base Sepolia");
    console.log("═══════════════════════════════════════════════════════════");
    console.log();

    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Deploy DarkAgent (Core Registry)
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Step 1: Deploying DarkAgent.sol ━━━");
    const DarkAgent = await ethers.getContractFactory("DarkAgent");
    const darkAgent = await DarkAgent.deploy();
    await darkAgent.waitForDeployment();
    const darkAgentAddress = await darkAgent.getAddress();
    console.log("✅ DarkAgent deployed to:", darkAgentAddress);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Deploy CapabilityCheck
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Step 2: Deploying CapabilityCheck.sol ━━━");
    const CapabilityCheck = await ethers.getContractFactory("CapabilityCheck");
    const capabilityCheck = await CapabilityCheck.deploy(darkAgentAddress);
    await capabilityCheck.waitForDeployment();
    const capabilityCheckAddress = await capabilityCheck.getAddress();
    console.log("✅ CapabilityCheck deployed to:", capabilityCheckAddress);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Deploy Verifier (ZK Proof Verifier)
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Step 3: Deploying Verifier.sol ━━━");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(darkAgentAddress);
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier deployed to:", verifierAddress);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // STEP 3b: Deploy SlippageGuard
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Step 3b: Deploying SlippageGuard.sol ━━━");
    const SlippageGuard = await ethers.getContractFactory("SlippageGuard");
    const slippageGuard = await SlippageGuard.deploy(darkAgentAddress);
    await slippageGuard.waitForDeployment();
    const slippageGuardAddress = await slippageGuard.getAddress();
    console.log("✅ SlippageGuard deployed to:", slippageGuardAddress);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // STEP 3c: Deploy SignatureVerifier
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Step 3c: Deploying SignatureVerifier.sol ━━━");
    const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier");
    const signatureVerifier = await SignatureVerifier.deploy(darkAgentAddress);
    await signatureVerifier.waitForDeployment();
    const signatureVerifierAddress = await signatureVerifier.getAddress();
    console.log("✅ SignatureVerifier deployed to:", signatureVerifierAddress);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Register Demo Agents
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Step 4: Registering Demo Agents ━━━");

    // Generate agent addresses (for demo, we use derived addresses)
    const tradingAgentWallet = ethers.Wallet.createRandom();
    const dataAgentWallet = ethers.Wallet.createRandom();

    console.log("🤖 Trading Agent:", tradingAgentWallet.address);
    console.log("🤖 Data Agent:", dataAgentWallet.address);

    // Register trading-agent.darkagent.eth
    const tx1 = await darkAgent.registerAgent(
        tradingAgentWallet.address,
        "trading-agent.darkagent.eth",
        ["yield-farming", "token-swap", "payment"],
        ethers.parseEther("0.01"),  // Max $10 per tx (10 finney)
        ethers.parseEther("0.1"),   // Max $100 per day (100 finney)
        ethers.parseEther("0.05")   // Alert above $50 (50 finney)
    );
    await tx1.wait();
    console.log("✅ trading-agent.darkagent.eth registered");

    // Register data-agent.darkagent.eth
    const tx2 = await darkAgent.registerAgent(
        dataAgentWallet.address,
        "data-agent.darkagent.eth",
        ["data-analysis", "reporting", "payment"],
        ethers.parseEther("0.005"), // Max $5 per tx
        ethers.parseEther("0.05"),  // Max $50 per day
        ethers.parseEther("0.025")  // Alert above $25
    );
    await tx2.wait();
    console.log("✅ data-agent.darkagent.eth registered");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Grant capabilities in CapabilityCheck
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Step 5: Granting Capabilities ━━━");

    const tx3 = await capabilityCheck.grantCapabilities(
        tradingAgentWallet.address,
        ["yield-farming", "token-swap", "payment"]
    );
    await tx3.wait();
    console.log("✅ Trading agent capabilities granted");

    const tx4 = await capabilityCheck.grantCapabilities(
        dataAgentWallet.address,
        ["data-analysis", "reporting", "payment"]
    );
    await tx4.wait();
    console.log("✅ Data agent capabilities granted");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: Set Initial Attestation (simulated TEE)
    // ═══════════════════════════════════════════════════════════════
    console.log("━━━ Step 6: Setting Initial TEE Attestation ━━━");

    const attestationHash = ethers.keccak256(
        ethers.toUtf8Bytes("darkagent-tee-attestation-v1-" + Date.now())
    );

    const tx5 = await darkAgent.updateAttestation(
        tradingAgentWallet.address,
        attestationHash
    );
    await tx5.wait();
    console.log("✅ TEE attestation set for trading agent");
    console.log("   Hash:", attestationHash);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // DEPLOYMENT SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log("═══════════════════════════════════════════════════════════");
    console.log("     🎉 DEPLOYMENT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════");
    console.log();
    console.log("📋 Contract Addresses:");
    console.log("   DarkAgent:          ", darkAgentAddress);
    console.log("   CapabilityCheck:    ", capabilityCheckAddress);
    console.log("   Verifier:           ", verifierAddress);
    console.log("   SlippageGuard:      ", slippageGuardAddress);
    console.log("   SignatureVerifier:  ", signatureVerifierAddress);
    console.log();
    console.log("🤖 Agent Addresses:");
    console.log("   Trading Agent:   ", tradingAgentWallet.address);
    console.log("   Data Agent:      ", dataAgentWallet.address);
    console.log();
    console.log("📝 Add these to your .env file:");
    console.log(`   DARKAGENT_CONTRACT=${darkAgentAddress}`);
    console.log(`   CAPABILITY_CHECK_CONTRACT=${capabilityCheckAddress}`);
    console.log(`   VERIFIER_CONTRACT=${verifierAddress}`);
    console.log(`   SLIPPAGE_GUARD_CONTRACT=${slippageGuardAddress}`);
    console.log(`   SIGNATURE_VERIFIER_CONTRACT=${signatureVerifierAddress}`);
    console.log(`   TRADING_AGENT_ADDRESS=${tradingAgentWallet.address}`);
    console.log(`   DATA_AGENT_ADDRESS=${dataAgentWallet.address}`);
    console.log(`   TRADING_AGENT_PRIVATE_KEY=${tradingAgentWallet.privateKey}`);
    console.log(`   DATA_AGENT_PRIVATE_KEY=${dataAgentWallet.privateKey}`);
    console.log();
    console.log("🔗 View on BaseScan:");
    console.log(`   https://sepolia.basescan.org/address/${darkAgentAddress}`);
    console.log();

    // Save deployment info for frontend
    const deployment = {
        network: "base_sepolia",
        chainId: 84532,
        deployer: deployer.address,
        contracts: {
            DarkAgent: darkAgentAddress,
            CapabilityCheck: capabilityCheckAddress,
            Verifier: verifierAddress,
            SlippageGuard: slippageGuardAddress,
            SignatureVerifier: signatureVerifierAddress,
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
        explorerUrl: `https://sepolia.basescan.org/address/${darkAgentAddress}`,
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
    console.log("✅ Deployment info saved to frontend/src/contracts/deployment.json");
    console.log();

    return {
        darkAgent: darkAgentAddress,
        capabilityCheck: capabilityCheckAddress,
        verifier: verifierAddress,
        slippageGuard: slippageGuardAddress,
        signatureVerifier: signatureVerifierAddress,
        tradingAgent: tradingAgentWallet.address,
        dataAgent: dataAgentWallet.address,
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
