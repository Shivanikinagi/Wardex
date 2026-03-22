const { createHash } = require("crypto");

function hashPolicies(policies) {
  return createHash("sha256")
    .update(JSON.stringify(policies))
    .digest("hex");
}

class PolicyWatcher {
  constructor({ store, executor, intervalMs = 15000, onSync = null }) {
    this.store = store;
    this.executor = executor;
    this.intervalMs = intervalMs;
    this.onSync = onSync;
    this.timer = null;
    this.syncedPolicies = {};
    this.lastHash = "";
    this.lastSyncedAt = null;
    this.version = 0;
  }

  async syncOnce(reason = "poll") {
    const policies = this.store.readAll();
    const nextHash = hashPolicies(policies);

    if (reason === "poll" && nextHash === this.lastHash) {
      return {
        changed: false,
        version: this.version,
        lastSyncedAt: this.lastSyncedAt,
      };
    }

    for (const [ensName, policy] of Object.entries(policies)) {
      await this.executor.syncPermissions(ensName, policy);
    }

    this.syncedPolicies = policies;
    this.lastHash = nextHash;
    this.lastSyncedAt = new Date().toISOString();
    this.version += 1;

    const result = {
      changed: true,
      reason,
      version: this.version,
      lastSyncedAt: this.lastSyncedAt,
    };

    if (typeof this.onSync === "function") {
      this.onSync(result);
    }

    return result;
  }

  async start() {
    await this.syncOnce("startup");
    this.timer = setInterval(() => {
      this.syncOnce("poll").catch((error) => {
        console.error("[wardex Watcher] Sync failed:", error.message);
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getPolicy(ensName) {
    return this.syncedPolicies[String(ensName || "").toLowerCase()] || null;
  }

  getStatus() {
    return {
      intervalMs: this.intervalMs,
      lastSyncedAt: this.lastSyncedAt,
      version: this.version,
      syncedProfiles: Object.keys(this.syncedPolicies),
    };
  }
}

module.exports = {
  PolicyWatcher,
};
