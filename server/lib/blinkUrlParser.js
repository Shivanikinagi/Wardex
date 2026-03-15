const KNOWN_PROTOCOLS = new Set(["uniswap", "aave", "1inch"]);
const KNOWN_CHAINS = new Set(["solana", "ethereum", "base", "arbitrum", "polygon"]);
const TOP_TOKENS = new Set(["USDC", "USDT", "ETH", "WETH", "BTC", "WBTC", "SOL", "AAVE"]);
const MEME_TOKENS = new Set(["DOGE", "PEPE", "BONK", "SHIB", "FLOKI", "TRUMP", "DOGEAI", "MEME"]);

function normalizeProtocol(value) {
  const normalized = String(value || "uniswap").trim().toLowerCase();
  return KNOWN_PROTOCOLS.has(normalized) ? normalized : normalized || "unknown";
}

function normalizeChain(value, protocol) {
  const normalized = String(value || "").trim().toLowerCase();
  if (KNOWN_CHAINS.has(normalized)) {
    return normalized;
  }
  if (protocol === "uniswap" || protocol === "aave" || protocol === "1inch") {
    return "base";
  }
  return "base";
}

function inferSourceCategory(url, explicitSource) {
  const source = String(explicitSource || "").trim().toLowerCase();
  if (source) {
    return source;
  }

  const host = String(url.hostname || "").toLowerCase();
  if (host.includes("x.com") || host.includes("twitter.com") || host.includes("farcaster")) {
    return "influencer";
  }
  if (host.includes("t.me") || host.includes("telegram")) {
    return "telegram";
  }
  if (host.includes("discord")) {
    return "community";
  }
  if (host.includes("ai") || host.includes("bot")) {
    return "twitter";
  }
  if (host.includes("copy")) {
    return "copy_trader";
  }
  if (host.includes("friend")) {
    return "friend";
  }

  return "unknown";
}

function getTokenCategory(symbol) {
  const normalized = String(symbol || "").trim().toUpperCase();
  if (MEME_TOKENS.has(normalized)) {
    return "meme";
  }
  if (TOP_TOKENS.has(normalized)) {
    return normalized === "USDC" || normalized === "USDT" ? "stable" : "top";
  }
  return "unknown";
}

function numberParam(params, keys, fallback) {
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}

function stringParam(params, keys, fallback) {
  for (const key of keys) {
    const value = params.get(key);
    if (value) {
      return value;
    }
  }
  return fallback;
}

function buildSummary(parsedBlink) {
  return `${parsedBlink.sourceCategory} Blink on ${parsedBlink.protocol} ${parsedBlink.action}ing ${parsedBlink.tokenOut} on ${parsedBlink.chain} for ${parsedBlink.amountUsd} USD`;
}

function parseBlinkUrl(inputUrl) {
  const url = new URL(inputUrl);
  const params = url.searchParams;
  const tokenIn = stringParam(params, ["tokenIn", "from", "sellToken"], "USDC").toUpperCase();
  const tokenOut = stringParam(params, ["tokenOut", "to", "buyToken"], "ETH").toUpperCase();
  const amountUsd = numberParam(params, ["amountUsd", "amount", "usd"], 100);
  const protocol = normalizeProtocol(stringParam(params, ["protocol", "dex"], "uniswap"));
  const action = stringParam(params, ["action", "actionType"], "swap").toLowerCase();
  const chain = normalizeChain(stringParam(params, ["chain", "network"], ""), protocol);
  const sourceCategory = inferSourceCategory(url, stringParam(params, ["source", "sourceCategory"], ""));
  const sourceName = stringParam(params, ["sender", "author", "sourceName"], url.hostname || "Unknown sender");
  const slippageBps = numberParam(params, ["slippageBps", "slippage"], 100);
  const liquidityUsd = numberParam(params, ["liquidityUsd", "liquidity"], 500000);
  const leverage = numberParam(params, ["leverage"], 1);
  const title = stringParam(params, ["title", "headline"], "DarkAgent trading Blink");
  const tweetCopy = stringParam(params, ["tweet", "tweetCopy"], "");

  const parsedBlink = {
    rawUrl: inputUrl,
    hostname: url.hostname,
    pathname: url.pathname,
    sourceCategory,
    sourceName,
    protocol,
    action,
    chain,
    title,
    tweetCopy,
    tokenIn,
    tokenOut,
    tokenCategory: getTokenCategory(tokenOut),
    amountUsd,
    slippageBps,
    liquidityUsd,
    leverage,
    params: Object.fromEntries(params.entries()),
  };

  return {
    ...parsedBlink,
    summary: buildSummary(parsedBlink),
  };
}

function rewriteBlinkUrl(inputUrl, patch = {}) {
  const url = new URL(inputUrl);
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      url.searchParams.delete(key);
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

module.exports = {
  parseBlinkUrl,
  rewriteBlinkUrl,
};
