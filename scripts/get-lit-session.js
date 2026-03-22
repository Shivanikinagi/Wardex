require("dotenv").config();

const litSdk = require("../sdk/lit");

function printStatus(status) {
  const actionState =
    status.probe.ok === false
      ? "configured (network offline)"
      : status.canExecuteAction
        ? "ready"
        : "not ready";

  console.log("Lit SDK package:", status.sdkPackage || "not installed");
  console.log("Lit network:", status.network);
  console.log("Auth mode:", status.authMode);
  console.log("Action execution:", actionState);

  if (status.actionCid) {
    console.log("Lit Action CID:", status.actionCid);
    console.log("Verify:", `https://ipfs.io/ipfs/${status.actionCid}`);
  } else {
    console.log("Lit Action CID: not configured");
  }

  if (status.relayEndpoint) {
    console.log("Relay endpoint:", status.relayEndpoint);
  }

  if (status.probe.ok === true) {
    console.log("Network probe: connected");
  } else if (status.probe.ok === false) {
    console.log("Network probe: offline");
    console.log("Probe error:", status.probe.error);
  } else {
    console.log("Network probe: skipped");
  }
}

async function main() {
  const status = await litSdk.getIntegrationStatus({
    probeConnection: true,
  });
  printStatus(status);

  const actionCid = String(process.env.LIT_ACTION_CID || "").trim();
  const envSessionSigs = litSdk.parseSessionSigs();
  const envAuthSig = litSdk.parseAuthSig();

  if (!actionCid && !status.relayEndpoint) {
    console.log(
      "\nSet LIT_ACTION_CID for SDK execution or LIT_POLICY_API_URL for relay fallback."
    );
    return;
  }

  let sessionSigs = envSessionSigs;
  if (!sessionSigs && actionCid && status.authMode === "private_key_session") {
    try {
      sessionSigs = await litSdk.createSessionSigs({
        actionCid,
        jsParams: {
          payload: JSON.stringify({
            amount: 800,
            slippage: 2,
            source: "ai_bot",
          }),
          payloadHash: "0xtest",
        },
      });

      if (sessionSigs) {
        console.log("\nSession signatures generated successfully.");
        console.log("Add to .env:");
        console.log(`LIT_SESSION_SIGS_JSON=${JSON.stringify(sessionSigs)}`);
      } else {
        console.warn(
          "\nSession signature generation was skipped because the Lit network is not reachable from this shell."
        );
      }
    } catch (error) {
      console.warn(
        "\nCould not generate session signatures automatically:",
        String(error?.message || error)
      );
    }
  } else if (sessionSigs) {
    console.log("\nUsing existing LIT_SESSION_SIGS_JSON from .env");
  } else if (envAuthSig) {
    console.log("\nUsing existing LIT_AUTH_SIG from .env");
  }

  if (!actionCid) {
    return;
  }

  try {
    const verdict = await litSdk.queryPolicyVerdict({
      actionCid,
      blinkPayload: {
        amount: 800,
        slippage: 2,
        source: "ai_bot",
      },
    });

    if (!verdict) {
      console.log(
        "\nNo Lit verdict returned. Configure session sigs, auth sig, or a PRIVATE_KEY for SDK-backed execution."
      );
      return;
    }

    console.log("\nLit action probe:");
    console.log(JSON.stringify(verdict, null, 2));
  } catch (error) {
    const message = String(error?.message || error || "");
    if (message.toLowerCase().includes("fetch failed")) {
      console.warn("\nLit action probe skipped:", message);
      console.warn(
        "This environment cannot currently reach the Lit network. The project is configured to fall back cleanly until network access is available."
      );
      return;
    }

    throw error;
  }
}

main().catch((error) => {
  const message = String(error?.message || error || "");
  if (message.toLowerCase().includes("fetch failed")) {
    console.warn("get-lit-session warning:", message);
    console.warn(
      "The environment is offline for Lit network calls. Configure proofs in .env and rerun from a network-enabled shell when needed."
    );
    return;
  }

  console.error("get-lit-session failed:", message);
  process.exitCode = 1;
});
