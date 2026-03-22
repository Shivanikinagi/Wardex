require("dotenv").config();

let cachedSdk = null;

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function loadSdkModule() {
  const candidates = [
    String(process.env.ZYFAI_SDK_PACKAGE || "").trim(),
    "@zyfai/sdk",
  ].filter(Boolean);

  for (const name of candidates) {
    try {
      return require(name);
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function getUserAddress() {
  return (
    String(process.env.WALLET_ADDRESS || "").trim() ||
    String(process.env.OWNER_ADDRESS || "").trim() ||
    ""
  );
}

function getChainId() {
  const configured = Number(process.env.ZYFAI_CHAIN_ID || 8453);
  return Number.isFinite(configured) ? configured : 8453;
}

async function resolveSdk() {
  if (cachedSdk) {
    return cachedSdk;
  }

  const sdk = loadSdkModule();
  if (!sdk) {
    return null;
  }

  const ZyfaiSDK = sdk.ZyfaiSDK || sdk.default?.ZyfaiSDK;
  if (typeof ZyfaiSDK !== "function") {
    return null;
  }

  const apiKey = requiredEnv("ZYFAI_API_KEY");
  cachedSdk = new ZyfaiSDK({ apiKey });
  return cachedSdk;
}

async function connectAccount() {
  const sdk = await resolveSdk();
  if (!sdk) {
    return null;
  }

  const privateKey = requiredEnv("PRIVATE_KEY");
  const chainId = getChainId();
  if (typeof sdk.connectAccount === "function") {
    await sdk.connectAccount(privateKey, chainId);
  }
  return sdk;
}

async function setupZyfaiAgent() {
  const sdk = await connectAccount();
  if (!sdk) {
    return null;
  }

  const userAddress = getUserAddress();
  if (!userAddress) {
    throw new Error("Missing WALLET_ADDRESS or OWNER_ADDRESS for Zyfai setup.");
  }

  const chainId = getChainId();
  const wallet = await sdk.getSmartWalletAddress(userAddress, chainId);

  if (!wallet?.isDeployed) {
    await sdk.deploySafe(userAddress, chainId, String(process.env.ZYFAI_STRATEGY || "conservative"));
  }

  const session = await sdk.createSessionKey(userAddress, chainId);
  return {
    safeAddress: wallet?.address || null,
    isDeployed: Boolean(wallet?.isDeployed),
    sessionActive: Boolean(session?.alreadyActive || session?.sessionActivation),
    session,
  };
}

async function depositToYield(amountUsdc) {
  const sdk = await connectAccount();
  if (!sdk) {
    return null;
  }

  const userAddress = getUserAddress();
  if (!userAddress) {
    throw new Error("Missing WALLET_ADDRESS or OWNER_ADDRESS for Zyfai deposit.");
  }

  const chainId = getChainId();
  const amount = Math.floor(Number(amountUsdc) * 1_000_000).toString();
  const deposit = await sdk.depositFunds(userAddress, chainId, amount);
  return {
    txHash: deposit?.txHash || null,
    raw: deposit,
  };
}

async function getYieldBalanceDetails() {
  const sdk = await connectAccount();
  if (!sdk) {
    return null;
  }

  const userAddress = getUserAddress();
  if (!userAddress) {
    return null;
  }

  const chainId = getChainId();
  const wallet = await sdk.getSmartWalletAddress(userAddress, chainId);
  const earnings = await sdk.getOnchainEarnings(wallet.address);
  const positions = await sdk.getPositions(userAddress, chainId);

  const totalValueUsd = Array.isArray(positions)
    ? positions.reduce((sum, item) => sum + parseNumber(item?.valueUsd || 0), 0)
    : 0;

  return {
    safeAddress: wallet?.address || null,
    totalValueUsd,
    earnedUsd: parseNumber(earnings?.totalEarnedUsd || 0) || 0,
    currentApy: parseNumber(earnings?.currentApy || 0) || 0,
  };
}

async function canAffordInference(costUsdc = 0.001) {
  const balance = await getYieldBalanceDetails();
  if (!balance) {
    return {
      canAfford: false,
      earnedUsd: 0,
      reason: "Zyfai SDK not configured.",
    };
  }

  if (balance.earnedUsd < costUsdc) {
    return {
      canAfford: false,
      earnedUsd: balance.earnedUsd,
      reason: `Earned yield $${balance.earnedUsd} below cost $${costUsdc} - waiting`,
    };
  }

  return {
    canAfford: true,
    earnedUsd: balance.earnedUsd,
    reason: `Sufficient yield: $${balance.earnedUsd} earned`,
  };
}

async function withdrawYieldForInference(amountUsdc) {
  const sdk = await connectAccount();
  if (!sdk) {
    return null;
  }

  const userAddress = getUserAddress();
  if (!userAddress) {
    throw new Error("Missing WALLET_ADDRESS or OWNER_ADDRESS for Zyfai withdraw.");
  }

  const chainId = getChainId();
  const amount = Math.floor(Number(amountUsdc) * 1_000_000).toString();
  const result = await sdk.withdrawFunds(userAddress, chainId, amount);
  return {
    success: true,
    txHash: result?.txHash || "",
    raw: result,
  };
}

async function getApyHistory() {
  const sdk = await connectAccount();
  if (!sdk) {
    return null;
  }

  const userAddress = getUserAddress();
  if (!userAddress) {
    return null;
  }

  const chainId = getChainId();
  const wallet = await sdk.getSmartWalletAddress(userAddress, chainId);
  return sdk.getDailyApyHistory(wallet.address, "30D");
}

async function disconnectZyfai() {
  const sdk = await resolveSdk();
  if (sdk && typeof sdk.disconnectAccount === "function") {
    await sdk.disconnectAccount();
  }
}

function extractYieldBalance(payload) {
  if (payload == null) return null;
  if (typeof payload === "number" || typeof payload === "string") {
    return parseNumber(payload);
  }
  return (
    parseNumber(payload.yieldBalance) ??
    parseNumber(payload.availableYield) ??
    parseNumber(payload.balance) ??
    parseNumber(payload.available) ??
    parseNumber(payload.earnedUsd)
  );
}

async function getYieldBalance() {
  const details = await getYieldBalanceDetails();
  if (!details) {
    return null;
  }
  return extractYieldBalance(details);
}

async function spendYield({ amount }) {
  const withdrawn = await withdrawYieldForInference(amount);
  if (!withdrawn) {
    return null;
  }
  return withdrawn;
}

module.exports = {
  setupZyfaiAgent,
  depositToYield,
  getYieldBalanceDetails,
  canAffordInference,
  withdrawYieldForInference,
  getApyHistory,
  disconnectZyfai,
  getYieldBalance,
  spendYield,
};
