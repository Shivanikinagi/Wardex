require("dotenv").config();

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${url} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function getJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${url} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const baseUrl = process.env.wardex_BASE_URL || "http://localhost:8787";
  const ensName = process.env.wardex_MEMORY_ENS || "alice.eth";

  const first = await postJson(`${baseUrl}/api/agent-memory/ask`, {
    ensName,
    prompt: "My preferred risk profile is medium and I avoid meme tokens.",
  });

  const second = await postJson(`${baseUrl}/api/agent-memory/ask`, {
    ensName,
    prompt: "Based on my saved preferences, should I execute a PEPE trade right now?",
  });

  const state = await getJson(
    `${baseUrl}/api/agent-memory/state?ensName=${encodeURIComponent(ensName)}`
  );

  console.log("First turn stored CID:", first.storedCid || "none");
  console.log("Second turn retrieved previous memory:", second.previousMemory || null);
  console.log("Second turn stored CID:", second.storedCid || "none");
  console.log("History length:", Array.isArray(state.history) ? state.history.length : 0);
  console.log("Second answer:", second.answer);
}

main().catch((error) => {
  console.error("agent-memory test failed:", error.message || error);
  process.exitCode = 1;
});