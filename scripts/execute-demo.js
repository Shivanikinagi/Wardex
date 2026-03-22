const hre = require("hardhat");
require("dotenv").config();

const { ethers } = hre;

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function main() {
  const darkAgentAddress =
    String(process.env.DARKAGENT_CONTRACT || "").trim() ||
    String(process.env.DARKAGENT_PROTOCOL_ADDRESS || "").trim();

  if (!darkAgentAddress || !ethers.isAddress(darkAgentAddress)) {
    throw new Error(
      "Missing or invalid DARKAGENT_CONTRACT (or DARKAGENT_PROTOCOL_ADDRESS) in .env"
    );
  }

  requiredEnv("PRIVATE_KEY");

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Network:", network.name, "(chainId:", network.chainId.toString() + ")");
  console.log("Signer:", signer.address);
  console.log("DarkAgent:", darkAgentAddress);

  const feeData = await ethers.provider.getFeeData();
  let nextNonce = await ethers.provider.getTransactionCount(signer.address, "pending");
  const bump = (value) => {
    if (value == null) return undefined;
    return (value * 120n) / 100n;
  };
  const txOverrides = () => {
    const overrides = { nonce: nextNonce++ };
    if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
      overrides.maxFeePerGas = bump(feeData.maxFeePerGas);
      overrides.maxPriorityFeePerGas = bump(feeData.maxPriorityFeePerGas);
    } else if (feeData.gasPrice != null) {
      overrides.gasPrice = bump(feeData.gasPrice);
    }
    return overrides;
  };

  const darkAgent = await ethers.getContractAt("DarkAgent", darkAgentAddress, signer);
  let ensResolverAddress = String(process.env.ENS_RESOLVER_ADDRESS || "").trim();
  try {
    const resolverFromContract = await darkAgent.ensResolver();
    if (resolverFromContract && ethers.isAddress(resolverFromContract)) {
      ensResolverAddress = resolverFromContract;
    }
  } catch (error) {
    if (!ensResolverAddress || !ethers.isAddress(ensResolverAddress)) {
      throw new Error(
        `Could not read ensResolver() from DarkAgent and ENS_RESOLVER_ADDRESS is missing/invalid. ${error.message || error}`
      );
    }
    console.warn("ensResolver() call reverted; using ENS_RESOLVER_ADDRESS from .env");
  }

  if (!ensResolverAddress || !ethers.isAddress(ensResolverAddress)) {
    throw new Error("Missing or invalid ENS_RESOLVER_ADDRESS in .env");
  }

  console.log("ENS Resolver:", ensResolverAddress);
  const ensResolver = await ethers.getContractAt("ENSAgentResolver", ensResolverAddress, signer);

  const agent = signer.address;
  const user = signer.address;

  // DarkAgent.verify requires active ENS permissions with maxSpend > 0.
  const syncTx = await ensResolver.syncPermissions(
    user,
    ethers.parseEther("1"),
    ethers.parseEther("5"),
    100,
    [],
    [],
    Math.floor(Date.now() / 1000) + 86400,
    true,
    txOverrides()
  );
  await syncTx.wait();
  const actionPayload = ethers.toUtf8Bytes(
    JSON.stringify({
      type: "blink-exec",
      protocol: "uniswap",
      tokenIn: "USDC",
      tokenOut: "ETH",
      amountUsd: 25,
      timestamp: new Date().toISOString(),
    })
  );
  const proposeTx = await darkAgent.propose(agent, user, actionPayload, txOverrides());
  const proposeReceipt = await proposeTx.wait();

  const proposedLog = proposeReceipt.logs
    .map((log) => {
      try {
        return darkAgent.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === "ActionProposed");

  const proposalId = proposedLog?.args?.proposalId;
  if (!proposalId) {
    throw new Error("Failed to parse proposalId from ActionProposed event");
  }

  const verifyTx = await darkAgent.verify(proposalId, txOverrides());
  const verifyReceipt = await verifyTx.wait();

  const executeTx = await darkAgent.execute(proposalId, txOverrides());
  const executeReceipt = await executeTx.wait();

  const explorerBase = "https://sepolia.basescan.org/tx/";

  console.log("\n=== Real Transaction Hashes ===");
  console.log("propose  :", proposeReceipt.hash);
  console.log("verify   :", verifyReceipt.hash);
  console.log("execute  :", executeReceipt.hash);

  console.log("\n=== Explorer Links ===");
  console.log("propose  :", explorerBase + proposeReceipt.hash);
  console.log("verify   :", explorerBase + verifyReceipt.hash);
  console.log("execute  :", explorerBase + executeReceipt.hash);

  console.log("\nProposal ID:", proposalId);
}

main().catch((error) => {
  console.error("Execution demo failed:", error);
  process.exitCode = 1;
});
