import "dotenv/config";
import { create } from "@web3-storage/w3up-client";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

function ensureEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function appendEnvLines(lines: string[]) {
  const envPath = resolve(process.cwd(), ".env");
  const existing = await fs.readFile(envPath, "utf8");
  const next = `${existing.trimEnd()}\n${lines.join("\n")}\n`;
  await fs.writeFile(envPath, next, "utf8");
}

async function main() {
  const email = ensureEnv("FILECOIN_W3UP_EMAIL");

  const client = await create();
  await client.login(email);

  const space = await client.createSpace("darkagent");
  await client.setCurrentSpace(space.did());

  const record = {
    test: true,
    timestamp: new Date().toISOString(),
    message: "DarkAgent Filecoin integration test",
  };

  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: "application/json",
  });
  const file = new File([blob], "darkagent-test.json");
  const cid = await client.uploadFile(file);

  const cidText = cid.toString();
  const spaceDid = space.did();

  console.log("Real CID:", cidText);
  console.log("Space DID:", spaceDid);
  console.log("Verify:", `https://w3s.link/ipfs/${cidText}`);

  if (String(process.env.FILECOIN_UPDATE_ENV || "").toLowerCase() === "true") {
    await appendEnvLines([
      `FILECOIN_SPACE_DID=${spaceDid}`,
      `FILECOIN_LAST_TEST_CID=${cidText}`,
    ]);
    console.log("Updated .env with FILECOIN_SPACE_DID and FILECOIN_LAST_TEST_CID");
  }
}

main().catch((error) => {
  console.error("setup-filecoin failed:", error.message || error);
  process.exitCode = 1;
});
