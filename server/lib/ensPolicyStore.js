const fs = require("fs");
const path = require("path");
const { getPersonaPreset } = require("./tradingPolicyEngine");

function clampNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueStrings(values, fallback) {
  const source = Array.isArray(values) ? values : fallback;
  return [...new Set(source.map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeEnsName(ensName) {
  return String(ensName || "").trim().toLowerCase();
}

function normalizeSourceLimits(persona, rawSourceLimits = {}) {
  const preset = getPersonaPreset(persona);
  const merged = {
    ...preset.sourceLimits,
    ...(rawSourceLimits || {}),
  };

  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, clampNumber(value, 0)])
  );
}

function normalizePolicy(ensName, rawPolicy = {}) {
  const normalizedEnsName = normalizeEnsName(ensName);
  const persona = String(rawPolicy.persona || "balanced").toLowerCase();
  const preset = getPersonaPreset(persona);
  const spendWindowStartedAt =
    rawPolicy.spendWindowStartedAt || new Date().toISOString();
  const maxTradeUsd = clampNumber(
    rawPolicy.maxTradeUsd ?? rawPolicy.maxSpendUsd,
    preset.maxTradeUsd
  );
  const maxSlippageBps = clampNumber(
    rawPolicy.maxSlippageBps ?? rawPolicy.slippageBps,
    preset.maxSlippageBps
  );
  const trustedProtocols = uniqueStrings(
    rawPolicy.trustedProtocols || rawPolicy.allowedProtocols,
    preset.trustedProtocols
  ).map((value) => value.toLowerCase());

  return {
    ensName: normalizedEnsName,
    owner: rawPolicy.owner || normalizedEnsName,
    active: rawPolicy.active !== false,
    persona,
    maxTradeUsd,
    maxSpendUsd: maxTradeUsd,
    dailyLimitUsd: clampNumber(rawPolicy.dailyLimitUsd, maxTradeUsd * 3),
    dailySpentUsd: clampNumber(rawPolicy.dailySpentUsd, 0),
    spendWindowStartedAt,
    trustedProtocols,
    allowedProtocols: trustedProtocols,
    trustedProtocolsOnly:
      rawPolicy.trustedProtocolsOnly ?? preset.trustedProtocolsOnly,
    allowedTokens: uniqueStrings(rawPolicy.allowedTokens, ["USDC", "ETH", "SOL"]),
    maxSlippageBps,
    slippageBps: maxSlippageBps,
    minLiquidityUsd: clampNumber(rawPolicy.minLiquidityUsd, preset.minLiquidityUsd),
    blockMemeCoins: rawPolicy.blockMemeCoins ?? preset.blockMemeCoins,
    blockUnknownTokens:
      rawPolicy.blockUnknownTokens ?? preset.blockUnknownTokens,
    allowTopTokensOnly:
      rawPolicy.allowTopTokensOnly ?? preset.allowTopTokensOnly,
    allowLowLiquidityAssets:
      rawPolicy.allowLowLiquidityAssets ?? preset.allowLowLiquidityAssets,
    autoDownsize: rawPolicy.autoDownsize ?? preset.autoDownsize,
    sourceLimits: normalizeSourceLimits(persona, rawPolicy.sourceLimits),
    notifyEmail: rawPolicy.notifyEmail || "",
    executionPolicyId:
      rawPolicy.executionPolicyId ||
      rawPolicy.bitgoPolicyId ||
      `exec-${normalizedEnsName.replace(/[^a-z0-9]/g, "-")}`,
    notes: rawPolicy.notes || "",
    updatedAt:
      rawPolicy.updatedAt ||
      rawPolicy.spendWindowStartedAt ||
      new Date().toISOString(),
  };
}

function resetDailyWindowIfNeeded(policy) {
  const windowStartedAt = new Date(policy.spendWindowStartedAt).getTime();
  if (!Number.isFinite(windowStartedAt)) {
    return {
      ...policy,
      dailySpentUsd: 0,
      spendWindowStartedAt: new Date().toISOString(),
    };
  }

  const elapsedMs = Date.now() - windowStartedAt;
  if (elapsedMs >= 24 * 60 * 60 * 1000) {
    return {
      ...policy,
      dailySpentUsd: 0,
      spendWindowStartedAt: new Date().toISOString(),
    };
  }

  return policy;
}

class EnsPolicyStore {
  constructor({ statePath, seedPath }) {
    this.statePath = statePath;
    this.seedPath = seedPath;
    this.ensureStateFile();
  }

  ensureStateFile() {
    const parentDir = path.dirname(this.statePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    if (!fs.existsSync(this.statePath)) {
      const seedData = fs.existsSync(this.seedPath)
        ? fs.readFileSync(this.seedPath, "utf8")
        : "{}";
      fs.writeFileSync(this.statePath, seedData);
    }
  }

  readAll() {
    this.ensureStateFile();

    const rawContent = fs.readFileSync(this.statePath, "utf8") || "{}";
    const parsed = JSON.parse(rawContent);
    const policies = {};

    Object.entries(parsed).forEach(([ensName, rawPolicy]) => {
      const normalized = resetDailyWindowIfNeeded(
        normalizePolicy(ensName, rawPolicy)
      );
      policies[normalized.ensName] = normalized;
    });

    return policies;
  }

  writeAll(policies) {
    const normalized = {};
    Object.entries(policies).forEach(([ensName, policy]) => {
      const normalizedEnsName = normalizeEnsName(ensName);
      normalized[normalizedEnsName] = normalizePolicy(normalizedEnsName, policy);
    });

    fs.writeFileSync(this.statePath, `${JSON.stringify(normalized, null, 2)}
`);
    return normalized;
  }

  get(ensName) {
    const normalizedEnsName = normalizeEnsName(ensName);
    return this.readAll()[normalizedEnsName] || null;
  }

  upsert(ensName, patch = {}) {
    const normalizedEnsName = normalizeEnsName(ensName);
    const policies = this.readAll();
    const current =
      policies[normalizedEnsName] || normalizePolicy(normalizedEnsName);
    const normalizedPatch = {
      ...patch,
    };

    if (Object.prototype.hasOwnProperty.call(normalizedPatch, "maxTradeUsd") && !Object.prototype.hasOwnProperty.call(normalizedPatch, "maxSpendUsd")) {
      normalizedPatch.maxSpendUsd = normalizedPatch.maxTradeUsd;
    }

    if (Object.prototype.hasOwnProperty.call(normalizedPatch, "maxSpendUsd") && !Object.prototype.hasOwnProperty.call(normalizedPatch, "maxTradeUsd")) {
      normalizedPatch.maxTradeUsd = normalizedPatch.maxSpendUsd;
    }

    if (Object.prototype.hasOwnProperty.call(normalizedPatch, "maxSlippageBps") && !Object.prototype.hasOwnProperty.call(normalizedPatch, "slippageBps")) {
      normalizedPatch.slippageBps = normalizedPatch.maxSlippageBps;
    }

    if (Object.prototype.hasOwnProperty.call(normalizedPatch, "slippageBps") && !Object.prototype.hasOwnProperty.call(normalizedPatch, "maxSlippageBps")) {
      normalizedPatch.maxSlippageBps = normalizedPatch.slippageBps;
    }

    const nextPolicy = normalizePolicy(normalizedEnsName, {
      ...current,
      ...normalizedPatch,
      updatedAt: new Date().toISOString(),
    });

    policies[normalizedEnsName] = nextPolicy;
    this.writeAll(policies);
    return nextPolicy;
  }

  recordSpend(ensName, amountUsd) {
    const normalizedEnsName = normalizeEnsName(ensName);
    const policy = this.get(normalizedEnsName);
    if (!policy) {
      return null;
    }

    const freshPolicy = resetDailyWindowIfNeeded(policy);
    const nextSpent =
      clampNumber(freshPolicy.dailySpentUsd, 0) + clampNumber(amountUsd, 0);
    return this.upsert(normalizedEnsName, {
      dailySpentUsd: nextSpent,
      spendWindowStartedAt: freshPolicy.spendWindowStartedAt,
    });
  }

  resetFromSeed() {
    const seedData = fs.existsSync(this.seedPath)
      ? fs.readFileSync(this.seedPath, "utf8")
      : "{}";
    fs.writeFileSync(this.statePath, seedData);
    return this.readAll();
  }
}

module.exports = {
  EnsPolicyStore,
  normalizeEnsName,
  normalizePolicy,
};
