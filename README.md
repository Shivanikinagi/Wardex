# Wardex - Verifiable AI Agent Execution Boundaries

Live app: https://wardex.vercel.app
Demo video: https://loom.com/share/PASTE_AFTER_RECORDING
Backend API: http://localhost:8787

Wardex is a policy firewall for agentic DeFi execution. Every Blink is scored, enforced, executed, and provable.

## Sponsor Proofs Snapshot
- Filecoin PieceCID proof (FOC Calibration):
	- PieceCID: `bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy`
	- Verify: `https://calibration.filfox.info/en/message/bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy`
	- Command used: `npm run filecoin:foc:setup`
- Live Blink execution receipts (Base Sepolia):
	- Propose: `0x4f6f670b87c759d662412dd105653b4c0236bbdedb9cc902bb019633fbbe5eb5`
	- Verify: `0xee51b3ce34c3c3eb7fd1faac6113fa09a9b28bc90f86d8554a8019fea85d3044`
	- Execute: `0x8baf2728cb0b52685e06742dbc0954b7bca9ae918c00bb55296a83e1122a940d`

## End-to-end flow
1. Agent proposes a Blink URL.
2. Server resolves ENS policy and optional treasury yield budget.
3. Venice AI scores risk (optionally funded by Zyfai yield).
4. Optional Lit sealed policy verdict can override decision.
5. Allowed execution is run and a proof receipt is generated.
6. Execution record is uploaded to Filecoin and CID is returned.

## Local setup
```bash
git clone https://github.com/Shivanikinagi/Wardex
cd Wardex/wardex
cp .env.example .env
# fill all required env vars for your integrations

npm install
cd frontend && npm install && cd ..

npm run compile
npm run deploy
npm run verify

npm run blink:server 
# terminal 2
cd frontend
npm run dev
```

## Deployments
- Wardex contract: https://sepolia.basescan.org/address/PASTE_WARDEX_ADDRESS
- ENS resolver: https://sepolia.basescan.org/address/PASTE_ENS_RESOLVER_ADDRESS
- Verifier: https://sepolia.basescan.org/address/PASTE_VERIFIER_ADDRESS
- Agent treasury: https://sepolia.basescan.org/address/PASTE_TREASURY_ADDRESS
- Status network tx: https://sepolia.status.network/tx/PASTE_STATUS_TX

## Track submissions

### Lido - stETH Treasury ($3,000)
`AgentTreasury.sol` enforces principal lock semantics and exposes `availableYieldStETH()` for spend budget only. Policy checks clamp max execution amount to treasury yield when configured.

Evidence:
- Treasury contract address: `PASTE_TREASURY_ADDRESS`
- Deposit tx: `PASTE_TREASURY_DEPOSIT_TX`

### Filecoin - Agentic Storage ($1,000)
After successful execution, backend uploads an immutable compliance record and returns `filecoinCid` in API response and UI success panel.

Evidence:
- FOC setup script now succeeds with real on-chain storage proof.
- PieceCID: `bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy`
- Verify: `https://calibration.filfox.info/en/message/bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy`
- Script: `npm run filecoin:foc:setup`

### Lit Protocol - Dark Knowledge ($250)
Backend can call a Lit policy endpoint and consume sealed verdict output (`litActionCid` + verdict) without exposing raw rule payloads.

Evidence:
- Lit Action CID: `not returned (LIT_POLICY_API_URL / LIT_ACTION_CID not configured)`

### Zyfai - Yield Powered Agent ($600)
Before Venice scoring, backend can query Zyfai yield balance and deduct inference cost after scoring. UI indicates whether inference was funded by Zyfai yield.

Evidence:
- Zyfai mode: `simulated` via `ZYFAI_SIMULATED_YIELD_USDC=10`
- Venice funding status: `Venice API reachable but account has insufficient credits`

### Status Network ($50)
Hardhat config includes `status_sepolia` (chain id `1660990954`, zero gas price path) for fast qualification deploy and tx proof.

Evidence:
- Status deploy tx: `PASTE_STATUS_DEPLOY_TX`
- Status execution tx: `PASTE_STATUS_GASLESS_TX`

### Base - Agent Services ($5,000)
`POST /analyze-blink` is payment-gated in production and returns deterministic decision payloads suitable for agent service consumers.

Evidence:
- Endpoint: `POST /analyze-blink`
- x402 metadata: amount `0.001`, currency `USDC`, network `base-sepolia`
- Live analyze proof id: `9a9a462c-9e3c-445d-9656-f33e7f5e5198`
- Live execute proof id: `6cd2bf35-2862-443f-b2fd-5cd03f9f3d85`
- Live execute tx id (propose): `0x4f6f670b87c759d662412dd105653b4c0236bbdedb9cc902bb019633fbbe5eb5`
- Live execute tx id (verify): `0xee51b3ce34c3c3eb7fd1faac6113fa09a9b28bc90f86d8554a8019fea85d3044`
- Live execute tx id (execute): `0x8baf2728cb0b52685e06742dbc0954b7bca9ae918c00bb55296a83e1122a940d`
- Live execute status: `200 OK`

### ENS Identity ($600)
Policies are keyed by ENS names and rendered in frontend for each analysis and policy panel context.

Evidence:
- Example profile: `alice.eth`

### Open Track
Wardex combines ENS policy control, paid analysis, yield-constrained spending, verifiable execution receipts, and immutable compliance logs.

## Required environment variables
Core:
- `PRIVATE_KEY`
- `BASE_SEPOLIA_RPC`
- `BASESCAN_API_KEY`
- `DEPLOYER_ADDRESS`

Scoring and paywall:
- `VENICE_API_KEY`
- `X402_AMOUNT`
- `X402_CURRENCY`
- `X402_NETWORK`

Lido / treasury:
- `AGENT_TREASURY_CONTRACT`
- `WSTETH_CONTRACT`

Filecoin:
- `FILECOIN_UPLOAD_ENDPOINT`
- `FILECOIN_API_KEY`

Lit:
- `LIT_POLICY_API_URL`
- `LIT_ACTION_CID`

Zyfai:
- `ZYFAI_API_URL`
- `ZYFAI_API_KEY`
- `ZYFAI_ACCOUNT_ID`
