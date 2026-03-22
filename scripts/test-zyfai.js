require("dotenv").config();

const {
  getYieldBalanceDetails,
  canAffordInference,
} = require("../sdk/zyfai");

async function main() {
  console.log("-- Zyfai SDK Test --\n");

  const balance = await getYieldBalanceDetails();
  if (!balance) {
    throw new Error("Zyfai SDK not configured or account could not be loaded.");
  }

  console.log("Safe address :", balance.safeAddress);
  console.log("Total value  : $", balance.totalValueUsd);
  console.log("Yield earned : $", balance.earnedUsd);
  console.log("Current APY  :", balance.currentApy, "%");

  const cost = Number(process.env.VENICE_COST_USDC || 0.001);
  const afford = await canAffordInference(cost);
  console.log("\nCan afford inference:", afford.canAfford);
  console.log("Reason:", afford.reason);

  console.log("\nZyfai SDK test complete");
}

main().catch((error) => {
  const message = String(error?.message || error || "");
  if (message.toLowerCase().includes("onchain earnings not found")) {
    console.warn("test-zyfai note:", message);
    console.warn("Yield history is not available yet for this Safe. Re-run after deposits accrue.");
    return;
  }

  console.error("test-zyfai failed:", message);
  process.exitCode = 1;
});