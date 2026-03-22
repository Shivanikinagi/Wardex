const { randomUUID } = require("crypto");
const { Wallet } = require("ethers");

class ExecutionAdapter {
  constructor({ mode = process.env.wardex_EXECUTION_MODE || "mock" } = {}) {
    this.mode = mode;
    this.syncedPolicies = new Map();
  }

  async syncPermissions(ensName, policy) {
    this.syncedPolicies.set(ensName, {
      active: policy.active,
      maxSpendUsd: policy.maxSpendUsd,
      dailyLimitUsd: policy.dailyLimitUsd,
      allowedProtocols: [...policy.allowedProtocols],
      syncedAt: new Date().toISOString(),
    });

    return {
      mode: this.mode,
      synced: true,
    };
  }

  async execute({ ensName, action, evaluation }) {
    const syncedPolicy = this.syncedPolicies.get(ensName);
    if (!syncedPolicy || syncedPolicy.active === false) {
      throw new Error("Execution is currently frozen for this ENS profile.");
    }

    const stealthWallet = Wallet.createRandom();
    const txid = `mocktx_${Date.now()}_${randomUUID().slice(0, 8)}`;

    return {
      mode: "mock",
      txid,
      stealthAddress: stealthWallet.address,
      settlementNetwork: action.settlementChain,
      amountUsd: evaluation.amountUsd,
      receiptUrl: null,
    };
  }
}

module.exports = {
  ExecutionAdapter,
};
