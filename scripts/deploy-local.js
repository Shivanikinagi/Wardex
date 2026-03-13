const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("     🔒 DarkAgent — Deploying to Local Hardhat Node");
    console.log("═══════════════════════════════════════════════════════════\n");

    const [deployer, user1, agent1] = await ethers.getSigners();
    console.log("📍 Deployer:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

    // Deploy DarkAgent Protocol
    console.log("━━━ Deploying DarkAgent Core Protocol ━━━");
    const DarkAgent = await ethers.getContractFactory("DarkAgent");
    const darkAgent = await DarkAgent.deploy();
    await darkAgent.waitForDeployment();
    const darkAgentAddress = await darkAgent.getAddress();
    console.log("✅ DarkAgent deployed at:", darkAgentAddress);

    // Save deployment info for frontend
    const deployment = {
        network: "localhost",
        chainId: 31337,
        deployer: deployer.address,
        contracts: {
            DarkAgent: darkAgentAddress
        },
        agents: {
            demoAgent: {
                address: agent1.address,
                ensName: "agent.alice.eth"
            }
        },
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

    return deployment;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
