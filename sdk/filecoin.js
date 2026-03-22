require("dotenv").config();
const { formatUnits, http, parseUnits } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");

let synapseModule = null;

let synapse = null;
const FILECOIN_PAYMENT_TOKEN = "USDFC";

function parsePositiveInt(value, fallback) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryStorageOperation(label, operation, options = {}) {
  const attempts = parsePositiveInt(
    options.attempts ?? process.env.FILECOIN_FOC_RETRIES,
    2
  );
  const delayMs = parsePositiveInt(
    options.delayMs ?? process.env.FILECOIN_RETRY_DELAY_MS,
    1200
  );

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }
      await sleep(delayMs * attempt);
    }
  }

  throw new Error(
    `${label} failed after ${attempts} attempt${attempts === 1 ? "" : "s"}. ${
      lastError?.message || lastError
    }`
  );
}

async function getSynapseModule() {
  if (!synapseModule) {
    synapseModule = await import("@filoz/synapse-sdk");
  }
  return synapseModule;
}

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function getSynapse() {
  if (synapse) {
    return synapse;
  }

  const { Synapse, calibration } = await getSynapseModule();

  const defaultRpc = calibration?.rpcUrls?.default?.http?.[0] || "";

  const rpcURL =
    String(process.env.FILECOIN_RPC_URL || "").trim() ||
    defaultRpc;
  let privateKey =
    String(process.env.FILECOIN_PRIVATE_KEY || "").trim() ||
    String(process.env.PRIVATE_KEY || "").trim();

  if (!privateKey) {
    throw new Error("Missing FILECOIN_PRIVATE_KEY (or PRIVATE_KEY fallback) for Synapse SDK.");
  }

  if (!privateKey.startsWith("0x")) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey);

  synapse = Synapse.create({
    chain: calibration,
    transport: http(rpcURL),
    account,
  });
  return synapse;
}

async function setupPayments(amountUSDFC = 1) {
  const s = await getSynapse();
  const { calibration } = await getSynapseModule();
  const filecoinPayAddress = calibration?.contracts?.filecoinPay?.address;
  const warmStorageAddress = calibration?.contracts?.fwss?.address;
  if (!filecoinPayAddress) {
    throw new Error("Filecoin Pay contract address not found for calibration chain.");
  }
  if (!warmStorageAddress) {
    throw new Error("Warm Storage contract address not found for calibration chain.");
  }

  const decimals = await s.payments.decimals();
  const amount = parseUnits(String(amountUSDFC), decimals);

  const approveHash = await s.payments.approve({
    spender: filecoinPayAddress,
    amount,
    token: FILECOIN_PAYMENT_TOKEN,
  });
  await s.client.waitForTransactionReceipt({ hash: approveHash });

  await s.payments.deposit({
    amount,
    token: FILECOIN_PAYMENT_TOKEN,
  });

  const approveServiceHash = await s.payments.approveService({
    service: warmStorageAddress,
    token: FILECOIN_PAYMENT_TOKEN,
  });
  await s.client.waitForTransactionReceipt({ hash: approveServiceHash });

  return true;
}

async function uploadToFOC(data, options = {}) {
  const s = await getSynapse();
  const content = JSON.stringify(data, null, 2);
  const bytes = new TextEncoder().encode(content);
  const upload = await retryStorageOperation(
    "Filecoin FOC upload",
    () => s.storage.upload(bytes),
    options
  );

  const pieceCid = upload.pieceCid.toString();
  const url = `https://calibration.filfox.info/en/message/${pieceCid}`;

  return {
    pieceCid,
    url,
    size: bytes.length,
  };
}

async function downloadFromFOC(pieceCid) {
  const s = await getSynapse();
  const bytes = await s.storage.download({ pieceCid });
  const content = new TextDecoder().decode(bytes);
  return JSON.parse(content);
}

async function getStorageStatus() {
  const s = await getSynapse();
  const decimals = await s.payments.decimals();
  const balance = await s.payments.balance({ token: FILECOIN_PAYMENT_TOKEN });
  return {
    balance: `${Number(formatUnits(balance, decimals)).toFixed(4)} USDFC`,
  };
}

module.exports = {
  getSynapse,
  setupPayments,
  uploadToFOC,
  downloadFromFOC,
  getStorageStatus,
};
