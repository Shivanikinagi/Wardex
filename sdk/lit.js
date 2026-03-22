require("dotenv").config();
const { Wallet, ethers } = require("ethers");

let cachedClientPromise = null;
let statusCache = null;
const sessionSigCache = new Map();
let stderrPatched = false;

function suppressLitSdkWarnings() {
  if (stderrPatched) {
    return;
  }

  stderrPatched = true;
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    const text = String(chunk || "");
    if (text.includes("lit-js-sdk:constants:")) {
      return true;
    }
    return originalWrite(chunk, ...args);
  };
}

function normalizeError(error) {
  return String(error?.message || error || "Unknown Lit error");
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function loadSdkModule() {
  suppressLitSdkWarnings();

  const candidates = [
    String(process.env.LIT_SDK_PACKAGE || "").trim(),
    "@lit-protocol/lit-node-client-nodejs",
    "@lit-protocol/lit-node-client",
  ].filter(Boolean);

  for (const name of candidates) {
    try {
      return {
        name,
        sdk: require(name),
      };
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function loadAuthHelpers() {
  try {
    return require("@lit-protocol/auth-helpers");
  } catch {
    return null;
  }
}

function getLitNetwork() {
  return String(process.env.LIT_NETWORK || "datil-dev").trim();
}

function getLitChain() {
  return String(process.env.LIT_CHAIN || "base").trim();
}

function getLitChainId() {
  const configured = Number(process.env.LIT_CHAIN_ID || 8453);
  return Number.isFinite(configured) ? configured : 8453;
}

function getPrivateKeyWallet() {
  let privateKey = String(process.env.PRIVATE_KEY || "").trim();
  if (!privateKey) {
    return null;
  }

  if (!privateKey.startsWith("0x")) {
    privateKey = `0x${privateKey}`;
  }

  try {
    return new Wallet(privateKey);
  } catch {
    return null;
  }
}

function parseJsonEnv(name) {
  const raw = String(process.env[name] || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseSessionSigs() {
  return parseJsonEnv("LIT_SESSION_SIGS_JSON");
}

function parseAuthSig() {
  return parseJsonEnv("LIT_AUTH_SIG");
}

function resolveClientClass(sdk) {
  if (!sdk) {
    return null;
  }

  return (
    sdk.LitNodeClientNodeJs ||
    sdk.LitNodeClient ||
    sdk.default?.LitNodeClient ||
    null
  );
}

async function resolveClient({ timeoutMs = 4500, reset = false } = {}) {
  if (reset) {
    cachedClientPromise = null;
  }

  if (!cachedClientPromise) {
    cachedClientPromise = (async () => {
      const loaded = loadSdkModule();
      if (!loaded) {
        return {
          client: null,
          sdkName: null,
          error: "Lit SDK is not installed.",
        };
      }

      const LitClientClass = resolveClientClass(loaded.sdk);
      if (!LitClientClass) {
        return {
          client: null,
          sdkName: loaded.name,
          error: "LitNodeClient class was not found in the installed SDK.",
        };
      }

      const client = new LitClientClass({
        litNetwork: getLitNetwork(),
        debug:
          String(process.env.LIT_DEBUG || "false").trim().toLowerCase() ===
          "true",
      });

      try {
        if (typeof client.connect === "function") {
          await withTimeout(client.connect(), timeoutMs, "Lit client connect");
        }
      } catch (error) {
        return {
          client: null,
          sdkName: loaded.name,
          error: normalizeError(error),
        };
      }

      return {
        client,
        sdkName: loaded.name,
        error: null,
      };
    })();
  }

  const resolved = await cachedClientPromise;
  if (resolved?.error) {
    cachedClientPromise = null;
  }

  return resolved;
}

function buildSessionSigCacheKey({ actionCid, jsParams }) {
  return `${actionCid}::${ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(jsParams || {}))
  )}`;
}

function buildResourceAbilityRequests(actionCid) {
  const authHelpers = loadAuthHelpers();
  if (!authHelpers?.ResourceAbilityRequestBuilder) {
    throw new Error("Missing Lit auth helpers for resource ability requests.");
  }

  return new authHelpers.ResourceAbilityRequestBuilder()
    .addLitActionExecutionRequest(actionCid)
    .build();
}

async function createWalletAuthSig({
  client,
  wallet,
  expiration,
  sessionKeyUri,
  resourceAbilityRequests,
}) {
  const authHelpers = loadAuthHelpers();
  if (
    !authHelpers?.createSiweMessageWithRecaps ||
    !authHelpers?.generateAuthSig
  ) {
    throw new Error("Lit auth helper functions are unavailable.");
  }

  const walletAddress = await wallet.getAddress();
  const siweMessage = await authHelpers.createSiweMessageWithRecaps({
    uri: sessionKeyUri,
    expiration,
    resources: resourceAbilityRequests,
    walletAddress,
    nonce: await client.getLatestBlockhash(),
    litNodeClient: client,
    chainId: getLitChainId(),
    domain: process.env.LIT_SIWE_DOMAIN || "localhost",
  });

  return authHelpers.generateAuthSig({
    signer: wallet,
    toSign: siweMessage,
    address: walletAddress,
  });
}

async function createSessionSigs({ actionCid, jsParams }) {
  const wallet = getPrivateKeyWallet();
  if (!wallet) {
    return null;
  }

  const { client } = await resolveClient();
  if (!client || typeof client.getSessionSigs !== "function") {
    return null;
  }

  const cacheKey = buildSessionSigCacheKey({ actionCid, jsParams });
  const cached = sessionSigCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const resourceAbilityRequests = buildResourceAbilityRequests(actionCid);
  const expiration = new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString();
  const sessionSigs = await withTimeout(
    client.getSessionSigs({
      chain: getLitChain(),
      expiration,
      resourceAbilityRequests,
      litActionIpfsId: actionCid,
      jsParams,
      authNeededCallback: async (props) =>
        createWalletAuthSig({
          client,
          wallet,
          expiration: props.expiration,
          sessionKeyUri: props.uri,
          resourceAbilityRequests: props.resourceAbilityRequests,
        }),
    }),
    6000,
    "Lit session sig generation"
  );

  sessionSigCache.set(cacheKey, {
    value: sessionSigs,
    expiresAt: Date.now() + 1000 * 60 * 20,
  });

  return sessionSigs;
}

function parseResultPayload(result) {
  if (result == null) {
    return null;
  }

  const candidates = [result.response, result.output, result.result, result];

  for (const item of candidates) {
    if (item == null) {
      continue;
    }

    if (typeof item === "string") {
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch {
        // Ignore non-JSON strings.
      }
      continue;
    }

    if (typeof item === "object") {
      return item;
    }
  }

  return null;
}

async function getIntegrationStatus({ probeConnection = true } = {}) {
  const cachedWindowMs = 15000;
  if (
    statusCache &&
    statusCache.probeConnection === probeConnection &&
    Date.now() - statusCache.updatedAt < cachedWindowMs
  ) {
    return statusCache.value;
  }

  const loaded = loadSdkModule();
  const hasSessionSigs = Boolean(parseSessionSigs());
  const hasAuthSig = Boolean(parseAuthSig());
  const hasPrivateKey = Boolean(getPrivateKeyWallet());
  const actionCid = String(process.env.LIT_ACTION_CID || "").trim();
  const relayEndpoint = String(process.env.LIT_POLICY_API_URL || "").trim();

  const status = {
    enabled: Boolean(actionCid || relayEndpoint),
    network: getLitNetwork(),
    chain: getLitChain(),
    actionCid: actionCid || null,
    relayEndpoint: relayEndpoint || null,
    sdkInstalled: Boolean(loaded),
    sdkPackage: loaded?.name || null,
    authMode: hasSessionSigs
      ? "session_sigs_env"
      : hasAuthSig
        ? "auth_sig_env"
        : hasPrivateKey
          ? "private_key_session"
          : relayEndpoint
            ? "relay_api"
            : "unconfigured",
    canExecuteAction:
      Boolean(actionCid) &&
      Boolean(loaded) &&
      (hasSessionSigs || hasAuthSig || hasPrivateKey),
    hasSessionSigs,
    hasAuthSig,
    hasPrivateKey,
    probe: {
      ok: null,
      checkedAt: new Date().toISOString(),
      error: null,
    },
  };

  if (probeConnection && loaded) {
    const { client, error } = await resolveClient();
    status.probe.ok = Boolean(client && !error);
    status.probe.error = error || null;
  }

  statusCache = {
    updatedAt: Date.now(),
    probeConnection,
    value: status,
  };

  return status;
}

async function queryPolicyVerdict({ actionCid, blinkPayload }) {
  if (!actionCid) {
    return null;
  }

  const { client } = await resolveClient();
  if (!client) {
    return null;
  }

  const execute =
    (typeof client.executeJs === "function" && client.executeJs.bind(client)) ||
    (typeof client.executeLitAction === "function" &&
      client.executeLitAction.bind(client)) ||
    null;
  if (!execute) {
    return null;
  }

  const serializedPayload = JSON.stringify(blinkPayload || {});
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(serializedPayload));
  const jsParams = {
    blinkPayload,
    payload: serializedPayload,
    payloadHash,
  };

  let sessionSigs = parseSessionSigs();
  let authSig = parseAuthSig();

  if (!sessionSigs && !authSig) {
    try {
      sessionSigs = await createSessionSigs({
        actionCid,
        jsParams,
      });
    } catch {
      sessionSigs = null;
    }
  }

  if (!sessionSigs && !authSig) {
    return null;
  }

  const result = await Promise.resolve(
    execute({
      ipfsId: actionCid,
      ...(sessionSigs ? { sessionSigs } : {}),
      ...(authSig ? { authSig } : {}),
      jsParams,
    })
  );

  const parsedPayload = parseResultPayload(result);
  if (!parsedPayload) {
    return null;
  }

  return {
    verdict: parsedPayload.verdict || parsedPayload.decision,
    safeAmount: parsedPayload.safeAmount ?? parsedPayload.safe_amount,
    reason: parsedPayload.reason,
    sealed: true,
    actionCid,
    via: sessionSigs
      ? parseSessionSigs()
        ? "lit-sdk-session-sigs-env"
        : "lit-sdk-session-sigs-private-key"
      : "lit-sdk-auth-sig-env",
  };
}

module.exports = {
  createSessionSigs,
  getIntegrationStatus,
  parseAuthSig,
  parseSessionSigs,
  queryPolicyVerdict,
  resolveClient,
};
