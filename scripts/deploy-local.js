const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("     🔒 DarkAgent — Deploying to Local Hardhat Node");
    console.log("═══════════════════════════════════════════════════════════\n");

    const [deployer] = await ethers.getSigners();
    console.log("📍 Deployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

    // Deploy DarkAgent
    console.log("━━━ Deploying DarkAgent.sol ━━━");
    const DarkAgent = await ethers.getContractFactory("DarkAgent");
    const darkAgent = await DarkAgent.deploy();
    await darkAgent.waitForDeployment();
    const darkAgentAddress = await darkAgent.getAddress();
    console.log("✅ DarkAgent:", darkAgentAddress);

    // Deploy CapabilityCheck
    console.log("━━━ Deploying CapabilityCheck.sol ━━━");
    const CapabilityCheck = await ethers.getContractFactory("CapabilityCheck");
    const capabilityCheck = await CapabilityCheck.deploy(darkAgentAddress);
    await capabilityCheck.waitForDeployment();
    const capabilityCheckAddress = await capabilityCheck.getAddress();
    console.log("✅ CapabilityCheck:", capabilityCheckAddress);

    // Deploy Verifier
    console.log("━━━ Deploying Verifier.sol ━━━");
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy(darkAgentAddress);
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("✅ Verifier:", verifierAddress);

    // Deploy SlippageGuard
    console.log("━━━ Deploying SlippageGuard.sol ━━━");
    const SlippageGuard = await ethers.getContractFactory("SlippageGuard");
    const slippageGuard = await SlippageGuard.deploy(darkAgentAddress);
    await slippageGuard.waitForDeployment();
    const slippageGuardAddress = await slippageGuard.getAddress();
    console.log("✅ SlippageGuard:", slippageGuardAddress);

    // Deploy SignatureVerifier
    console.log("━━━ Deploying SignatureVerifier.sol ━━━");
    const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier");
    const signatureVerifier = await SignatureVerifier.deploy(darkAgentAddress);
    await signatureVerifier.waitForDeployment();
    const signatureVerifierAddress = await signatureVerifier.getAddress();
    console.log("✅ SignatureVerifier:", signatureVerifierAddress);

    // Register demo agents
    console.log("\n━━━ Registering Demo Agents ━━━");
    const tradingAgentWallet = ethers.Wallet.createRandom();
    const dataAgentWallet = ethers.Wallet.createRandom();

    const tx1 = await darkAgent.registerAgent(
        tradingAgentWallet.address,
        "trading-agent.darkagent.eth",
        ["yield-farming", "token-swap", "payment"],
        ethers.parseEther("0.01"),
        ethers.parseEther("0.1"),
        ethers.parseEther("0.05")
    );
    await tx1.wait();
    console.log("✅ trading-agent.darkagent.eth registered");

    const tx2 = await darkAgent.registerAgent(
        dataAgentWallet.address,
        "data-agent.darkagent.eth",
        ["data-analysis", "reporting", "payment"],
        ethers.parseEther("0.005"),
        ethers.parseEther("0.05"),
        ethers.parseEther("0.025")
    );
    await tx2.wait();
    console.log("✅ data-agent.darkagent.eth registered");

    // Grant capabilities
    console.log("\n━━━ Granting Capabilities ━━━");
    await (await capabilityCheck.grantCapabilities(
        tradingAgentWallet.address,
        ["yield-farming", "token-swap", "payment"]
    )).wait();
    console.log("✅ Trading agent capabilities granted");

    await (await capabilityCheck.grantCapabilities(
        dataAgentWallet.address,
        ["data-analysis", "reporting", "payment"]
    )).wait();
    console.log("✅ Data agent capabilities granted");

    // Set attestation for trading agent
    console.log("\n━━━ Setting TEE Attestation ━━━");
    const attestationHash = ethers.keccak256(
        ethers.toUtf8Bytes("darkagent-tee-attestation-v1-" + Date.now())
    );
    await (await darkAgent.updateAttestation(tradingAgentWallet.address, attestationHash)).wait();
    console.log("✅ TEE attestation set for trading agent");

    // Post compliance proofs
    console.log("\n━━━ Posting Initial Compliance Proofs ━━━");
    const proofData = ethers.toUtf8Bytes("darkagent-compliance-proof-init");
    await (await verifier.submitAndVerifyProof(
        tradingAgentWallet.address, proofData, "spending_limit", [5, 10]
    )).wait();
    await (await verifier.submitAndVerifyProof(
        tradingAgentWallet.address, ethers.toUtf8Bytes("whitelist-proof"), "whitelist", [1, 0]
    )).wait();
    await (await verifier.submitAndVerifyProof(
        dataAgentWallet.address, ethers.toUtf8Bytes("sanctions-proof"), "sanctions", [0, 0]
    )).wait();
    console.log("✅ Compliance proofs posted");

    // Process a demo transaction
    console.log("\n━━━ Processing Demo Transaction ━━━");
    await (await darkAgent.processTransaction(
        tradingAgentWallet.address,
        ethers.parseEther("0.002"),
        dataAgentWallet.address
    )).wait();
    console.log("✅ trading-agent paid data-agent 0.002 ETH");

    // Configure slippage for demo agents
    console.log("\n━━━ Configuring Slippage Guards ━━━");
    await (await slippageGuard.configureAgentSlippage(tradingAgentWallet.address, 50)).wait(); // 0.5%
    console.log("✅ Trading agent slippage: 0.5%");
    await (await slippageGuard.configureAgentSlippage(dataAgentWallet.address, 100)).wait(); // 1.0%
    console.log("✅ Data agent slippage: 1.0%");

    // Post ENS rule compliance proofs
    console.log("\n━━━ Posting ENS Rule Compliance Proofs ━━━");
    await (await verifier.submitAndVerifyProof(
        tradingAgentWallet.address,
        ethers.toUtf8Bytes("ens-rule-compliance-proof"),
        "ens_rule_compliance",
        [1, 1] // rule hash non-zero + compliant
    )).wait();
    console.log("✅ ENS rule compliance proof posted");

    // Save deployment info for frontend
    const deployment = {
        network: "localhost",
        chainId: 31337,
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
        deployedAt: new Date().toISOString(),
    };

    // Write to frontend config
    const configPath = path.join(__dirname, "..", "frontend", "src", "contracts");
    if (!fs.existsSync(configPath)) {
        fs.mkdirSync(configPath, { recursive: true });
    }
    fs.writeFileSync(
        path.join(configPath, "deployment.json"),
        JSON.stringify(deployment, null, 2)
    );
    console.log("\n✅ Deployment info saved to frontend/src/contracts/deployment.json");

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("     🎉 LOCAL DEPLOYMENT COMPLETE");
    console.log("═══════════════════════════════════════════════════════════\n");
    console.log("Next steps:");
    console.log("  1. Keep this Hardhat node running");
    console.log("  2. cd frontend && npm run dev");
    console.log("  3. Open http://localhost:5173\n");

    return deployment;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
