require("dotenv").config();
const { formatUnits, http, parseUnits } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const FILECOIN_PAYMENT_TOKEN = "USDFC";

async function main() {
  const { Synapse, calibration } = await import("@filoz/synapse-sdk");
  const defaultRpc = calibration?.rpcUrls?.default?.http?.[0] || "";
  const filecoinPayAddress = calibration?.contracts?.filecoinPay?.address;
  const warmStorageAddress = calibration?.contracts?.fwss?.address;
  if (!filecoinPayAddress) {
    throw new Error("Filecoin Pay contract address not found for calibration chain.");
  }
  if (!warmStorageAddress) {
    throw new Error("Warm Storage contract address not found for calibration chain.");
  }

  console.log("-- Filecoin Onchain Cloud Setup --\n");

  let privateKey =
    String(process.env.FILECOIN_PRIVATE_KEY || "").trim() ||
    String(process.env.PRIVATE_KEY || "").trim();
  if (!privateKey) {
    throw new Error("Missing FILECOIN_PRIVATE_KEY (or PRIVATE_KEY fallback).");
  }

  if (!privateKey.startsWith("0x")) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey);

  const synapse = Synapse.create({
    chain: calibration,
    transport: http(String(process.env.FILECOIN_RPC_URL || "").trim() || defaultRpc),
    account,
  });
  console.log("Connected to FOC Calibration testnet");

  const decimals = await synapse.payments.decimals();
  const balance = await synapse.payments.balance({ token: FILECOIN_PAYMENT_TOKEN });
  const readableBalance = Number(formatUnits(balance, decimals));
  console.log("USDFC balance:", readableBalance);

  if (Number(balance) === 0) {
    console.log("\nNo USDFC balance");
    console.log("Get test USDFC from the Calibration faucet and rerun setup.");
    return;
  }

  const depositAmount = String(process.env.FILECOIN_SETUP_DEPOSIT_USDFC || "0.5");
  const depositUnits = parseUnits(depositAmount, decimals);

  console.log("Approving Filecoin Pay for USDFC spend...");
  const approveHash = await synapse.payments.approve({
    spender: filecoinPayAddress,
    amount: depositUnits,
    token: FILECOIN_PAYMENT_TOKEN,
  });
  await synapse.client.waitForTransactionReceipt({ hash: approveHash });

  console.log(`\nDepositing ${depositAmount} USDFC into Filecoin Pay...`);
  await synapse.payments.deposit({ amount: depositUnits, token: FILECOIN_PAYMENT_TOKEN });
  console.log("Payment rail funded");

  console.log("Approving Warm Storage operator...");
  const approveServiceHash = await synapse.payments.approveService({
    service: warmStorageAddress,
    token: FILECOIN_PAYMENT_TOKEN,
  });
  await synapse.client.waitForTransactionReceipt({ hash: approveServiceHash });
  console.log("Warm Storage operator approved");

  console.log("\nTesting upload...");
  const testData = {
    project: "DarkAgent",
    test: true,
    walletAddress: process.env.FILECOIN_WALLET_ADDRESS || "",
    timestamp: new Date().toISOString(),
  };

  const bytes = new TextEncoder().encode(JSON.stringify(testData));
  const upload = await synapse.storage.upload(bytes);
  const pieceCid = upload.pieceCid.toString();

  console.log("\nFilecoin FOC working");
  console.log("PieceCID:", pieceCid);
  console.log("Verify:", `https://calibration.filfox.info/en/message/${pieceCid}`);
}

main().catch((error) => {
  console.error("setup-foc failed:", error.message || error);
  process.exitCode = 1;
});