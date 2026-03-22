# Wardex

> **Verifiable AI Agent Execution Boundaries** — every Blink scored, enforced, executed, and provable.

🌐 [Live App](https://wardex.vercel.app) · 🎥 [Demo Video](https://loom.com/share/PASTE_AFTER_RECORDING) · 📡 Backend: `localhost:8787`

Wardex is a policy firewall for agentic DeFi execution. Agents propose actions (Blinks). Wardex scores risk via Venice AI, enforces ENS-keyed policies, optionally gates spending to treasury yield, seals verdicts with Lit Protocol, and writes immutable compliance proofs to Filecoin — all on Base Sepolia.

---

## Execution Flow

```
Agent proposes Blink URL
         │
         ▼
  Resolve ENS policy
  + optional yield budget (Zyfai / stETH treasury)
         │
         ▼
  Venice AI scores risk
  (inference optionally funded by Zyfai yield)
         │
         ▼
  Optional: Lit sealed policy verdict
  (can override decision without exposing raw rules)
         │
         ▼
  Allowed? → Execute Blink
         │
         ▼
  Proof receipt generated on-chain (Base Sepolia)
         │
         ▼
  Execution record uploaded to Filecoin → CID returned
```

---

## Sponsor Proofs

### 🔵 Base — Agent Services
`POST /analyze-blink` is payment-gated via x402 and returns deterministic decision payloads for agent service consumers.

| Field | Value |
|---|---|
| Paywall | `0.001 USDC` · `base-sepolia` |
| Live analyze proof | `9a9a462c-9e3c-445d-9656-f33e7f5e5198` |
| Live execute proof | `6cd2bf35-2862-443f-b2fd-5cd03f9f3d85` |
| Propose tx | [`0x4f6f67...`](https://sepolia.basescan.org/tx/0x4f6f670b87c759d662412dd105653b4c0236bbdedb9cc902bb019633fbbe5eb5) |
| Verify tx | [`0xee51b3...`](https://sepolia.basescan.org/tx/0xee51b3ce34c3c3eb7fd1faac6113fa09a9b28bc90f86d8554a8019fea85d3044) |
| Execute tx | [`0x8baf27...`](https://sepolia.basescan.org/tx/0x8baf2728cb0b52685e06742dbc0954b7bca9ae918c00bb55296a83e1122a940d) |
| Execute status | `200 OK` |

### 🟢 Filecoin — Agentic Storage
After every successful execution, the backend uploads an immutable compliance record and returns `filecoinCid` in the API response and UI success panel.

| Field | Value |
|---|---|
| PieceCID | `bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy` |
| Verify | [filfox calibration explorer](https://calibration.filfox.info/en/message/bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy) |
| Setup script | `npm run filecoin:foc:setup` |

### 🟡 Lido — stETH Treasury
`AgentTreasury.sol` enforces principal lock semantics. `availableYieldStETH()` exposes yield-only spend budget. Policy checks clamp max execution amount to treasury yield when configured.

| Field | Value |
|---|---|
| Contract | `PASTE_TREASURY_ADDRESS` |
| Deposit tx | `PASTE_TREASURY_DEPOSIT_TX` |

### 🟣 Zyfai — Yield-Powered Agent
Before Venice scoring, the backend queries Zyfai yield balance and deducts inference cost post-scoring. UI shows whether inference was yield-funded.

| Field | Value |
|---|---|
| Mode | `simulated` via `ZYFAI_SIMULATED_YIELD_USDC=10` |
| Venice status | API reachable; insufficient credits on current account |

### 🔴 Lit Protocol — Dark Knowledge
Backend calls a Lit policy endpoint and consumes sealed verdict output (`litActionCid` + verdict) without exposing raw rule payloads to the caller.

| Field | Value |
|---|---|
| Lit Action CID | Not configured — set `LIT_POLICY_API_URL` + `LIT_ACTION_CID` |

### ⚪ Status Network
Hardhat config includes `status_sepolia` (chain ID `1660990954`, zero gas price path) for gasless qualification deploy and tx proof.

| Field | Value |
|---|---|
| Deploy tx | `PASTE_STATUS_DEPLOY_TX` |
| Execution tx | `PASTE_STATUS_GASLESS_TX` |

### 🔷 ENS Identity
Policies are keyed by ENS names and rendered in the frontend for each analysis and policy panel context.

| Field | Value |
|---|---|
| Example profile | `alice.eth` |

---

## Deployed Contracts

| Contract | Address |
|---|---|
| Wardex | [BaseScan ↗](https://sepolia.basescan.org/address/PASTE_WARDEX_ADDRESS) |
| ENS Resolver | [BaseScan ↗](https://sepolia.basescan.org/address/PASTE_ENS_RESOLVER_ADDRESS) |
| Verifier | [BaseScan ↗](https://sepolia.basescan.org/address/PASTE_VERIFIER_ADDRESS) |
| Agent Treasury | [BaseScan ↗](https://sepolia.basescan.org/address/PASTE_TREASURY_ADDRESS) |
| Status Network tx | [Status Explorer ↗](https://sepolia.status.network/tx/PASTE_STATUS_TX) |

---

## Local Setup

```bash
git clone https://github.com/Shivanikinagi/Wardex
cd Wardex/wardex

cp .env.example .env
# Fill in all required environment variables (see below)

npm install
cd frontend && npm install && cd ..

npm run compile
npm run deploy
npm run verify
```

**Terminal 1 — backend:**
```bash
npm run blink:server
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8787 |

---

## Environment Variables

### Core
```env
PRIVATE_KEY=
BASE_SEPOLIA_RPC=
BASESCAN_API_KEY=
DEPLOYER_ADDRESS=
```

### Scoring & Paywall
```env
VENICE_API_KEY=
X402_AMOUNT=
X402_CURRENCY=
X402_NETWORK=
```

### Lido / Treasury
```env
AGENT_TREASURY_CONTRACT=
WSTETH_CONTRACT=
```

### Filecoin
```env
FILECOIN_UPLOAD_ENDPOINT=
FILECOIN_API_KEY=
```

### Lit Protocol
```env
LIT_POLICY_API_URL=
LIT_ACTION_CID=
```

### Zyfai
```env
ZYFAI_API_URL=
ZYFAI_API_KEY=
ZYFAI_ACCOUNT_ID=
ZYFAI_SIMULATED_YIELD_USDC=   # set to simulate yield without live account
```

---

## Open Track Summary

Wardex combines ENS policy control, x402-gated paid analysis, yield-constrained spending via stETH treasury and Zyfai, verifiable on-chain execution receipts, sealed Lit verdicts, and immutable Filecoin compliance logs — forming a complete verifiable boundary layer for agentic DeFi.

---

## License

MIT
