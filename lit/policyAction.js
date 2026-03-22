const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

(() => {
  const raw = typeof payload === "string" ? payload : "{}";
  const parsed = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  })();

  const amount = toNumber(parsed.amount, 0);
  const slippage = toNumber(parsed.slippage, 1000);
  const source = String(parsed.source || "").toLowerCase();

  let verdict = "allow";
  let reason = "Policy check passed";
  let safeAmount = amount;

  if (slippage > 100) {
    verdict = "deny";
    reason = "Slippage exceeds 100 bps policy cap";
    safeAmount = 0;
  }

  if (source.includes("untrusted")) {
    verdict = "deny";
    reason = "Untrusted execution source";
    safeAmount = 0;
  }

  const response = JSON.stringify({
    verdict,
    reason,
    safeAmount,
    observedAmount: amount,
    observedSlippage: slippage,
    payloadHash,
  });

  Lit.Actions.setResponse({ response });
})();
