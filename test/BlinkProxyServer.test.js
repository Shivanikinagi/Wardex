const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createBlinkProxyServer } = require("../server");

const SAMPLE_URLS = {
  influencerMeme:
    "https://x.com/moonalpha/status/20991?protocol=uniswap&chain=base&tokenIn=USDC&tokenOut=PEPE&amountUsd=1000&slippageBps=220&liquidityUsd=65000&source=influencer&sender=%40moonalpha",
  aiBotEth:
    "https://ai.darkagent.trade/recommendation?protocol=uniswap&chain=base&tokenIn=USDC&tokenOut=ETH&amountUsd=800&slippageBps=80&liquidityUsd=2200000&source=ai_bot&sender=DeepTrendBot",
  safeFriend:
    "https://friend.trade/blink?protocol=uniswap&chain=base&tokenIn=USDC&tokenOut=ETH&amountUsd=120&slippageBps=40&liquidityUsd=5300000&source=friend&sender=Riya",
};

function createTempDataDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "darkagent-blink-"));
  const sourceDir = path.join(__dirname, "..", "server", "data");

  fs.copyFileSync(
    path.join(sourceDir, "ens-policies.seed.json"),
    path.join(tempDir, "ens-policies.seed.json")
  );
  fs.copyFileSync(
    path.join(sourceDir, "ens-policies.seed.json"),
    path.join(tempDir, "ens-policies.json")
  );
  fs.copyFileSync(
    path.join(sourceDir, "activity-log.json"),
    path.join(tempDir, "activity-log.json")
  );
  fs.copyFileSync(
    path.join(sourceDir, "proofs.json"),
    path.join(tempDir, "proofs.json")
  );

  return tempDir;
}

async function createHarness() {
  const dataDir = createTempDataDir();
  const app = createBlinkProxyServer({
    dataDir,
    watchIntervalMs: 60000,
    executionMode: "mock",
  });
  const { port } = await app.start(0);
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    app,
    async request(urlPath, options = {}) {
      const response = await fetch(`${baseUrl}${urlPath}`, options);
      const payload = await response.json();
      return { response, payload };
    },
    async cleanup() {
      await app.stop();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

async function runCase(name, fn) {
  process.stdout.write(`- ${name}... `);
  await fn();
  process.stdout.write("ok\n");
}

async function main() {
  await runCase("manifest publishes registered actions", async () => {
    const harness = await createHarness();

    try {
      const { response, payload } = await harness.request("/api/actions/manifest");
      assert.equal(response.status, 200);
      assert.ok(payload.actions.length >= 3);
      assert.equal(payload.actions[0].href.includes("/api/actions/"), true);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase("integration status exposes the targeted sponsor tracks", async () => {
    const harness = await createHarness();

    try {
      const { response, payload } = await harness.request("/api/integrations");
      assert.equal(response.status, 200);
      assert.ok(Array.isArray(payload.sponsors));

      const sponsorKeys = payload.sponsors.map((entry) => entry.key);
      assert.deepEqual(
        sponsorKeys,
        ["base", "ens", "filecoin", "lit", "zyfai", "lido", "status"]
      );
      assert.ok(payload.sponsors.every((entry) => typeof entry.detail === "string"));
    } finally {
      await harness.cleanup();
    }
  });

  await runCase("integration status surfaces env-backed Filecoin and Status evidence", async () => {
    const previousEnv = {
      FILECOIN_LAST_TEST_CID: process.env.FILECOIN_LAST_TEST_CID,
      STATUS_DEPLOY_TX_HASH: process.env.STATUS_DEPLOY_TX_HASH,
      STATUS_EXECUTION_TX_HASH: process.env.STATUS_EXECUTION_TX_HASH,
    };

    process.env.FILECOIN_LAST_TEST_CID =
      "bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy";
    process.env.STATUS_DEPLOY_TX_HASH = `0x${"1".repeat(64)}`;
    process.env.STATUS_EXECUTION_TX_HASH = `0x${"2".repeat(64)}`;

    const harness = await createHarness();

    try {
      const { response, payload } = await harness.request("/api/integrations");
      assert.equal(response.status, 200);

      const byKey = new Map(payload.sponsors.map((entry) => [entry.key, entry]));
      const filecoin = byKey.get("filecoin");
      const status = byKey.get("status");

      assert.equal(filecoin.status, "ready");
      assert.ok(
        filecoin.evidence.some((entry) =>
          String(entry.href || "").includes("calibration.filfox.info/en/message/")
        )
      );
      assert.equal(status.status, "ready");
      assert.ok(
        status.evidence.some((entry) =>
          String(entry.href || "").includes("sepolia.status.network/tx/")
        )
      );
    } finally {
      await harness.cleanup();

      for (const [key, value] of Object.entries(previousEnv)) {
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  await runCase("proof view route renders html instead of raw json", async () => {
    const harness = await createHarness();

    try {
      const response = await fetch(`${harness.baseUrl}/api/proofs/ff06effa-1b08-43b0-92d2-307bbbfed63a/view`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") || "", /text\/html/i);
      assert.match(html, /DarkAgent Proof Receipt/);
      assert.match(html, /ff06effa-1b08-43b0-92d2-307bbbfed63a/);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase("risky influencer Blink URL is blocked with a signed proof", async () => {
    const harness = await createHarness();

    try {
      const { response, payload } = await harness.request("/api/blinks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "alice.eth",
          url: SAMPLE_URLS.influencerMeme,
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(payload.parsedBlink.sourceCategory, "influencer");
      assert.equal(payload.parsedBlink.tokenOut, "PEPE");
      assert.equal(payload.analysis.decision, "block");
      assert.equal(payload.analysis.label, "Blocked");
      assert.ok(payload.analysis.explanation.some((entry) => entry.includes("meme coin")));
      assert.match(payload.proof.receiptHash, /^0x[a-fA-F0-9]{64}$/);
      assert.equal(payload.proof.verified, true);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase("AI bot Blink URL is auto-downsized until the watcher syncs a higher limit", async () => {
    const harness = await createHarness();

    try {
      let result = await harness.request("/api/blinks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "alice.eth",
          url: SAMPLE_URLS.aiBotEth,
        }),
      });

      assert.equal(result.response.status, 200);
      assert.equal(result.payload.analysis.decision, "auto-downsize");
      assert.equal(result.payload.analysis.executionAmountUsd, 300);
      assert.equal(result.payload.rewrittenBlinkUrl.includes("amountUsd=300"), true);
      assert.equal(result.payload.rewrittenBlinkUrl.includes("darkagentAdjusted=1"), true);

      const update = await harness.request("/api/policies/alice.eth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxTradeUsd: 1000,
          sourceLimits: {
            ai_bot: 900,
            influencer: 200,
            telegram: 150,
            friend: 150,
            unknown: 0,
          },
        }),
      });

      assert.equal(update.response.status, 200);
      assert.equal(update.payload.policy.sourceLimits.ai_bot, 900);

      result = await harness.request("/api/blinks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "alice.eth",
          url: SAMPLE_URLS.aiBotEth,
        }),
      });

      assert.equal(result.response.status, 200);
      assert.equal(result.payload.analysis.decision, "auto-downsize");
      assert.equal(result.payload.analysis.executionAmountUsd, 300);

      const sync = await harness.request("/api/watcher/sync", {
        method: "POST",
      });
      assert.equal(sync.response.status, 200);

      result = await harness.request("/api/blinks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "alice.eth",
          url: SAMPLE_URLS.aiBotEth,
        }),
      });

      assert.equal(result.response.status, 200);
      assert.equal(result.payload.analysis.decision, "allow");
      assert.equal(result.payload.analysis.executionAmountUsd, 800);
      assert.equal(result.payload.proof.verified, true);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase("safe friend Blink URL executes through the proxy with stealth settlement", async () => {
    const harness = await createHarness();

    try {
      const { response, payload } = await harness.request("/api/blinks/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "alice.eth",
          url: SAMPLE_URLS.safeFriend,
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(payload.analysis.decision, "allow");
      assert.equal(payload.parsedBlink.sourceCategory, "friend");
      assert.match(payload.execution.stealthAddress, /^0x[a-fA-F0-9]{40}$/);
      assert.ok(String(payload.execution.txid || "").length > 0);
      assert.equal(payload.proof.verified, true);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase("legacy action endpoint still respects watcher-synced policy changes", async () => {
    const harness = await createHarness();

    try {
      let result = await harness.request("/api/actions/uniswap-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "alice.eth",
          amountUsd: 900,
          tokenIn: "USDC",
          tokenOut: "ETH",
        }),
      });

      assert.equal(result.response.status, 403);
      assert.equal(result.payload.status, "blocked");
      assert.match(result.payload.proof.receiptHash, /^0x[a-fA-F0-9]{64}$/);

      const update = await harness.request("/api/policies/alice.eth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxSpendUsd: 1000 }),
      });

      assert.equal(update.response.status, 200);
      assert.equal(update.payload.policy.maxSpendUsd, 1000);

      result = await harness.request("/api/actions/uniswap-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "alice.eth",
          amountUsd: 900,
          tokenIn: "USDC",
          tokenOut: "ETH",
        }),
      });

      assert.equal(result.response.status, 403);
      assert.equal(result.payload.status, "blocked");

      const sync = await harness.request("/api/watcher/sync", {
        method: "POST",
      });
      assert.equal(sync.response.status, 200);

      result = await harness.request("/api/actions/uniswap-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "alice.eth",
          amountUsd: 900,
          tokenIn: "USDC",
          tokenOut: "ETH",
        }),
      });

      assert.equal(result.response.status, 200);
      assert.equal(result.payload.status, "executed");
      assert.match(result.payload.execution.stealthAddress, /^0x[a-fA-F0-9]{40}$/);
      assert.equal(result.payload.proof.verified, true);
    } finally {
      await harness.cleanup();
    }
  });

  await runCase("inactive ENS profile stays frozen", async () => {
    const harness = await createHarness();

    try {
      const { response, payload } = await harness.request("/api/actions/aave-supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName: "ops.eth",
          amountUsd: 300,
          tokenIn: "USDC",
          tokenOut: "aUSDC",
        }),
      });

      assert.equal(response.status, 403);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.proof.verdict, "blocked");
      assert.ok(payload.evaluation.violations.includes("agent.active=false"));
    } finally {
      await harness.cleanup();
    }
  });

  process.stdout.write("All Blink proxy tests passed.\n");
}

main().catch((error) => {
  console.error(`Blink proxy tests failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
