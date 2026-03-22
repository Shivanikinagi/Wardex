require("dotenv").config();

const {
  setupZyfaiAgent,
  depositToYield,
} = require("../sdk/zyfai");

async function main() {
  console.log("-- Zyfai One-Time Setup --\n");

  const setup = await setupZyfaiAgent();
  if (!setup?.safeAddress) {
    throw new Error("Zyfai setup failed to return a Safe wallet address.");
  }

  console.log("Safe wallet:", setup.safeAddress);
  console.log("Session active:", setup.sessionActive ? "yes" : "no");
  console.log(`Add to .env: ZYFAI_SAFE_ADDRESS=${setup.safeAddress}`);

  const depositUsdc = Number(process.env.ZYFAI_BOOTSTRAP_DEPOSIT_USDC || 1);
  console.log(`\nDepositing ${depositUsdc} USDC to start yield...`);
  const deposit = await depositToYield(depositUsdc);
  console.log("Deposit tx:", deposit?.txHash || "not returned");

  console.log("\nZyfai setup complete");
}

main().catch((error) => {
  const message = String(error?.message || error || "");
  if (message.toLowerCase().includes("insufficient funds")) {
    console.warn("setup-zyfai warning:", message);
    console.warn("Top up native gas token on Base for the signer and rerun zyfai:setup.");
    return;
  }

  console.error("setup-zyfai failed:", message);
  process.exitCode = 1;
});