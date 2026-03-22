const http = require("http");
const path = require("path");
const { URL } = require("url");
const { ethers } = require("ethers");

const {
  buildActionMetadata,
  buildManifest,
  getAction,
  listActions,
} = require("./lib/actionRegistry");
const { ActivityStore } = require("./lib/activityStore");
const { AgentMemoryStore } = require("./lib/agentMemoryStore");
const { ExecutionAdapter } = require("./lib/executionAdapter");
const { parseBlinkUrl, rewriteBlinkUrl } = require("./lib/blinkUrlParser");
const { EnsPolicyStore, normalizeEnsName } = require("./lib/ensPolicyStore");
const { EventStreamHub } = require("./lib/eventStreamHub");
const { evaluateAction } = require("./lib/policyEngine");
const { PolicyWatcher } = require("./lib/policyWatcher");
const { ProofService } = require("./lib/proofService");
const { ProofStore } = require("./lib/proofStore");
const { ShareLinkStore } = require("./lib/shareLinkStore");
const {
  PERSONA_PRESETS,
  evaluateTradingBlink,
} = require("./lib/tradingPolicyEngine");
const zyfaiSdk = require("../sdk/zyfai");
const litSdk = require("../sdk/lit");
const filecoinSdk = require("../sdk/filecoin");

const SAMPLE_BLINKS = [
  {
    id: "influencer-meme",
    label: "Risky influencer Blink",
    url: "https://x.com/moonalpha/status/20991?protocol=uniswap&chain=base&tokenIn=USDC&tokenOut=PEPE&amountUsd=1000&slippageBps=220&liquidityUsd=65000&source=influencer&sender=%40moonalpha",
  },
  {
    id: "ai-bot-eth",
    label: "AI bot Blink",
    url: "https://ai.darkagent.trade/recommendation?protocol=uniswap&chain=base&tokenIn=USDC&tokenOut=ETH&amountUsd=800&slippageBps=80&liquidityUsd=2200000&source=twitter&sender=DeepTrendBot",
  },
  {
    id: "safe-friend",
    label: "Safe friend Blink",
    url: "https://friend.trade/blink?protocol=uniswap&chain=base&tokenIn=USDC&tokenOut=ETH&amountUsd=120&slippageBps=40&liquidityUsd=5300000&source=friend&sender=Riya",
  },
];

const DEFAULT_VERIFIER_CONTRACT =
  process.env.VERIFIER_CONTRACT || process.env.VITE_VERIFIER_CONTRACT || "";
const DEFAULT_WSTETH_CONTRACT =
  process.env.WSTETH_CONTRACT || "0x7eE20C9D4Cd98E51a8CD0989d7E8D5bDe5cA13C";

const TREASURY_ABI = [
  "function availableYieldStETH() view returns (uint256)",
  "function depositedStETH() view returns (uint256)",
  "function principalWstETH() view returns (uint256)",
];

let baseSepoliaProvider = null;

function getBaseSepoliaProvider() {
  if (!baseSepoliaProvider) {
    baseSepoliaProvider = new ethers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      {
        chainId: 84532,
        name: "base-sepolia",
      },
      {
        staticNetwork: true,
      }
    );
  }
  return baseSepoliaProvider;
}

function parseUsd(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readConfiguredEnv(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const normalized = raw.toLowerCase();
  if (
    normalized === "todo" ||
    normalized.startsWith("paste_") ||
    normalized.includes("your space did") ||
    normalized.includes("if you already created one")
  ) {
    return "";
  }

  return raw;
}

const EXTERNAL_REQUEST_TIMEOUT_MS = parsePositiveNumber(
  process.env.DARKAGENT_EXTERNAL_TIMEOUT_MS,
  7000
);
const FILECOIN_UPLOAD_TIMEOUT_MS = parsePositiveNumber(
  process.env.DARKAGENT_FILECOIN_UPLOAD_TIMEOUT_MS,
  15000
);
const FILECOIN_TOTAL_TIMEOUT_MS = parsePositiveNumber(
  process.env.DARKAGENT_FILECOIN_TOTAL_TIMEOUT_MS,
  Math.max(FILECOIN_UPLOAD_TIMEOUT_MS * 3, 45000)
);
const FILECOIN_UPLOAD_RETRIES = Math.max(
  1,
  parsePositiveNumber(process.env.FILECOIN_UPLOAD_RETRIES, 2)
);
const FILECOIN_RETRY_DELAY_MS = parsePositiveNumber(
  process.env.FILECOIN_RETRY_DELAY_MS,
  1200
);

async function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = EXTERNAL_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRetryableFilecoinError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return [
    "timed out",
    "timeout",
    "fetch failed",
    "network",
    "econnreset",
    "eai_again",
    "socket",
    "temporarily unavailable",
    "429",
    "503",
    "502",
  ].some((token) => message.includes(token));
}

async function withRetries(operation, options = {}) {
  const attempts = Math.max(1, Number(options.attempts || 1));
  const delayMs = Math.max(0, Number(options.delayMs || 0));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableFilecoinError(error)) {
        break;
      }
      await sleep(delayMs * attempt);
    }
  }

  throw lastError;
}

async function fetchTreasurySnapshot() {
  const treasuryAddress = String(process.env.AGENT_TREASURY_CONTRACT || "").trim();
  if (!treasuryAddress || !ethers.isAddress(treasuryAddress)) {
    return {
      configured: false,
      budgetSource: "policy",
      yieldBudgetUsd: null,
      principalLockedUsd: null,
      principalLocked: false,
    };
  }

  try {
    const provider = getBaseSepoliaProvider();
    const treasury = new ethers.Contract(treasuryAddress, TREASURY_ABI, provider);
    const [yieldWei, depositedWei, principalWei] = await Promise.all([
      treasury.availableYieldStETH(),
      treasury.depositedStETH(),
      treasury.principalWstETH(),
    ]);

    const stethUsdPrice = parseUsd(process.env.STETH_USD_PRICE, 1);
    const yieldBudgetUsd = Number(ethers.formatEther(yieldWei)) * stethUsdPrice;
    const principalLockedUsd = Number(ethers.formatEther(depositedWei || principalWei)) * stethUsdPrice;

    return {
      configured: true,
      contract: treasuryAddress,
      wstETH: DEFAULT_WSTETH_CONTRACT,
      budgetSource: "wstETH_yield_only",
      yieldBudgetUsd,
      principalLockedUsd,
      principalLocked: true,
    };
  } catch (error) {
    return {
      configured: true,
      contract: treasuryAddress,
      wstETH: DEFAULT_WSTETH_CONTRACT,
      budgetSource: "wstETH_yield_only",
      yieldBudgetUsd: null,
      principalLockedUsd: null,
      principalLocked: true,
      error: error.message,
    };
  }
}

function applyTreasuryBudget(policy, treasurySnapshot) {
  if (!policy) {
    return policy;
  }
  if (!treasurySnapshot?.configured || !Number.isFinite(treasurySnapshot.yieldBudgetUsd)) {
    return policy;
  }

  const nextMaxTrade = Math.max(
    0,
    Math.min(
      Number(policy.maxTradeUsd || 0),
      Number(treasurySnapshot.yieldBudgetUsd)
    )
  );

  return {
    ...policy,
    maxTradeUsd: nextMaxTrade,
    budgetSource: treasurySnapshot.budgetSource,
    principalLocked: true,
    treasury: treasurySnapshot,
  };
}

async function queryLitPolicyVerdict(blinkPayload) {
  const actionCid = String(process.env.LIT_ACTION_CID || "").trim() || null;

  // Preferred path for Lit track: execute a sealed Lit Action through SDK.
  const sdkVerdict = await withTimeout(
    litSdk.queryPolicyVerdict({
      actionCid,
      blinkPayload,
    }),
    EXTERNAL_REQUEST_TIMEOUT_MS,
    "Lit policy SDK"
  );
  if (sdkVerdict) {
    return sdkVerdict;
  }

  // Legacy fallback path for environments that still use an external relay API.
  const endpoint = String(process.env.LIT_POLICY_API_URL || "").trim();
  if (!endpoint) {
    return actionCid ? { actionCid } : null;
  }

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LIT_API_KEY
        ? { Authorization: `Bearer ${process.env.LIT_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      blinkPayload,
      actionCid: actionCid || undefined,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Lit policy query failed with status ${response.status}. ${details}`);
  }

  const payload = await response.json();
  return {
    verdict: payload.verdict || payload.decision,
    safeAmount: payload.safeAmount ?? payload.safe_amount,
    reason: payload.reason,
    sealed: payload.sealed !== false,
    actionCid: payload.actionCid || actionCid,
  };
}

async function getZyfaiYieldBalance() {
  const simulated = parseUsd(process.env.ZYFAI_SIMULATED_YIELD_USDC, NaN);
  if (Number.isFinite(simulated)) {
    return simulated;
  }

  const balance = await zyfaiSdk.getYieldBalance();
  return balance == null ? null : parseUsd(balance, 0);
}

async function spendZyfaiYield(amount) {
  const simulated = parseUsd(process.env.ZYFAI_SIMULATED_YIELD_USDC, NaN);
  if (Number.isFinite(simulated)) {
    return { simulated: true, amount };
  }

  return zyfaiSdk.spendYield({
    amount,
    destination: process.env.VENICE_PAYMENT_ADDRESS || process.env.DEPLOYER_ADDRESS || "",
    description: "Venice AI inference payment",
  });
}

async function uploadViaUcanClient(record) {
  const email = readConfiguredEnv(process.env.FILECOIN_W3UP_EMAIL);
  if (!email) {
    return null;
  }

  const { create } = require("@web3-storage/w3up-client");
  const client = await create();
  await client.login(email);

  const configuredSpaceDid = readConfiguredEnv(process.env.FILECOIN_SPACE_DID);
  if (configuredSpaceDid) {
    await client.setCurrentSpace(configuredSpaceDid);
  }

  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: "application/json",
  });
  const file = new File([blob], "darkagent-execution-record.json");
  const cid = await client.uploadFile(file);
  return String(cid);
}

async function uploadExecutionRecordToFilecoin(record) {
  const endpoint = readConfiguredEnv(process.env.FILECOIN_UPLOAD_ENDPOINT)
    .trim()
    .replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/i, "");
  const focEnabled = String(process.env.FILECOIN_FOC_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";
  const ucanEnabled = String(process.env.FILECOIN_UCAN_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";
  const lighthouseToken = readConfiguredEnv(process.env.FILECOIN_API_KEY);
  const web3Token = readConfiguredEnv(
    process.env.WEB3_STORAGE_TOKEN || process.env.FILECOIN_WEB3_STORAGE_TOKEN
  );
  const w3upEmail = readConfiguredEnv(process.env.FILECOIN_W3UP_EMAIL);

  if (
    !focEnabled &&
    !endpoint &&
    !web3Token &&
    !w3upEmail
  ) {
    return null;
  }

  const lighthouseCandidates = endpoint.includes("node.lighthouse.storage")
    ? [endpoint, endpoint.replace("node.lighthouse.storage", "api.lighthouse.storage")]
    : [endpoint];

  const uploadToEndpoint = async (target) => {
    if (target.includes("api.nft.storage/upload")) {
      const blob = new Blob([JSON.stringify(record, null, 2)], {
        type: "application/json",
      });
      return fetchWithTimeout(target, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lighthouseToken}`,
          "Content-Type": "application/json",
        },
        body: blob,
      });
    }

    if (target.includes("lighthouse.storage/api/v0/add")) {
      const form = new FormData();
      const blob = new Blob([JSON.stringify(record, null, 2)], {
        type: "application/json",
      });
      form.append("file", blob, "darkagent-execution-record.json");
      const response = await fetchWithTimeout(target, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lighthouseToken}`,
        },
        body: form,
      });
      return response;
    }

    return fetchWithTimeout(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lighthouseToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
    });
  };

  const uploadViaWeb3Storage = async () => {
    const { Web3Storage } = require("web3.storage");
    const client = new Web3Storage({ token: web3Token });
    const blob = new Blob([JSON.stringify(record, null, 2)], {
      type: "application/json",
    });
    const file = new File([blob], "darkagent-execution-record.json");
    return client.put([file]);
  };

  const uploadErrors = [];

  if (focEnabled) {
    try {
      const uploaded = await withTimeout(
        filecoinSdk.uploadToFOC(record, {
          attempts: FILECOIN_UPLOAD_RETRIES,
          delayMs: FILECOIN_RETRY_DELAY_MS,
        }),
        FILECOIN_UPLOAD_TIMEOUT_MS,
        "Filecoin FOC upload"
      );
      if (uploaded?.pieceCid) {
        return uploaded.pieceCid;
      }
    } catch (error) {
      uploadErrors.push(`foc-synapse: ${error.message || error}`);
    }
  }

  if (ucanEnabled) {
    try {
      const cid = await withRetries(
        () =>
          withTimeout(
            uploadViaUcanClient(record),
            FILECOIN_UPLOAD_TIMEOUT_MS,
            "Filecoin UCAN upload"
          ),
        {
          attempts: FILECOIN_UPLOAD_RETRIES,
          delayMs: FILECOIN_RETRY_DELAY_MS,
        }
      );
      if (cid) {
        return cid;
      }
    } catch (error) {
      uploadErrors.push(`w3up-ucan: ${error.message || error}`);
    }
  }

  if (endpoint.includes("api.nft.storage/upload")) {
    uploadErrors.push(
      "legacy nft.storage upload endpoint configured; prefer UCAN via FILECOIN_W3UP_EMAIL/FILECOIN_SPACE_DID"
    );
  }

  if (endpoint && lighthouseToken) {
    for (const candidate of lighthouseCandidates) {
      try {
        const response = await withRetries(
          () =>
            withTimeout(
              uploadToEndpoint(candidate),
              FILECOIN_UPLOAD_TIMEOUT_MS,
              `Filecoin endpoint upload (${candidate})`
            ),
          {
            attempts: FILECOIN_UPLOAD_RETRIES,
            delayMs: FILECOIN_RETRY_DELAY_MS,
          }
        );
        if (!response.ok) {
          const details = await response.text().catch(() => "");
          uploadErrors.push(`${candidate}: status ${response.status} ${details}`);
          continue;
        }
        const payload = await response.json().catch(() => ({}));
        return payload.Hash || payload.cid || payload.value?.cid || payload.ipfsCid || null;
      } catch (error) {
        uploadErrors.push(`${candidate}: ${error.message || error}`);
      }
    }
  }

  if (web3Token) {
    try {
      return await withRetries(
        () =>
          withTimeout(
            uploadViaWeb3Storage(),
            FILECOIN_UPLOAD_TIMEOUT_MS,
            "web3.storage upload"
          ),
        {
          attempts: FILECOIN_UPLOAD_RETRIES,
          delayMs: FILECOIN_RETRY_DELAY_MS,
        }
      );
    } catch (error) {
      uploadErrors.push(`web3.storage: ${error.message || error}`);
    }
  }

  if (uploadErrors.length === 0) {
    return null;
  }

  throw new Error(`Filecoin upload failed. ${uploadErrors.join(" | ")}`);
}

function normalizeCid(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  return raw.replace(/^ipfs:\/\//i, "").replace(/^\/ipfs\//i, "");
}

function buildFilecoinGateways() {
  const configured = String(process.env.FILECOIN_RETRIEVE_GATEWAYS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  return [
    "https://w3s.link/ipfs",
    "https://nftstorage.link/ipfs",
    "https://ipfs.io/ipfs",
  ];
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function retrieveFilecoinJson(cid) {
  const normalizedCid = normalizeCid(cid);
  if (!normalizedCid) {
    return null;
  }

  const focEnabled = String(process.env.FILECOIN_FOC_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";

  if (focEnabled) {
    try {
      const payload = await filecoinSdk.downloadFromFOC(normalizedCid);
      if (payload && typeof payload === "object") {
        return {
          cid: normalizedCid,
          gateway: "foc-synapse",
          payload,
        };
      }
    } catch {
      // Fall through to gateway retrieval.
    }
  }

  const errors = [];
  for (const gateway of buildFilecoinGateways()) {
    const url = `${gateway.replace(/\/$/, "")}/${normalizedCid}`;
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        errors.push(`${url}: status ${response.status}`);
        continue;
      }

      const text = await response.text();
      const payload = safeJsonParse(text);
      if (payload == null) {
        errors.push(`${url}: invalid JSON payload`);
        continue;
      }

      return {
        cid: normalizedCid,
        gateway: url,
        payload,
      };
    } catch (error) {
      errors.push(`${url}: ${error.message || error}`);
    }
  }

  throw new Error(`Filecoin retrieval failed. ${errors.join(" | ")}`);
}

async function generateMemoryAnswerWithVenice({ ensName, prompt, priorMemory }) {
  const key = String(process.env.VENICE_API_KEY || "").trim();
  if (!key) {
    const error = new Error("VENICE_API_KEY is not configured.");
    error.code = "VENICE_KEY_MISSING";
    throw error;
  }

  const model = process.env.VENICE_MODEL || "llama-3.3-70b";
  const systemPrompt = `You are DarkAgent, an autonomous assistant with persistent decentralized memory.
Use prior memory when present, but never fabricate facts.
Return ONLY raw JSON:
{
  "answer": "",
  "memory_used": true,
  "memory_summary": ""
}`;

  const response = await fetchWithTimeout("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 350,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            ensName,
            prompt,
            priorMemory: priorMemory || null,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Venice request failed with status ${response.status}. ${details}`);
  }

  const data = await response.json();
  const raw = String(data?.choices?.[0]?.message?.content || "").trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function toDecisionFromVerdict(verdict) {
  const normalized = String(verdict || "").trim().toUpperCase();
  if (normalized === "BLOCK") return "block";
  if (normalized === "DOWNSIZE") return "auto-downsize";
  return "allow";
}

async function scoreWithVenice(blinkPayload, ensPolicy) {
  const key = String(process.env.VENICE_API_KEY || "").trim();
  if (!key) {
    const error = new Error("VENICE_API_KEY is not configured.");
    error.code = "VENICE_KEY_MISSING";
    throw error;
  }

  const systemPrompt = `You are a private DeFi compliance agent embedded in DarkAgent.
Evaluate this transaction request against the user's ENS policy rules.
Return ONLY raw JSON with these fields:
{
  "score": <0-100>,
  "verdict": <"BLOCK" | "DOWNSIZE" | "ALLOW">,
  "reason": "",
  "safe_amount": <number>
}`;

  const model = process.env.VENICE_MODEL || "llama-3.3-70b";
  const response = await fetchWithTimeout("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            blink: blinkPayload,
            policy: ensPolicy,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    const error = new Error(`Venice request failed with status ${response.status}. ${details}`);
    error.code = "VENICE_HTTP_ERROR";
    throw error;
  }

  const data = await response.json();
  const raw = String(data?.choices?.[0]?.message?.content || "").trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function shouldBypassPayment() {
  return String(process.env.NODE_ENV || "development") !== "production";
}

function hasPaymentProof(request) {
  return Boolean(
    request.headers["x-payment-proof"] ||
      request.headers["x-payment-token"] ||
      request.headers["authorization"]
  );
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function writeSvg(response, svg) {
  response.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(svg);
}

function writeHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(html);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderProofRow(label, value, href = "") {
  if (value == null || value === "") {
    return "";
  }

  const renderedValue = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        value
      )}</a>`
    : `<span>${escapeHtml(value)}</span>`;

  return `
    <div class="row">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${renderedValue}</div>
    </div>
  `;
}

function buildProofViewHtml({ proof, requestUrl }) {
  const baseExplorer = getExplorerBase();
  const filecoinCid = normalizeCid(proof?.integrations?.filecoinCid || "");
  const litActionCid = normalizeCid(proof?.integrations?.litActionCid || "");
  const jsonHref = `${requestUrl.origin}/api/proofs/${proof.id}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DarkAgent Proof ${escapeHtml(proof.id)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #091019;
        --panel: #0f1724;
        --panel-2: #101b2a;
        --border: #20304a;
        --text: #e6eef8;
        --muted: #8da1bd;
        --accent: #43c0ff;
        --good: #35d39a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #12243b, var(--bg) 48%);
        color: var(--text);
      }
      .wrap {
        max-width: 860px;
        margin: 0 auto;
        padding: 32px 18px 56px;
      }
      .card {
        background: rgba(15, 23, 36, 0.94);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      }
      .eyebrow {
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 11px;
        margin-bottom: 10px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
        line-height: 1.15;
      }
      .sub {
        color: var(--muted);
        font-size: 14px;
        margin-bottom: 24px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(53, 211, 154, 0.35);
        color: var(--good);
        background: rgba(53, 211, 154, 0.1);
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 12px;
        margin-bottom: 18px;
      }
      .grid {
        display: grid;
        gap: 12px;
      }
      .row {
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr);
        gap: 14px;
        padding: 12px 14px;
        border-radius: 12px;
        background: var(--panel-2);
        border: 1px solid rgba(32, 48, 74, 0.75);
      }
      .label {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .value, .value span, .value a {
        min-width: 0;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
        color: var(--text);
      }
      .value a {
        color: var(--accent);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        color: var(--text);
        border: 1px solid var(--border);
        background: #132132;
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 13px;
      }
      @media (max-width: 640px) {
        .row {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="eyebrow">DarkAgent Proof Receipt</div>
        <h1>${escapeHtml(proof.kind || "proof")}</h1>
        <div class="sub">${escapeHtml(
          proof.reason || "Signed policy and execution receipt."
        )}</div>
        <div class="pill">${proof.verified ? "Verified signature" : "Unverified signature"}</div>
        <div class="grid">
          ${renderProofRow("Proof ID", proof.id)}
          ${renderProofRow("Verdict", proof.verdict)}
          ${renderProofRow("ENS Profile", proof.ensName)}
          ${renderProofRow("Action", proof.actionId)}
          ${renderProofRow("Created", proof.createdAt)}
          ${renderProofRow("Signer", proof.signerAddress, buildAddressLink(baseExplorer, proof.signerAddress))}
          ${renderProofRow("Recovered Signer", proof.recoveredSigner, buildAddressLink(baseExplorer, proof.recoveredSigner))}
          ${renderProofRow("Stealth Address", proof.stealthAddress, buildAddressLink(baseExplorer, proof.stealthAddress))}
          ${renderProofRow("Receipt Hash", proof.receiptHash)}
          ${renderProofRow("Policy Hash", proof.policyHash)}
          ${renderProofRow("Evaluation Hash", proof.evaluationHash)}
          ${renderProofRow("Execution Hash", proof.executionHash)}
          ${renderProofRow("Execution Mode", proof.executionMode)}
          ${renderProofRow("Filecoin CID", filecoinCid, filecoinCid ? `https://calibration.filfox.info/en/message/${filecoinCid}` : "")}
          ${renderProofRow("Lit Action CID", litActionCid, litActionCid ? `https://ipfs.io/ipfs/${litActionCid}` : "")}
          ${renderProofRow("Funding Source", proof?.integrations?.fundedBy)}
          ${renderProofRow("Budget Source", proof?.integrations?.budgetSource)}
        </div>
        <div class="actions">
          <a class="btn" href="${escapeHtml(jsonHref)}" target="_blank" rel="noopener noreferrer">Open raw JSON</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

function getBaseUrl(request) {
  const host = request.headers.host || "localhost:8787";
  return `http://${host}`;
}

function isHexAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function isTxHash(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(value || ""));
}

function isMockTxId(value) {
  return String(value || "").startsWith("mocktx_");
}

function isIpfsCid(value) {
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}|^bafy[a-zA-Z0-9]{20,}|^bafk[a-zA-Z0-9]{20,}$/.test(
    String(value || "")
  );
}

function pushEvidence(evidence, label, value, href) {
  if (!value) {
    return;
  }

  evidence.push({
    label,
    value,
    href: href || null,
  });
}

function sponsorStatus({ ready = false, configured = false }) {
  if (ready) {
    return "ready";
  }
  if (configured) {
    return "configured";
  }
  return "pending";
}

function getExplorerBase() {
  return String(process.env.BASE_EXPLORER_URL || "https://sepolia.basescan.org").trim();
}

function getStatusExplorerBase() {
  return String(
    process.env.STATUS_EXPLORER_URL || "https://sepolia.status.network"
  ).trim();
}

function buildTxLink(explorerBase, hash) {
  if (!isTxHash(hash)) {
    return null;
  }
  return `${explorerBase}/tx/${hash}`;
}

function buildAddressLink(explorerBase, address) {
  if (!isHexAddress(address)) {
    return null;
  }
  return `${explorerBase}/address/${address}`;
}

function buildEnsLink(ensName) {
  const value = String(ensName || "").trim();
  if (!value) {
    return null;
  }

  return `https://app.ens.domains/${value}`;
}

function getLatestBy(entries, predicate) {
  return (entries || []).find((entry) => predicate(entry)) || null;
}

function getSponsorEvidenceEnv() {
  return {
    treasuryDepositTx: readConfiguredEnv(process.env.TREASURY_DEPOSIT_TX_HASH),
    filecoinCid: readConfiguredEnv(
      process.env.FILECOIN_LAST_TEST_CID || process.env.FILECOIN_PIECE_CID || ""
    ),
    statusDeployTx: readConfiguredEnv(process.env.STATUS_DEPLOY_TX_HASH),
    statusExecutionTx: readConfiguredEnv(process.env.STATUS_EXECUTION_TX_HASH),
    baseProposeTx: readConfiguredEnv(process.env.BASE_PROPOSE_TX_HASH),
    baseVerifyTx: readConfiguredEnv(process.env.BASE_VERIFY_TX_HASH),
    baseExecuteTx: readConfiguredEnv(process.env.BASE_EXECUTE_TX_HASH),
  };
}

async function buildIntegrationState({
  baseUrl,
  policyStore,
  watcher,
  activityStore,
  proofStore,
}) {
  const policies = buildPolicyState(policyStore, watcher);
  const storedPolicies = policyStore.readAll();
  const activity = activityStore.readAll();
  const proofs = proofStore.readAll();
  const latestProof = proofs[0] || null;
  const latestExecutionProof = getLatestBy(
    proofs,
    (entry) => entry.kind === "blink-execution"
  );
  const latestExecution = getLatestBy(
    activity,
    (entry) => entry.type === "execution"
  );
  const latestAnalysis = getLatestBy(activity, (entry) => entry.type === "analysis");
  const latestFilecoin = getLatestBy(
    activity,
    (entry) => entry.type === "filecoin" && entry.status === "stored"
  );
  const latestFilecoinFailure = getLatestBy(
    activity,
    (entry) => entry.type === "filecoin" && entry.status === "failed"
  );
  const firstPolicy = policies[0] || null;
  const firstStoredPolicy =
    storedPolicies[firstPolicy?.ensName || Object.keys(storedPolicies)[0]] || null;
  const sponsorEnv = getSponsorEvidenceEnv();
  const baseExplorer = getExplorerBase();
  const statusExplorer = getStatusExplorerBase();
  const litStatus = await litSdk.getIntegrationStatus({
    probeConnection: false,
  });

  const filecoinCid =
    latestExecutionProof?.integrations?.filecoinCid ||
    latestFilecoin?.cid ||
    sponsorEnv.filecoinCid ||
    null;
  const filecoinCidSource = latestExecutionProof?.integrations?.filecoinCid
    ? "latest-proof"
    : latestFilecoin?.cid
      ? "activity"
      : sponsorEnv.filecoinCid
        ? "env"
        : null;

  const baseEvidence = [];
  const hasLiveBaseReceipt =
    Boolean(buildTxLink(baseExplorer, latestExecution?.txid)) ||
    Boolean(buildTxLink(baseExplorer, sponsorEnv.baseProposeTx)) ||
    Boolean(buildTxLink(baseExplorer, sponsorEnv.baseVerifyTx)) ||
    Boolean(buildTxLink(baseExplorer, sponsorEnv.baseExecuteTx));
  pushEvidence(
    baseEvidence,
    "Latest execution receipt",
    isTxHash(latestExecution?.txid) ? latestExecution?.txid : null,
    buildTxLink(baseExplorer, latestExecution?.txid)
  );
  pushEvidence(
    baseEvidence,
    "Verifier contract",
    DEFAULT_VERIFIER_CONTRACT,
    buildAddressLink(baseExplorer, DEFAULT_VERIFIER_CONTRACT)
  );
  pushEvidence(
    baseEvidence,
    "x402 payment rail",
    `${process.env.X402_AMOUNT || "0.001"} ${process.env.X402_CURRENCY || "USDC"} on ${
      process.env.X402_NETWORK || "base-sepolia"
    }`
  );
  pushEvidence(
    baseEvidence,
    "Propose tx",
    sponsorEnv.baseProposeTx,
    buildTxLink(baseExplorer, sponsorEnv.baseProposeTx)
  );
  pushEvidence(
    baseEvidence,
    "Verify tx",
    sponsorEnv.baseVerifyTx,
    buildTxLink(baseExplorer, sponsorEnv.baseVerifyTx)
  );
  pushEvidence(
    baseEvidence,
    "Execute tx",
    sponsorEnv.baseExecuteTx,
    buildTxLink(baseExplorer, sponsorEnv.baseExecuteTx)
  );

  const ensEvidence = [];
  pushEvidence(
    ensEvidence,
    "Primary profile",
    firstPolicy?.ensName || null,
    buildEnsLink(firstPolicy?.ensName)
  );
  pushEvidence(
    ensEvidence,
    "Allowed protocols",
    (firstStoredPolicy?.trustedProtocols || []).join(", ")
  );

  const filecoinEvidence = [];
  pushEvidence(
    filecoinEvidence,
    filecoinCidSource === "env" ? "Verified fallback CID" : "Piece CID",
    filecoinCid,
    filecoinCid
      ? `https://calibration.filfox.info/en/message/${filecoinCid}`
      : null
  );
  const litEvidence = [];
  pushEvidence(
    litEvidence,
    "Lit Action CID",
    litStatus.actionCid,
    litStatus.actionCid ? `https://ipfs.io/ipfs/${litStatus.actionCid}` : null
  );
  pushEvidence(
    litEvidence,
    "Auth mode",
    litStatus.authMode
  );
  const zyfaiEvidence = [];
  pushEvidence(
    zyfaiEvidence,
    "Funding mode",
    latestProof?.integrations?.fundedBy === "zyfai_yield"
      ? "Yield-funded inference"
      : String(process.env.ZYFAI_SIMULATED_YIELD_USDC || "").trim()
        ? "Simulated yield"
        : String(process.env.ZYFAI_API_KEY || "").trim()
          ? "SDK configured"
          : null
  );

  const lidoEvidence = [];
  pushEvidence(
    lidoEvidence,
    "Treasury contract",
    process.env.AGENT_TREASURY_CONTRACT,
    buildAddressLink(baseExplorer, process.env.AGENT_TREASURY_CONTRACT)
  );
  pushEvidence(
    lidoEvidence,
    "Treasury deposit tx",
    sponsorEnv.treasuryDepositTx,
    buildTxLink(baseExplorer, sponsorEnv.treasuryDepositTx)
  );
  pushEvidence(
    lidoEvidence,
    "Budget mode",
    firstPolicy?.synced?.budgetSource || null
  );

  const statusEvidence = [];
  pushEvidence(
    statusEvidence,
    "Status deploy tx",
    sponsorEnv.statusDeployTx,
    buildTxLink(statusExplorer, sponsorEnv.statusDeployTx)
  );
  pushEvidence(
    statusEvidence,
    "Status execution tx",
    sponsorEnv.statusExecutionTx,
    buildTxLink(statusExplorer, sponsorEnv.statusExecutionTx)
  );
  pushEvidence(
    statusEvidence,
    "RPC",
    process.env.STATUS_SEPOLIA_RPC || "https://public.sepolia.rpc.status.network"
  );

  return {
    sponsors: [
      {
        key: "base",
        name: "Base",
        track: "Agent Services",
        status: sponsorStatus({
          ready: hasLiveBaseReceipt,
          configured: true,
        }),
        detail: isTxHash(latestExecution?.txid)
          ? "Live Base execution receipts are available on the explorer."
          : latestExecution?.txid
            ? "Execution completed in mock mode, so there is no public explorer receipt."
          : "The Base execution and payment rails are wired; add a fresh execution to surface live receipts.",
        evidence: baseEvidence,
      },
      {
        key: "ens",
        name: "ENS Identity",
        track: "Identity",
        status: sponsorStatus({
          ready: Boolean(firstPolicy?.ensName),
          configured: Boolean(firstPolicy),
        }),
        detail: firstPolicy?.ensName
          ? "Policies are keyed by ENS profile and sync into execution guardrails."
          : "No ENS policy profile has been loaded yet.",
        evidence: ensEvidence,
      },
      {
        key: "filecoin",
        name: "Filecoin",
        track: "Agentic Storage",
        status: sponsorStatus({
          ready: Boolean(filecoinCid),
          configured:
            String(process.env.FILECOIN_FOC_ENABLED || "true").trim().toLowerCase() !==
              "false" ||
            Boolean(process.env.FILECOIN_UPLOAD_ENDPOINT) ||
            Boolean(process.env.WEB3_STORAGE_TOKEN) ||
            Boolean(process.env.FILECOIN_W3UP_EMAIL),
        }),
        detail: filecoinCid
          ? filecoinCidSource === "env"
            ? latestFilecoinFailure?.reason
              ? `Latest Filecoin upload failed: ${latestFilecoinFailure.reason}. Showing the last verified Filecoin proof in the meantime.`
              : "Showing the last verified Filecoin proof from environment-backed evidence."
            : "Execution records are persisted with a retrievable storage proof."
          : latestFilecoinFailure?.reason
            ? `Latest Filecoin upload failed: ${latestFilecoinFailure.reason}`
            : "Storage backends are configured, but no persisted execution CID is available yet.",
        evidence: filecoinEvidence,
      },
      {
        key: "lit",
        name: "Lit Protocol",
        track: "Dark Knowledge",
        status: sponsorStatus({
          ready: Boolean(
            litStatus.actionCid &&
              (litStatus.hasSessionSigs ||
                litStatus.hasAuthSig ||
                litStatus.hasPrivateKey)
          ),
          configured: Boolean(litStatus.actionCid || litStatus.relayEndpoint),
        }),
        detail: litStatus.actionCid
          ? `Sealed policy execution is wired through ${litStatus.authMode}.`
          : "Configure a Lit Action CID or relay endpoint to seal policy checks.",
        evidence: litEvidence,
      },
      {
        key: "zyfai",
        name: "Zyfai",
        track: "Yield Powered Agent",
        status: sponsorStatus({
          ready: latestProof?.integrations?.fundedBy === "zyfai_yield",
          configured:
            Boolean(process.env.ZYFAI_API_KEY) ||
            Boolean(process.env.ZYFAI_SIMULATED_YIELD_USDC),
        }),
        detail:
          latestProof?.integrations?.fundedBy === "zyfai_yield"
            ? "Inference in the latest run was paid from yield."
            : "Yield-backed inference is configured but has not funded the latest proof yet.",
        evidence: zyfaiEvidence,
      },
      {
        key: "lido",
        name: "Lido",
        track: "stETH Treasury",
        status: sponsorStatus({
          ready: Boolean(
            firstPolicy?.synced?.budgetSource &&
              String(firstPolicy.synced.budgetSource).toLowerCase().includes("yield")
          ),
          configured: Boolean(process.env.AGENT_TREASURY_CONTRACT),
        }),
        detail: process.env.AGENT_TREASURY_CONTRACT
          ? "Treasury-aware policy budgets can clamp spend to available yield."
          : "Treasury contract is not configured yet.",
        evidence: lidoEvidence,
      },
      {
        key: "status",
        name: "Status Network",
        track: "Gasless Deploy",
        status: sponsorStatus({
          ready: Boolean(sponsorEnv.statusDeployTx || sponsorEnv.statusExecutionTx),
          configured: Boolean(process.env.STATUS_SEPOLIA_RPC),
        }),
        detail:
          sponsorEnv.statusDeployTx || sponsorEnv.statusExecutionTx
            ? "Status Sepolia evidence has been attached."
            : "Status Sepolia network targeting is configured; add tx hashes to surface live proof links.",
        evidence: statusEvidence,
      },
    ],
    latestAnalysis: latestAnalysis || null,
    latestExecution: latestExecution || null,
    latestProof: latestProof || null,
  };
}

function buildPolicyState(store, watcher) {
  const storedPolicies = store.readAll();

  return Object.keys(storedPolicies).map((ensName) => {
    const stored = storedPolicies[ensName];
    const synced = watcher.getPolicy(ensName);
    return {
      ensName,
      stored,
      synced,
      pendingSync:
        Boolean(stored?.updatedAt) &&
        Boolean(synced?.updatedAt) &&
        stored.updatedAt !== synced.updatedAt,
    };
  });
}

function getDarkAgentIcon() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none">
  <rect width="256" height="256" rx="48" fill="#0B1118"/>
  <rect x="28" y="28" width="200" height="200" rx="32" fill="#121A23" stroke="#1F2937" stroke-width="4"/>
  <path d="M72 138L111 99L145 133L184 94" stroke="#00FF88" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M72 173H184" stroke="#1D4ED8" stroke-width="14" stroke-linecap="round"/>
  <circle cx="72" cy="72" r="16" fill="#1D4ED8"/>
  <circle cx="184" cy="72" r="16" fill="#00FF88"/>
  <circle cx="128" cy="184" r="16" fill="#F97316"/>
</svg>
  `.trim();
}

function buildDynamicActionFromBlink(parsedBlink) {
  return {
    id: `${parsedBlink.protocol}-blink`,
    protocol: parsedBlink.protocol,
    sourceChain: parsedBlink.chain === "base" ? "base" : "social",
    settlementChain: "base",
  };
}

function buildBlinkExecutionPayload(ensName, parsedBlink, analysis) {
  return {
    ensName,
    account: parsedBlink.sourceName,
    amountUsd: analysis.executionAmountUsd,
    tokenIn: parsedBlink.tokenIn,
    tokenOut: parsedBlink.tokenOut,
    slippageBps: parsedBlink.slippageBps,
    protocol: parsedBlink.protocol,
    sourceCategory: parsedBlink.sourceCategory,
    rawUrl: parsedBlink.rawUrl,
  };
}

function createBlinkProxyServer(options = {}) {
  const rootDir = options.rootDir || __dirname;
  const dataDir = options.dataDir || path.join(rootDir, "data");
  const eventHub = new EventStreamHub();
  const policyStore = new EnsPolicyStore({
    statePath: path.join(dataDir, "ens-policies.json"),
    seedPath: path.join(dataDir, "ens-policies.seed.json"),
  });
  const activityStore = new ActivityStore({
    filePath: path.join(dataDir, "activity-log.json"),
  });
  const agentMemoryStore = new AgentMemoryStore({
    filePath: path.join(dataDir, "agent-memory-cids.json"),
  });
  const proofStore = new ProofStore({
    filePath: path.join(dataDir, "proofs.json"),
  });
  const shareLinkStore = new ShareLinkStore({
    filePath: path.join(dataDir, "share-links.json"),
  });
  const executor = new ExecutionAdapter({
    mode: options.executionMode,
  });
  const proofService = new ProofService({
    store: proofStore,
    eventHub,
  });
  const watcher = new PolicyWatcher({
    store: policyStore,
    executor,
    intervalMs:
      options.watchIntervalMs ||
      Number(process.env.DARKAGENT_WATCH_INTERVAL_MS || 15000),
    onSync: (syncResult) => {
      eventHub.publish("watcher", {
        ...syncResult,
        watcher: watcher.getStatus(),
      });
    },
  });

  function appendActivity(entry) {
    const nextEntry = activityStore.append(entry);
    eventHub.publish("activity", nextEntry);
    return nextEntry;
  }

  async function buildDemoState(baseUrl) {
    return {
      manifest: buildManifest(baseUrl),
      registry: listActions(),
      policies: buildPolicyState(policyStore, watcher),
      watcher: watcher.getStatus(),
      activity: activityStore.readAll(),
      proofs: proofStore.readAll(),
      proofSigner: proofService.getStatus(),
      personas: PERSONA_PRESETS,
      samples: SAMPLE_BLINKS,
      shares: Object.values(shareLinkStore.readAll()),
      integrations: await buildIntegrationState({
        baseUrl,
        policyStore,
        watcher,
        activityStore,
        proofStore,
      }),
      live: {
        subscribers: eventHub.getStatus().subscribers,
      },
      defaults: {
        ensName: "alice.eth",
        blinkUrl: SAMPLE_BLINKS[0].url,
      },
    };
  }

  async function runUrlAnalysis({ ensName, blinkUrl }) {
    const normalizedEnsName = normalizeEnsName(ensName);
    if (!blinkUrl) {
      const error = new Error("Blink URL is required.");
      error.statusCode = 400;
      throw error;
    }

    const basePolicy = watcher.getPolicy(normalizedEnsName) || policyStore.get(normalizedEnsName);
    const treasurySnapshot = await fetchTreasurySnapshot();
    const policy = applyTreasuryBudget(basePolicy, treasurySnapshot);
    let parsedBlink;

    try {
      parsedBlink = parseBlinkUrl(blinkUrl);
    } catch (error) {
      const invalidUrlError = new Error("Blink URL is invalid.");
      invalidUrlError.statusCode = 400;
      throw invalidUrlError;
    }

    const fallback = evaluateTradingBlink({
      blink: parsedBlink,
      policy,
    });
    let analysis = fallback;
    let scoredBy = "rule-engine";
    let dataRetained = false;

    let zyfaiFunded = false;
    try {
      const veniceUnitCost = parseUsd(process.env.VENICE_COST_USDC, 0.001);
      const zyfaiBalance = await getZyfaiYieldBalance();
      if (zyfaiBalance !== null) {
        if (zyfaiBalance < veniceUnitCost) {
          const err = new Error("Insufficient Zyfai yield to fund private inference.");
          err.code = "ZYFAI_INSUFFICIENT_YIELD";
          throw err;
        }
      }

      const veniceResult = await scoreWithVenice(parsedBlink, policy);
      const veniceDecision = toDecisionFromVerdict(veniceResult?.verdict);
      const sourceLimit = Number(
        fallback?.sourceLimitUsd || fallback?.policySnapshot?.maxTradeUsd || parsedBlink.amountUsd
      );
      const safeAmount = Number(veniceResult?.safe_amount);
      const executionAmountUsd =
        veniceDecision === "auto-downsize"
          ? Number.isFinite(safeAmount)
            ? safeAmount
            : Math.min(parsedBlink.amountUsd, sourceLimit)
          : parsedBlink.amountUsd;
      const reason = String(veniceResult?.reason || fallback.summary || "Policy evaluation complete.");
      const score = Number(veniceResult?.score);

      analysis = {
        ...fallback,
        decision: veniceDecision,
        allowed: veniceDecision !== "block",
        executionAmountUsd,
        riskScore: Number.isFinite(score) ? score : fallback.riskScore,
        explanation: [reason],
        summary: reason,
        warnings: veniceDecision === "allow" ? fallback.warnings : [],
        blocks: veniceDecision === "block" ? [reason] : [],
        reasons: veniceDecision === "auto-downsize" ? [reason] : [],
      };
      scoredBy = process.env.VENICE_MODEL || "venice-llama-3.3-70b";

      if (zyfaiBalance !== null) {
        await spendZyfaiYield(veniceUnitCost);
        zyfaiFunded = true;
      }

      const litActionCidFallback = String(process.env.LIT_ACTION_CID || "").trim() || null;
      const litVerdict = await queryLitPolicyVerdict(parsedBlink).catch(() => ({ actionCid: litActionCidFallback }));
      if (litVerdict?.verdict) {
        const litDecision = toDecisionFromVerdict(litVerdict.verdict);
        if (litDecision !== analysis.decision) {
          analysis = {
            ...analysis,
            decision: litDecision,
            allowed: litDecision !== "block",
            executionAmountUsd:
              litDecision === "auto-downsize"
                ? Number.isFinite(Number(litVerdict.safeAmount))
                  ? Number(litVerdict.safeAmount)
                  : analysis.executionAmountUsd
                : analysis.executionAmountUsd,
            summary: litVerdict.reason || analysis.summary,
            explanation: [litVerdict.reason || analysis.summary],
          };
        }

        analysis = {
          ...analysis,
          litPolicySealed: litVerdict.sealed === true,
          litActionCid: litVerdict.actionCid,
        };
      } else if (litVerdict?.actionCid) {
        analysis = {
          ...analysis,
          litPolicySealed: false,
          litActionCid: litVerdict.actionCid,
        };
      }
    } catch (error) {
      analysis = {
        ...fallback,
        fallbackUsed: true,
        fallbackReason: error.message,
        litActionCid: String(process.env.LIT_ACTION_CID || "").trim() || null,
      };
      scoredBy = "rule-engine-fallback";
    }

    const rewrittenBlinkUrl =
      analysis.decision === "auto-downsize"
        ? rewriteBlinkUrl(blinkUrl, {
            amountUsd: analysis.executionAmountUsd,
            darkagentAdjusted: 1,
          })
        : blinkUrl;

    return {
      ensName: normalizedEnsName,
      policy,
      parsedBlink,
      analysis,
      rewrittenBlinkUrl,
      scoredBy,
      dataRetained,
      zyfaiFunded,
      treasury: treasurySnapshot,
    };
  }

  async function executeAnalyzedBlink({ ensName, parsedBlink, analysis, blinkUrl }) {
    const dynamicAction = buildDynamicActionFromBlink(parsedBlink);
    const executionPayload = buildBlinkExecutionPayload(
      ensName,
      parsedBlink,
      analysis
    );
    const execution = await executor.execute({
      ensName,
      action: dynamicAction,
      evaluation: {
        amountUsd: analysis.executionAmountUsd,
      },
      payload: executionPayload,
    });

    const updatedPolicy = policyStore.recordSpend(ensName, analysis.executionAmountUsd);
    await watcher.syncOnce("execution");

    return {
      dynamicAction,
      execution,
      executionPayload,
      updatedPolicy,
      rewrittenBlinkUrl:
        analysis.decision === "auto-downsize"
          ? rewriteBlinkUrl(blinkUrl, {
              amountUsd: analysis.executionAmountUsd,
              darkagentAdjusted: 1,
            })
          : blinkUrl,
    };
  }

  const server = http.createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      response.end();
      return;
    }

    const baseUrl = getBaseUrl(request);
    const requestUrl = new URL(request.url, baseUrl);
    const pathName = requestUrl.pathname;

    try {
      if (request.method === "GET" && pathName === "/") {
        writeJson(response, 200, {
          ok: true,
          service: "darkagent-blink-proxy",
          message: "DarkAgent Blink Proxy is running.",
          endpoints: {
            health: `${baseUrl}/health`,
            manifest: `${baseUrl}/api/actions/manifest`,
            demoState: `${baseUrl}/api/demo/state`,
            analyzeBlink: `${baseUrl}/api/blinks/analyze`,
            executeBlink: `${baseUrl}/api/blinks/execute`,
            memoryAsk: `${baseUrl}/api/agent-memory/ask`,
            memoryState: `${baseUrl}/api/agent-memory/state`,
            policies: `${baseUrl}/api/policies`,
            proofs: `${baseUrl}/api/proofs`,
            integrations: `${baseUrl}/api/integrations`,
            events: `${baseUrl}/api/events`,
            shareLinks: `${baseUrl}/api/share-links`,
          },
        });
        return;
      }

      if (request.method === "GET" && pathName === "/health") {
        writeJson(response, 200, {
          ok: true,
          service: "darkagent-blink-proxy",
          now: new Date().toISOString(),
          live: eventHub.getStatus(),
        });
        return;
      }

      if (request.method === "GET" && pathName === "/api/events") {
        const dispose = eventHub.register(response);
        request.on("close", dispose);
        return;
      }

      if (request.method === "GET" && pathName === "/api/assets/darkagent.svg") {
        writeSvg(response, getDarkAgentIcon());
        return;
      }

      if (request.method === "GET" && pathName === "/api/actions/manifest") {
        writeJson(response, 200, buildManifest(baseUrl));
        return;
      }

      if (request.method === "GET" && pathName === "/api/actions/registry") {
        writeJson(response, 200, {
          actions: listActions(),
        });
        return;
      }

      if (request.method === "GET" && pathName === "/api/blinks/samples") {
        writeJson(response, 200, {
          samples: SAMPLE_BLINKS,
          shares: Object.values(shareLinkStore.readAll()),
        });
        return;
      }

      if (request.method === "POST" && pathName === "/analyze-blink") {
        if (!shouldBypassPayment() && !hasPaymentProof(request)) {
          writeJson(response, 402, {
            error: "Payment Required",
            message: "This endpoint requires payment proof in production.",
            payment: {
              amount: process.env.X402_AMOUNT || "0.001",
              currency: process.env.X402_CURRENCY || "USDC",
              network: process.env.X402_NETWORK || "base-sepolia",
              payTo: process.env.DEPLOYER_ADDRESS || "",
            },
          });
          return;
        }

        const body = await readRequestBody(request);
        const blinkUrl = String(body.blinkUrl || body.url || "").trim();
        const ensName = normalizeEnsName(body.ensAddress || body.ensName || "alice.eth");
        const result = await runUrlAnalysis({ ensName, blinkUrl });

        writeJson(response, 200, {
          score: result.analysis.riskScore,
          verdict:
            result.analysis.decision === "block"
              ? "BLOCK"
              : result.analysis.decision === "auto-downsize"
                ? "DOWNSIZE"
                : "ALLOW",
          reason: result.analysis.summary,
          safe_amount: result.analysis.executionAmountUsd,
          scored_by: result.scoredBy,
          data_retained: result.dataRetained,
          funded_by: result.zyfaiFunded ? "zyfai_yield" : "direct",
          treasury: result.treasury,
          lit_action_cid: result.analysis.litActionCid || null,
          warning: result.analysis.fallbackUsed
            ? "Venice unavailable; rule-engine fallback applied."
            : undefined,
        });
        return;
      }

      if (request.method === "POST" && pathName === "/api/blinks/analyze") {
        if (!shouldBypassPayment() && !hasPaymentProof(request)) {
          writeJson(response, 402, {
            error: "Payment Required",
            message: "Analysis requires payment proof in production.",
            payment: {
              amount: process.env.X402_AMOUNT || "0.001",
              currency: process.env.X402_CURRENCY || "USDC",
              network: process.env.X402_NETWORK || "base-sepolia",
              payTo: process.env.DEPLOYER_ADDRESS || "",
            },
          });
          return;
        }

        const body = await readRequestBody(request);
        const blinkUrl = String(body.url || body.blinkUrl || "").trim();
        const ensName = normalizeEnsName(body.ensName || "alice.eth");
        const result = await runUrlAnalysis({ ensName, blinkUrl });

        const proof = await proofService.createProof({
          kind: "blink-analysis",
          verdict: result.analysis.decision,
          ensName,
          actionId: `${result.parsedBlink.protocol}-analyze`,
          policy: result.policy,
          evaluation: result.analysis,
          watcher: watcher.getStatus(),
          reason: result.analysis.summary,
          integrations: {
            litActionCid: result.analysis.litActionCid || null,
            litPolicySealed: result.analysis.litPolicySealed === true,
            fundedBy: result.zyfaiFunded ? "zyfai_yield" : "direct",
            budgetSource: result.policy?.budgetSource || null,
          },
        });

        appendActivity({
          type: "analysis",
          ensName,
          source: result.parsedBlink.sourceCategory,
          sourceName: result.parsedBlink.sourceName,
          protocol: result.parsedBlink.protocol,
          amountUsd: result.parsedBlink.amountUsd,
          status: result.analysis.decision,
          reason: result.analysis.summary,
          proofId: proof.id,
          litActionCid: result.analysis.litActionCid || null,
          litPolicySealed: result.analysis.litPolicySealed === true,
        });

        writeJson(response, 200, {
          parsedBlink: result.parsedBlink,
          analysis: result.analysis,
          rewrittenBlinkUrl: result.rewrittenBlinkUrl,
          proof,
          scoredBy: result.scoredBy,
          dataRetained: result.dataRetained,
          fundedBy: result.zyfaiFunded ? "zyfai_yield" : "direct",
          treasury: result.treasury,
          litActionCid: result.analysis.litActionCid || null,
          litPolicySealed: result.analysis.litPolicySealed === true,
        });
        return;
      }

      if (request.method === "POST" && pathName === "/api/blinks/execute") {
        const body = await readRequestBody(request);
        const blinkUrl = String(body.url || body.blinkUrl || "").trim();
        const ensName = normalizeEnsName(body.ensName || "alice.eth");
        const result = await runUrlAnalysis({ ensName, blinkUrl });

        if (result.analysis.decision === "block") {
          const proof = await proofService.createProof({
            kind: "blink-execution",
            verdict: "blocked",
            ensName,
            actionId: `${result.parsedBlink.protocol}-execute`,
            policy: result.policy,
            evaluation: result.analysis,
            watcher: watcher.getStatus(),
            reason: result.analysis.summary,
            integrations: {
              litActionCid: result.analysis.litActionCid || null,
              litPolicySealed: result.analysis.litPolicySealed === true,
              fundedBy: result.zyfaiFunded ? "zyfai_yield" : "direct",
              budgetSource: result.policy?.budgetSource || null,
            },
          });

          appendActivity({
            type: "analysis",
            ensName,
            source: result.parsedBlink.sourceCategory,
            sourceName: result.parsedBlink.sourceName,
            protocol: result.parsedBlink.protocol,
            amountUsd: result.parsedBlink.amountUsd,
            status: result.analysis.decision,
            reason: result.analysis.summary,
            proofId: proof.id,
            litActionCid: result.analysis.litActionCid || null,
            litPolicySealed: result.analysis.litPolicySealed === true,
          });

          writeJson(response, 403, {
            parsedBlink: result.parsedBlink,
            analysis: result.analysis,
            rewrittenBlinkUrl: result.rewrittenBlinkUrl,
            proof,
            message: result.analysis.summary,
            fundedBy: result.zyfaiFunded ? "zyfai_yield" : "direct",
            litActionCid: result.analysis.litActionCid || null,
            litPolicySealed: result.analysis.litPolicySealed === true,
          });
          return;
        }

        const executed = await executeAnalyzedBlink({
          ensName,
          parsedBlink: result.parsedBlink,
          analysis: result.analysis,
          blinkUrl,
        });

        const proof = await proofService.createProof({
          kind: "blink-execution",
          verdict: result.analysis.decision === "auto-downsize" ? "auto-downsize" : "executed",
          ensName,
          actionId: executed.dynamicAction.id,
          policy: executed.updatedPolicy || result.policy,
          evaluation: result.analysis,
          execution: executed.execution,
          watcher: watcher.getStatus(),
          reason: result.analysis.summary,
          integrations: {
            litActionCid: result.analysis.litActionCid || null,
            litPolicySealed: result.analysis.litPolicySealed === true,
            fundedBy: result.zyfaiFunded ? "zyfai_yield" : "direct",
            budgetSource:
              executed.updatedPolicy?.budgetSource || result.policy?.budgetSource || null,
          },
        });

        appendActivity({
          type: "execution",
          ensName,
          source: result.parsedBlink.sourceCategory,
          sourceName: result.parsedBlink.sourceName,
          protocol: result.parsedBlink.protocol,
          amountUsd: result.analysis.executionAmountUsd,
          status: "executed",
          reason: result.analysis.summary,
          txid: executed.execution.txid,
          stealthAddress: executed.execution.stealthAddress,
          receiptUrl: executed.execution.receiptUrl,
          proofId: proof.id,
          litActionCid: result.analysis.litActionCid || null,
          litPolicySealed: result.analysis.litPolicySealed === true,
        });

        let filecoinCid = null;
        try {
          filecoinCid = await withTimeout(
            uploadExecutionRecordToFilecoin({
              timestamp: new Date().toISOString(),
              ensName,
              blink: result.parsedBlink,
              analysis: result.analysis,
              execution: executed.execution,
              proofId: proof.id,
              verifierContract: DEFAULT_VERIFIER_CONTRACT || null,
              scoredBy: result.scoredBy,
              compliant: result.analysis.decision !== "block",
            }),
            FILECOIN_TOTAL_TIMEOUT_MS,
            "Execution Filecoin upload"
          );
          if (filecoinCid) {
            proof.integrations = {
              ...(proof.integrations || {}),
              filecoinCid,
            };
            proofStore.updateById(proof.id, {
              integrations: proof.integrations,
            });

            appendActivity({
              type: "filecoin",
              status: "stored",
              ensName,
              cid: filecoinCid,
              proofId: proof.id,
              reason: "Execution record persisted to Filecoin.",
            });
          }
        } catch (filecoinError) {
          appendActivity({
            type: "filecoin",
            status: "failed",
            reason: filecoinError.message,
          });
        }

        writeJson(response, 200, {
          parsedBlink: result.parsedBlink,
          analysis: result.analysis,
          rewrittenBlinkUrl: executed.rewrittenBlinkUrl,
          execution: {
            ...executed.execution,
            verifierContract: DEFAULT_VERIFIER_CONTRACT || undefined,
          },
          proof,
          scoredBy: result.scoredBy,
          fundedBy: result.zyfaiFunded ? "zyfai_yield" : "direct",
          treasury: result.treasury,
          filecoinCid,
          litActionCid: result.analysis.litActionCid || null,
          litPolicySealed: result.analysis.litPolicySealed === true,
        });
        return;
      }

      if (request.method === "POST" && pathName === "/api/agent-memory/ask") {
        const body = await readRequestBody(request);
        const ensName = normalizeEnsName(body.ensName || "alice.eth");
        const prompt = String(body.prompt || body.question || "").trim();
        if (!prompt) {
          writeJson(response, 400, {
            error: "prompt is required.",
          });
          return;
        }

        const latest = agentMemoryStore.latest(ensName);
        let priorMemory = null;
        let retrievedFromCid = null;
        let retrievalWarning = null;

        if (latest?.cid) {
          try {
            const retrieval = await retrieveFilecoinJson(latest.cid);
            priorMemory = retrieval.payload;
            retrievedFromCid = {
              cid: retrieval.cid,
              gateway: retrieval.gateway,
            };
          } catch (error) {
            retrievalWarning = error.message;
          }
        }

        let answer;
        let usedFallback = false;
        try {
          answer = await generateMemoryAnswerWithVenice({
            ensName,
            prompt,
            priorMemory,
          });
        } catch (error) {
          usedFallback = true;
          answer = {
            answer: priorMemory
              ? `Venice unavailable. Reusing last known memory context: ${String(priorMemory.answer || priorMemory.memory_summary || "No prior answer found.")}`
              : "Venice unavailable and no prior decentralized memory found.",
            memory_used: Boolean(priorMemory),
            memory_summary: priorMemory
              ? "Fallback answer derived from retrieved Filecoin memory."
              : "No memory available.",
          };
        }

        const memoryRecord = {
          type: "agent-memory-turn",
          ensName,
          prompt,
          answer: answer.answer,
          memoryUsed: Boolean(answer.memory_used),
          memorySummary: String(answer.memory_summary || ""),
          previousCid: latest?.cid || null,
          retrievedFromCid: retrievedFromCid?.cid || null,
          model: process.env.VENICE_MODEL || "llama-3.3-70b",
          generatedAt: new Date().toISOString(),
        };

        let storedCid = null;
        try {
          storedCid = await uploadExecutionRecordToFilecoin(memoryRecord);
        } catch (error) {
          retrievalWarning = retrievalWarning || error.message;
        }

        if (storedCid) {
          agentMemoryStore.append(ensName, {
            cid: storedCid,
            prompt,
            answerPreview: String(answer.answer || "").slice(0, 180),
            previousCid: latest?.cid || null,
          });
        }

        appendActivity({
          type: "agent-memory",
          ensName,
          status: storedCid ? "stored" : "computed",
          reason: usedFallback
            ? "Venice unavailable; fallback used."
            : "Generated with Venice and persisted to Filecoin.",
          cid: storedCid,
          retrievedFromCid: retrievedFromCid?.cid || null,
        });

        writeJson(response, 200, {
          ensName,
          prompt,
          answer: answer.answer,
          memoryUsed: Boolean(answer.memory_used),
          memorySummary: String(answer.memory_summary || ""),
          previousMemory: retrievedFromCid,
          storedCid,
          retrievalWarning,
          fundedBy: "zyfai_yield",
          mode: usedFallback ? "fallback" : "venice",
        });
        return;
      }

      if (request.method === "GET" && pathName === "/api/agent-memory/state") {
        const ensName = normalizeEnsName(requestUrl.searchParams.get("ensName") || "alice.eth");
        writeJson(response, 200, {
          ensName,
          latest: agentMemoryStore.latest(ensName),
          history: agentMemoryStore.list(ensName),
        });
        return;
      }

      if (request.method === "GET" && pathName === "/api/policies") {
        writeJson(response, 200, {
          policies: buildPolicyState(policyStore, watcher),
        });
        return;
      }

      if (request.method === "GET" && pathName === "/api/watcher/status") {
        writeJson(response, 200, watcher.getStatus());
        return;
      }

      if (request.method === "POST" && pathName === "/api/watcher/sync") {
        const syncResult = await watcher.syncOnce("manual");
        appendActivity({
          type: "watcher",
          status: "synced",
          details: syncResult,
        });
        writeJson(response, 200, {
          message: "Watcher sync completed.",
          ...syncResult,
          watcher: watcher.getStatus(),
        });
        return;
      }

      if (request.method === "GET" && pathName === "/api/activity") {
        writeJson(response, 200, {
          events: activityStore.readAll(),
        });
        return;
      }

      if (request.method === "GET" && pathName === "/api/proofs") {
        writeJson(response, 200, {
          signer: proofService.getStatus(),
          proofs: proofStore.readAll(),
        });
        return;
      }

      if (request.method === "GET" && pathName === "/api/integrations") {
        writeJson(
          response,
          200,
          await buildIntegrationState({
            baseUrl,
            policyStore,
            watcher,
            activityStore,
            proofStore,
          })
        );
        return;
      }

      if (request.method === "POST" && pathName === "/api/share-links") {
        const body = await readRequestBody(request);
        const blinkUrl = String(body.blinkUrl || body.url || "").trim();

        if (!blinkUrl) {
          writeJson(response, 400, {
            error: "Blink URL is required.",
          });
          return;
        }

        const entry = shareLinkStore.create({
          blinkUrl,
          createdBy: normalizeEnsName(body.ensName || "alice.eth"),
          meta: body.meta || {},
        });

        writeJson(response, 200, {
          share: entry,
        });
        return;
      }

      if (request.method === "GET" && pathName.startsWith("/api/share-links/")) {
        const shareId = pathName.split("/").pop();
        const share = shareLinkStore.get(shareId);

        if (!share) {
          writeJson(response, 404, {
            error: `No share link found for ${shareId}.`,
          });
          return;
        }

        writeJson(response, 200, {
          share,
        });
        return;
      }

      if (
        request.method === "GET" &&
        /^\/api\/proofs\/[^/]+\/view$/.test(pathName)
      ) {
        const proofId = pathName.split("/")[3];
        const proof = proofStore.getById(proofId);
        if (!proof) {
          writeHtml(
            response,
            404,
            "<!doctype html><html><body><h1>Proof not found.</h1></body></html>"
          );
          return;
        }

        writeHtml(response, 200, buildProofViewHtml({ proof, requestUrl }));
        return;
      }

      if (request.method === "GET" && pathName.startsWith("/api/proofs/")) {
        const proofId = pathName.split("/").pop();
        const proof = proofStore.getById(proofId);
        if (!proof) {
          writeJson(response, 404, {
            error: `No proof found for ${proofId}.`,
          });
          return;
        }

        writeJson(response, 200, proof);
        return;
      }

      if (request.method === "GET" && pathName === "/api/demo/state") {
        writeJson(response, 200, await buildDemoState(baseUrl));
        return;
      }

      if (request.method === "POST" && pathName === "/api/demo/reset") {
        const policies = policyStore.resetFromSeed();
        activityStore.clear();
        proofStore.clear();
        await watcher.syncOnce("reset");
        appendActivity({
          type: "system",
          status: "reset",
          details: { policies: Object.keys(policies) },
        });
        writeJson(response, 200, {
          message: "Demo reset to seeded ENS policies.",
          policies,
          watcher: watcher.getStatus(),
        });
        return;
      }

      if (
        (request.method === "GET" || request.method === "POST") &&
        pathName.startsWith("/api/actions/")
      ) {
        const actionId = pathName.split("/").pop();
        const action = getAction(actionId);

        if (!action) {
          writeJson(response, 404, {
            error: `Unknown action '${actionId}'.`,
          });
          return;
        }

        if (request.method === "GET") {
          writeJson(response, 200, buildActionMetadata(action, baseUrl));
          return;
        }

        const body = await readRequestBody(request);
        const payload = {
          ...Object.fromEntries(requestUrl.searchParams.entries()),
          ...body,
        };
        const ensName = normalizeEnsName(payload.ensName);
        const policy = watcher.getPolicy(ensName);
        const evaluation = evaluateAction({
          action,
          policy,
          payload,
        });

        appendActivity({
          type: "proposal",
          ensName,
          actionId: action.id,
          protocol: action.protocol,
          amountUsd: evaluation.amountUsd,
          status: "received",
          account: payload.account || "",
        });

        if (!evaluation.allowed) {
          appendActivity({
            type: "verification",
            ensName,
            actionId: action.id,
            protocol: action.protocol,
            amountUsd: evaluation.amountUsd,
            status: "blocked",
            reason: evaluation.violations.join(" "),
          });

          const proof = await proofService.createProof({
            kind: "blink-verdict",
            verdict: "blocked",
            ensName,
            actionId: action.id,
            policy,
            evaluation,
            watcher: watcher.getStatus(),
            reason: evaluation.violations.join(" "),
          });

          writeJson(response, 403, {
            type: "error",
            status: "blocked",
            message: "DarkAgent blocked this Blink action.",
            action: {
              id: action.id,
              protocol: action.protocol,
            },
            evaluation,
            proof,
            watcher: watcher.getStatus(),
          });
          return;
        }

        appendActivity({
          type: "verification",
          ensName,
          actionId: action.id,
          protocol: action.protocol,
          amountUsd: evaluation.amountUsd,
          status: "approved",
        });

        const execution = await executor.execute({
          ensName,
          action,
          evaluation,
          payload,
        });

        const updatedPolicy = policyStore.recordSpend(ensName, evaluation.amountUsd);
        await watcher.syncOnce("execution");

        appendActivity({
          type: "execution",
          ensName,
          actionId: action.id,
          protocol: action.protocol,
          amountUsd: evaluation.amountUsd,
          status: "executed",
          txid: execution.txid,
          stealthAddress: execution.stealthAddress,
          receiptUrl: execution.receiptUrl,
          executorMode: execution.mode,
        });

        const proof = await proofService.createProof({
          kind: "blink-verdict",
          verdict: "executed",
          ensName,
          actionId: action.id,
          policy: updatedPolicy || policy,
          evaluation,
          execution,
          watcher: watcher.getStatus(),
        });

        writeJson(response, 200, {
          type: "transaction",
          status: "executed",
          message:
            "Blink cleared the DarkAgent policy gate and executed successfully.",
          action: {
            id: action.id,
            protocol: action.protocol,
            sourceChain: action.sourceChain,
            settlementChain: action.settlementChain,
          },
          evaluation,
          execution,
          policy: updatedPolicy,
          proof,
          watcher: watcher.getStatus(),
        });
        return;
      }

      if (
        (request.method === "GET" || request.method === "PUT") &&
        pathName.startsWith("/api/policies/")
      ) {
        const ensName = normalizeEnsName(pathName.split("/").pop());
        if (!ensName) {
          writeJson(response, 400, {
            error: "ENS name is required.",
          });
          return;
        }

        if (request.method === "GET") {
          const policy = policyStore.get(ensName);
          if (!policy) {
            writeJson(response, 404, {
              error: `No policy found for ${ensName}.`,
            });
            return;
          }

          writeJson(response, 200, {
            ensName,
            stored: policy,
            synced: watcher.getPolicy(ensName),
          });
          return;
        }

        const body = await readRequestBody(request);
        const updatedPolicy = policyStore.upsert(ensName, body);
        appendActivity({
          type: "policy",
          ensName,
          status: "updated",
          details: body,
        });

        writeJson(response, 200, {
          message:
            "ENS policy updated. The watcher will apply it on the next sync cycle or manual sync.",
          policy: updatedPolicy,
          synced: watcher.getPolicy(ensName),
          watcher: watcher.getStatus(),
        });
        return;
      }

      writeJson(response, 404, {
        error: "Not found.",
      });
    } catch (error) {
      writeJson(response, error.statusCode || 500, {
        error: error.message,
      });
    }
  });

  return {
    async start(port = Number(process.env.DARKAGENT_BLINK_PORT || 8787)) {
      await watcher.start();
      await new Promise((resolve) => {
        server.listen(port, resolve);
      });
      return {
        port: server.address().port,
      };
    },
    async stop() {
      watcher.stop();
      eventHub.close();
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    services: {
      activityStore,
      eventHub,
      executor,
      policyStore,
      proofService,
      proofStore,
      shareLinkStore,
      watcher,
    },
  };
}

async function startFromCli() {
  const app = createBlinkProxyServer();
  const { port } = await app.start();
  console.log(
    `[DarkAgent Blink Proxy] Running on http://localhost:${port} with ${
      app.services.watcher.getStatus().intervalMs
    }ms ENS watcher cadence.`
  );
}

if (require.main === module) {
  startFromCli().catch((error) => {
    console.error("[DarkAgent Blink Proxy] Failed to start:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  createBlinkProxyServer,
};
