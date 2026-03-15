const PERSONA_PRESETS = {
  conservative: {
    persona: "conservative",
    maxTradeUsd: 300,
    autoDownsize: true,
    blockMemeCoins: true,
    blockUnknownTokens: true,
    allowTopTokensOnly: true,
    trustedProtocolsOnly: true,
    allowLowLiquidityAssets: false,
    maxSlippageBps: 75,
    minLiquidityUsd: 1000000,
    trustedProtocols: ["uniswap", "aave", "1inch"],
    sourceLimits: {
      twitter: 300,
    },
  },
  balanced: {
    persona: "balanced",
    maxTradeUsd: 800,
    autoDownsize: true,
    blockMemeCoins: true,
    blockUnknownTokens: true,
    allowTopTokensOnly: false,
    trustedProtocolsOnly: true,
    allowLowLiquidityAssets: false,
    maxSlippageBps: 125,
    minLiquidityUsd: 250000,
    trustedProtocols: ["uniswap", "aave", "1inch"],
    sourceLimits: {
      twitter: 300,
    },
  },
  aggressive: {
    persona: "aggressive",
    maxTradeUsd: 2000,
    autoDownsize: true,
    blockMemeCoins: false,
    blockUnknownTokens: false,
    allowTopTokensOnly: false,
    trustedProtocolsOnly: false,
    allowLowLiquidityAssets: true,
    maxSlippageBps: 250,
    minLiquidityUsd: 75000,
    trustedProtocols: ["uniswap", "aave", "1inch"],
    sourceLimits: {
      twitter: 900,
    },
  },
};

const SOURCE_RISK = {
  twitter: 18,
};

function getPersonaPreset(persona = "balanced") {
  return PERSONA_PRESETS[persona] || PERSONA_PRESETS.balanced;
}

function normalizePolicyForTrading(policy = {}) {
  const preset = getPersonaPreset(policy.persona || "balanced");
  return {
    ...preset,
    ...policy,
    maxTradeUsd: Number(policy.maxTradeUsd ?? policy.maxSpendUsd ?? preset.maxTradeUsd),
    maxSlippageBps: Number(policy.maxSlippageBps ?? policy.slippageBps ?? preset.maxSlippageBps),
    minLiquidityUsd: Number(policy.minLiquidityUsd ?? preset.minLiquidityUsd),
    autoDownsize: policy.autoDownsize ?? preset.autoDownsize,
    blockMemeCoins: policy.blockMemeCoins ?? preset.blockMemeCoins,
    blockUnknownTokens: policy.blockUnknownTokens ?? preset.blockUnknownTokens,
    allowTopTokensOnly: policy.allowTopTokensOnly ?? preset.allowTopTokensOnly,
    trustedProtocolsOnly: policy.trustedProtocolsOnly ?? preset.trustedProtocolsOnly,
    allowLowLiquidityAssets:
      policy.allowLowLiquidityAssets ?? preset.allowLowLiquidityAssets,
    trustedProtocols: Array.isArray(policy.trustedProtocols)
      ? policy.trustedProtocols.map((value) => String(value).toLowerCase())
      : Array.isArray(policy.allowedProtocols)
        ? policy.allowedProtocols.map((value) => String(value).toLowerCase())
        : preset.trustedProtocols,
    sourceLimits: {
      ...preset.sourceLimits,
      ...(policy.sourceLimits || {}),
    },
  };
}

function calculateRiskScore({ blink, warnings, blocks, downsized }) {
  let score = SOURCE_RISK[blink.sourceCategory] || 20;
  if (blink.tokenCategory === "meme") score += 32;
  if (blink.tokenCategory === "unknown") score += 18;
  if (blink.liquidityUsd < 100000) score += 20;
  else if (blink.liquidityUsd < 300000) score += 12;
  if (blink.slippageBps > 150) score += 16;
  else if (blink.slippageBps > 100) score += 8;
  if (downsized) score += 10;
  score += warnings.length * 8;
  score += blocks.length * 15;
  return Math.max(0, Math.min(score, 100));
}

function classifyLabel(score, blocked) {
  if (blocked) return "Blocked";
  if (score >= 55) return "Risky";
  return "Safe";
}

function evaluateTradingBlink({ blink, policy }) {
  const normalizedPolicy = normalizePolicyForTrading(policy);
  const reasons = [];
  const warnings = [];
  const blocks = [];
  const sourceLimit = Number(
    normalizedPolicy.sourceLimits[blink.sourceCategory] ?? normalizedPolicy.maxTradeUsd
  );
  const effectiveLimit = Math.min(normalizedPolicy.maxTradeUsd, sourceLimit);
  let executionAmountUsd = blink.amountUsd;
  let decision = "allow";

  if (normalizedPolicy.active === false) {
    blocks.push("Profile is frozen.");
  }

  if (!normalizedPolicy.trustedProtocols.includes(blink.protocol)) {
    if (normalizedPolicy.trustedProtocolsOnly) {
      blocks.push(`Protocol ${blink.protocol} is not in your trusted protocol list.`);
    } else {
      warnings.push(`Protocol ${blink.protocol} is outside your preferred trusted list.`);
    }
  }

  if (sourceLimit <= 0) {
    blocks.push(`Source category ${blink.sourceCategory} is blocked by your policy.`);
  }

  if (normalizedPolicy.blockMemeCoins && blink.tokenCategory === "meme") {
    blocks.push(`${blink.tokenOut} is categorized as a meme coin and is blocked.`);
  }

  if (normalizedPolicy.blockUnknownTokens && blink.tokenCategory === "unknown") {
    blocks.push(`${blink.tokenOut} is treated as an unknown token and is blocked.`);
  }

  if (
    normalizedPolicy.allowTopTokensOnly &&
    !["top", "stable"].includes(blink.tokenCategory)
  ) {
    blocks.push(`${blink.tokenOut} is outside your top-token-only policy.`);
  }

  if (blink.leverage > 1) {
    blocks.push(`Leverage ${blink.leverage}x is not allowed in the MVP policy.`);
  }

  if (blink.liquidityUsd < normalizedPolicy.minLiquidityUsd / 4) {
    if (normalizedPolicy.allowLowLiquidityAssets) {
      warnings.push(`Liquidity ${blink.liquidityUsd} USD is very low for this trade.`);
    } else {
      blocks.push(`Liquidity ${blink.liquidityUsd} USD is far below your minimum threshold.`);
    }
  } else if (blink.liquidityUsd < normalizedPolicy.minLiquidityUsd) {
    warnings.push(`Liquidity ${blink.liquidityUsd} USD is below your preferred minimum.`);
  }

  if (blink.slippageBps > normalizedPolicy.maxSlippageBps * 2) {
    blocks.push(`Slippage ${blink.slippageBps} bps is well above your max slippage.`);
  } else if (blink.slippageBps > normalizedPolicy.maxSlippageBps) {
    warnings.push(`Slippage ${blink.slippageBps} bps exceeds your preferred max.`);
  }

  if (blink.amountUsd > effectiveLimit) {
    if (normalizedPolicy.autoDownsize && effectiveLimit > 0) {
      executionAmountUsd = effectiveLimit;
      reasons.push(
        `Trade downsized from ${blink.amountUsd} USD to ${effectiveLimit} USD for ${blink.sourceCategory}.`
      );
      decision = "auto-downsize";
    } else {
      blocks.push(
        `Trade size ${blink.amountUsd} USD exceeds your ${blink.sourceCategory} limit of ${effectiveLimit} USD.`
      );
    }
  }

  const riskScore = calculateRiskScore({
    blink,
    warnings,
    blocks,
    downsized: decision === "auto-downsize",
  });
  const label = classifyLabel(riskScore, blocks.length > 0);

  if (blocks.length > 0) {
    decision = "block";
  } else if (decision !== "auto-downsize" && warnings.length > 0) {
    decision = "allow-with-warning";
  }

  const explanation = [...blocks, ...reasons, ...warnings];
  const summary =
    decision === "block"
      ? explanation[0] || "Blocked by policy."
      : decision === "auto-downsize"
        ? reasons[0]
        : warnings[0] || "Blink fits your current trading policy.";

  return {
    decision,
    label,
    riskScore,
    allowed: decision !== "block",
    executionAmountUsd,
    sourceLimitUsd: effectiveLimit,
    warnings,
    blocks,
    reasons,
    explanation,
    summary,
    policySnapshot: normalizedPolicy,
  };
}

module.exports = {
  PERSONA_PRESETS,
  evaluateTradingBlink,
  getPersonaPreset,
  normalizePolicyForTrading,
};
