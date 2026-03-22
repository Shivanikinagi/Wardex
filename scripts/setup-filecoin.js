require("dotenv").config();
const { setupPayments, uploadToFOC, getStorageStatus } = require("../sdk/filecoin");

async function main() {
  const depositAmount = Number(process.env.FILECOIN_SETUP_DEPOSIT_USDFC || 0.5);
  await setupPayments(depositAmount);

  const upload = await uploadToFOC({
    test: true,
    timestamp: new Date().toISOString(),
    message: "wardex Filecoin Onchain Cloud integration test",
  });

  const status = await getStorageStatus();

  console.log("PieceCID:", upload.pieceCid);
  console.log("Verify:", upload.url);
  console.log("Balance:", status.balance);
}

main().catch((error) => {
  console.error("setup-filecoin failed:", error.message || error);
  process.exitCode = 1;
});
