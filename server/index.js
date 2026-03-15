const http = require("http");
const path = require("path");
const { URL } = require("url");

const {
  buildActionMetadata,
  buildManifest,
  getAction,
  listActions,
} = require("./lib/actionRegistry");
const { ActivityStore } = require("./lib/activityStore");
const { BitGoExecutionAdapter } = require("./lib/bitgoExecutionAdapter");
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
  const proofStore = new ProofStore({
    filePath: path.join(dataDir, "proofs.json"),
  });
  const shareLinkStore = new ShareLinkStore({
    filePath: path.join(dataDir, "share-links.json"),
  });
  const executor = new BitGoExecutionAdapter({
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

  function buildDemoState(baseUrl) {
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

    const policy = watcher.getPolicy(normalizedEnsName) || policyStore.get(normalizedEnsName);
    let parsedBlink;

    try {
      parsedBlink = parseBlinkUrl(blinkUrl);
    } catch (error) {
      const invalidUrlError = new Error("Blink URL is invalid.");
      invalidUrlError.statusCode = 400;
      throw invalidUrlError;
    }

    const analysis = evaluateTradingBlink({
      blink: parsedBlink,
      policy,
    });
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
            policies: `${baseUrl}/api/policies`,
            proofs: `${baseUrl}/api/proofs`,
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

      if (request.method === "POST" && pathName === "/api/blinks/analyze") {
        const body = await readRequestBody(request);
        const blinkUrl = String(body.url || body.blinkUrl || "").trim();
        const ensName = normalizeEnsName(body.ensName || "alice.eth");
        const result = await runUrlAnalysis({ ensName, blinkUrl });

        appendActivity({
          type: "analysis",
          ensName,
          source: result.parsedBlink.sourceCategory,
          sourceName: result.parsedBlink.sourceName,
          protocol: result.parsedBlink.protocol,
          amountUsd: result.parsedBlink.amountUsd,
          status: result.analysis.decision,
          reason: result.analysis.summary,
        });

        const proof = await proofService.createProof({
          kind: "blink-analysis",
          verdict: result.analysis.decision,
          ensName,
          actionId: `${result.parsedBlink.protocol}-analyze`,
          policy: result.policy,
          evaluation: result.analysis,
          watcher: watcher.getStatus(),
          reason: result.analysis.summary,
        });

        writeJson(response, 200, {
          parsedBlink: result.parsedBlink,
          analysis: result.analysis,
          rewrittenBlinkUrl: result.rewrittenBlinkUrl,
          proof,
        });
        return;
      }

      if (request.method === "POST" && pathName === "/api/blinks/execute") {
        const body = await readRequestBody(request);
        const blinkUrl = String(body.url || body.blinkUrl || "").trim();
        const ensName = normalizeEnsName(body.ensName || "alice.eth");
        const result = await runUrlAnalysis({ ensName, blinkUrl });

        appendActivity({
          type: "analysis",
          ensName,
          source: result.parsedBlink.sourceCategory,
          sourceName: result.parsedBlink.sourceName,
          protocol: result.parsedBlink.protocol,
          amountUsd: result.parsedBlink.amountUsd,
          status: result.analysis.decision,
          reason: result.analysis.summary,
        });

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
          });

          writeJson(response, 403, {
            parsedBlink: result.parsedBlink,
            analysis: result.analysis,
            rewrittenBlinkUrl: result.rewrittenBlinkUrl,
            proof,
            message: result.analysis.summary,
          });
          return;
        }

        const executed = await executeAnalyzedBlink({
          ensName,
          parsedBlink: result.parsedBlink,
          analysis: result.analysis,
          blinkUrl,
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
        });

        writeJson(response, 200, {
          parsedBlink: result.parsedBlink,
          analysis: result.analysis,
          rewrittenBlinkUrl: executed.rewrittenBlinkUrl,
          execution: executed.execution,
          proof,
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
        writeJson(response, 200, buildDemoState(baseUrl));
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
