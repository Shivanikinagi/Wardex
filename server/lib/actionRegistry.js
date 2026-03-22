const ACTIONS = {
  "uniswap-swap": {
    id: "uniswap-swap",
    title: "Protected Uniswap Swap",
    description:
      "Base-native Blink routed through wardex, checked against ENS rules, and executed with a fresh stealth address.",
    protocol: "uniswap",
    sourceChain: "base",
    settlementChain: "base",
    label: "Execute Swap",
    iconPath: "/api/assets/wardex.svg",
    defaultAmountUsd: 600,
    defaultSlippageBps: 100,
    defaultTokens: {
      tokenIn: "USDC",
      tokenOut: "ETH",
    },
    estimateUsdValue(payload) {
      return Number(payload.amountUsd ?? this.defaultAmountUsd);
    },
  },
  "oneinch-swap": {
    id: "oneinch-swap",
    title: "Protected 1inch Swap",
    description:
      "Base aggregation routes are only accepted when the ENS rulebook allows the protocol, trade size, and slippage profile.",
    protocol: "1inch",
    sourceChain: "base",
    settlementChain: "base",
    label: "Route via 1inch",
    iconPath: "/api/assets/wardex.svg",
    defaultAmountUsd: 250,
    defaultSlippageBps: 75,
    defaultTokens: {
      tokenIn: "USDC",
      tokenOut: "ETH",
    },
    estimateUsdValue(payload) {
      return Number(payload.amountUsd ?? this.defaultAmountUsd);
    },
  },
  "aave-supply": {
    id: "aave-supply",
    title: "Protected Aave Supply",
    description:
      "Deposits are only accepted when the ENS rulebook allows the protocol, spend size, and slippage profile.",
    protocol: "aave",
    sourceChain: "base",
    settlementChain: "base",
    label: "Supply to Aave",
    iconPath: "/api/assets/wardex.svg",
    defaultAmountUsd: 300,
    defaultSlippageBps: 50,
    defaultTokens: {
      tokenIn: "USDC",
      tokenOut: "aUSDC",
    },
    estimateUsdValue(payload) {
      return Number(payload.amountUsd ?? this.defaultAmountUsd);
    },
  },
};

function listActions() {
  return Object.values(ACTIONS);
}

function getAction(actionId) {
  return ACTIONS[actionId] || null;
}

function buildActionMetadata(action, baseUrl) {
  return {
    type: "action",
    title: action.title,
    icon: `${baseUrl}${action.iconPath}`,
    description: action.description,
    label: action.label,
    links: {
      actions: [
        {
          href: `${baseUrl}/api/actions/${action.id}?ensName={ensName}&amountUsd={amountUsd}&account={account}`,
          label: `${action.label} via wardex`,
          parameters: [
            {
              name: "ensName",
              label: "ENS profile",
              required: true,
            },
            {
              name: "amountUsd",
              label: "USD size",
              required: true,
            },
            {
              name: "account",
              label: "User account",
              required: false,
            },
          ],
        },
      ],
    },
  };
}

function buildManifest(baseUrl) {
  return {
    name: "wardex Blink Proxy",
    version: "1.0.0",
    description:
      "Policy-gated Blink execution for AI agents. ENS is the rulebook and stealth addresses remain mandatory.",
    actions: listActions().map((action) => ({
      id: action.id,
      title: action.title,
      protocol: action.protocol,
      sourceChain: action.sourceChain,
      settlementChain: action.settlementChain,
      href: `${baseUrl}/api/actions/${action.id}`,
      metadataHref: `${baseUrl}/api/actions/${action.id}`,
    })),
  };
}

module.exports = {
  ACTIONS,
  buildActionMetadata,
  buildManifest,
  getAction,
  listActions,
};
