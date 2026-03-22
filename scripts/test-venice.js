require("dotenv").config();

async function main() {
  const apiKey = String(process.env.VENICE_API_KEY || "").trim();
  const model = String(process.env.VENICE_MODEL || "llama-3.3-70b").trim();

  if (!apiKey) {
    throw new Error("Missing VENICE_API_KEY in .env");
  }

  const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply exactly: Venice is live" }],
      max_tokens: 20,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 402) {
      console.log(
        "Venice API reachable but account has insufficient credits. Add balance at https://venice.ai/settings/api"
      );
      return;
    }
    throw new Error(`Venice API failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  const output = payload?.choices?.[0]?.message?.content || "";
  console.log("Venice response:", output);
}

main().catch((error) => {
  console.error("Venice test failed:", error.message || error);
  process.exitCode = 1;
});
