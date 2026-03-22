require("dotenv").config();
delete process.env.DEBUG;

const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, ...args) => {
  const text = String(chunk || "");
  if (text.includes("lit-js-sdk:constants:")) {
    return true;
  }
  return originalStderrWrite(chunk, ...args);
};

const fs = require("fs");
const path = require("path");

async function main() {
  let litSdk;
  try {
    litSdk = require("@lit-protocol/lit-node-client");
  } catch {
    throw new Error("Missing @lit-protocol/lit-node-client. Run npm install first.");
  }

  const sourcePath = path.resolve(
    process.cwd(),
    process.env.LIT_ACTION_SOURCE_PATH || "lit/policyAction.js"
  );
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Lit action source not found at ${sourcePath}`);
  }

  const code = fs.readFileSync(sourcePath, "utf8");
  if (typeof litSdk.uploadToIPFS !== "function") {
    const configuredCid = String(process.env.LIT_ACTION_CID || "").trim();
    console.log("uploadToIPFS is not available in the installed Lit SDK build.");
    console.log("Use Lit deployment tooling to upload this action source and set LIT_ACTION_CID.");
    if (configuredCid) {
      console.log("\nCurrent LIT_ACTION_CID from .env:", configuredCid);
      console.log("Verify:", `https://ipfs.io/ipfs/${configuredCid}`);
    }
    console.log("\nAction source validated at:", sourcePath);
    return;
  }

  console.log("Uploading Lit Action to IPFS...");
  const cid = await litSdk.uploadToIPFS(code);
  console.log("\nLit Action uploaded");
  console.log("CID:", cid);
  console.log("Verify:", `https://ipfs.io/ipfs/${cid}`);
  console.log("\nAdd to .env:");
  console.log(`LIT_ACTION_CID=${cid}`);
}

main().catch((error) => {
  console.error("upload-lit-action failed:", error.message || error);
  process.exitCode = 1;
});