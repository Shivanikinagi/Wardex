# DarkAgent 🔒

> **Privacy-preserving autonomous AI agent framework with on-chain compliance, TEE attestation, and zero-knowledge proofs.**

Built for the Oracle hackathon. DarkAgent lets AI agents operate autonomously — trading, transacting, and coordinating — while giving regulators cryptographic proof of compliance without revealing any sensitive data.

---

## What It Solves

AI agents that hold real money are a black box. Nobody knows:
- Whether they are staying within their spending limits
- Whether they interacted with sanctioned entities
- Whether their code was tampered with mid-operation

DarkAgent solves all three — with math, not trust.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     AI Agent (TEE)                        │
│  ┌─────────────┐   ┌───────────────┐   ┌─────────────┐  │
│  │ agent.py    │   │ attestation.py│   │  BitGo SDK  │  │
│  │ (SGX/TDX)   │   │ (MRENCLAVE)   │   │  (wallet)   │  │
│  └──────┬──────┘   └───────┬───────┘   └──────┬──────┘  │
│         │                  │                  │          │
└─────────┼──────────────────┼──────────────────┼──────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Base Sepolia (L2)                      │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐   │
│  │  DarkAgent   │  │CapabilityCheck│  │  Verifier   │   │
│  │  Registry    │  │  (on-chain)   │  │  (ZK proofs)│   │
│  └──────────────┘  └───────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│              Noir ZK Circuit (compliance.nr)             │
│  Private: amount, recipient, attestation                 │
│  Public:  limits, whitelist root, sanctions hash         │
│  Output:  COMPLIANT / NON-COMPLIANT  ← regulator sees   │
└─────────────────────────────────────────────────────────┘
```

---

## Deployed Contracts (Base Sepolia)

| Contract | Address | Link |
|---|---|---|
| DarkAgent Registry | `0xA77f8507838CC8719ac5B59567D2c260c007A366` | [BaseScan](https://sepolia.basescan.org/address/0xA77f8507838CC8719ac5B59567D2c260c007A366) |
| CapabilityCheck | `0x357cC7108B86221AC83920713c0dA5B1e4800794` | [BaseScan](https://sepolia.basescan.org/address/0x357cC7108B86221AC83920713c0dA5B1e4800794) |
| Verifier (ZK) | `0x7D5d1222e12D1D26F512a9626B68ce2394C7e034` | [BaseScan](https://sepolia.basescan.org/address/0x7D5d1222e12D1D26F512a9626B68ce2394C7e034) |

## Demo Agents (ENS on Ethereum Sepolia)

| Agent | Address | ENS |
|---|---|---|
| Trading Agent | `0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60` | `trading-agent.dark26.eth` |
| Data Agent | `0xA28FA8e3391f4454F8E555F5A1Ef5ECC7486dF4F` | `data-agent.dark26.eth` |

---

## Key Features

### 1. TEE Attestation (Intel SGX / Gramine)
```
agent.py runs inside secure enclave
  → MRENCLAVE hash computed at startup
  → Stored on-chain in DarkAgent registry
  → Any code modification = hash mismatch = wallet frozen instantly
```

### 2. On-Chain Capability Enforcement
Agents declare capabilities at registration. Every action is checked on-chain:
- `MAKE_PAYMENT` — transfer funds
- `READ_MARKET_DATA` — price feeds
- `EXECUTE_TRADE` — DEX swaps
- `INTERACT_AGENTS` — agent-to-agent calls

Unauthorized action → transaction reverted.

### 3. Zero-Knowledge Compliance Proofs
The `circuits/compliance.nr` circuit proves **5 properties simultaneously**:
1. Transaction was within spending limits
2. Agent only contacted whitelisted agents
3. No sanctioned entities involved
4. TEE attestation was valid at time of action
5. Agent acted within declared capabilities

Regulator calls `queryCompliance(agent)` → gets `YES` or `NO`. No amounts, no identities, no strategy revealed.

### 4. Automatic Circuit Breaker
Three triggers freeze a wallet instantly:
- TEE attestation hash changes (code tampered)
- Spending limit exceeded
- Capability violation detected

Frozen agents cannot send any transactions until a security review unfreezes them.

### 5. ENS Identity
Agents have human-readable ENS names (`trading-agent.dark26.eth`) instead of raw addresses, making them auditable by name.

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- MetaMask (for frontend)

### Install
```bash
cd darkagent
npm install
cp .env.example .env  # fill in your credentials
```

### Run Tests
```bash
npx hardhat test
```

All 27 tests pass:
```
27 passing (3s)
✓ Agent Registration
✓ Spending Controls
✓ Circuit Breaker
✓ TEE Attestation
✓ ZK Compliance
✓ Verifier Contract
✓ CapabilityCheck Contract
```

### Deploy Contracts
```bash
npx hardhat run scripts/deploy.js --network base_sepolia
```

### Run the Kill Demo
The "kill demo" shows the full attack-and-defend cycle live:
```bash
cd darkagent
python demo/kill_agent.py
```

**What it demonstrates:**
- Phase 1: Agent identity (ENS name, capabilities, spending limits)
- Phase 2: Normal operation — payments approved, capability block shown
- Phase 3: Code tampered → MRENCLAVE mismatch → Circuit breaker fires → wallet frozen
- Phase 4: Attacker tries a theft tx → BLOCKED
- Phase 5: On-chain evidence with BaseScan link

### Launch Frontend Dashboard
```bash
cd darkagent/frontend
npm install
npm run dev
# → http://localhost:5173
```

Connect MetaMask to **Base Sepolia** (chainId 84532). The dashboard:
- Shows real-time agent status from on-chain data
- Displays spending progress bars, reputation scores, compliance stats
- One-click circuit breaker (with live transaction sent on-chain)
- Full compliance audit page with ZK proof query

### Generate ZK Compliance Proof
```bash
# Submit a spending_limit proof for the trading agent
node scripts/generate-zk-proof.js trading spending_limit

# Data agent, sanctions proof
node scripts/generate-zk-proof.js data sanctions

# With real Nargo (Linux/macOS): install nargo first
# curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
# nargo (auto-detected by the script)
```

### Compile Noir Circuit (Linux/macOS)
```bash
# Install nargo
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
source ~/.bashrc

# Compile
cd darkagent/circuits
nargo check    # type-check the circuit
nargo test     # run built-in tests
nargo compile  # generate proving/verification keys

# Generate a proof
nargo prove
```

---

## Project Structure

```
darkagent/
├── contracts/
│   ├── DarkAgent.sol          # Main registry: agent registration, circuit breaker
│   ├── CapabilityCheck.sol    # On-chain capability enforcement
│   ├── Verifier.sol           # ZK proof submission + compliance queries
│   └── interfaces/            # IBitGoWallet, IENS
├── circuits/
│   ├── Nargo.toml             # Noir project config
│   ├── compliance.nr          # ZK circuit (reference copy)
│   └── src/
│       └── main.nr            # Nargo entry point
├── tee/
│   ├── agent.py               # TEE agent runtime (SGX/Gramine)
│   ├── attestation.py         # MRENCLAVE simulation
│   └── manifest.toml          # Gramine manifest
├── demo/
│   └── kill_agent.py          # Live hackathon kill demo (5 phases)
├── scripts/
│   ├── deploy.js              # Full deployment
│   ├── generate-zk-proof.js   # ZK proof generation + submission
│   ├── ens-set-addresses.js   # ENS address record setter
│   ├── ens-verify.js          # ENS resolution verification
│   └── create-bitgo-wallet.js # BitGo wallet setup
├── sdk/
│   ├── policy.js              # Policy evaluation SDK
│   └── register.js            # Agent registration SDK
├── frontend/
│   └── src/
│       ├── App.jsx            # Main app + sidebar nav + wallet connection
│       ├── pages/
│       │   ├── Dashboard.jsx       # Agent status, tx monitor, kill-demo button
│       │   ├── Register.jsx        # Register new agents
│       │   ├── CircuitBreaker.jsx  # Live kill demo visualization
│       │   └── Audit.jsx           # ZK compliance audit queries
│       └── hooks/
│           └── useContracts.js # ethers.js contract bindings
└── test/
    └── DarkAgent.test.js      # 27 Hardhat tests
```

---

## How ZK Proofs Work

The Noir circuit (`circuits/src/main.nr`) takes **private** inputs that stay secret and **public** inputs that are verifiable on-chain:

```noir
fn main(
    // PRIVATE — never revealed
    transaction_amount: Field,
    recipient_hash: Field,
    attestation_hash: Field,
    ...

    // PUBLIC — verified on-chain
    max_per_transaction: pub Field,
    sanctions_list_hash: pub Field,
    expected_attestation: pub Field,
    ...
) {
    assert(transaction_amount <= max_per_transaction);  // within limits
    assert(attestation_hash == expected_attestation);   // unmodified TEE
    ...
}
```

The regulator only sees the public inputs and the single bit: **COMPLIANT / NON-COMPLIANT**.

---

## Security Properties

| Threat | Defense |
|---|---|
| Agent code tampered | TEE attestation — MRENCLAVE hash mismatch triggers circuit breaker |
| Agent overspends | On-chain spending limits enforced per-tx and per-day |
| Unauthorized capability | `CapabilityCheck.sol` reverts any unauthorized action on-chain |
| Sanctioned entity contacted | ZK sanctions proof required in Verifier.sol |
| Replay attacks | `proofExists` mapping prevents duplicate proof submission |
| Privacy violations | ZK proofs reveal only YES/NO — no amounts, no addresses |

---

## Environment Variables

```bash
# Network
PRIVATE_KEY=...           # deployer private key
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASESCAN_API_KEY=...

# ENS (Ethereum Sepolia)
ETH_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
ENS_NAME=dark26.eth

# BitGo (agent wallet)
BITGO_ACCESS_TOKEN=...
BITGO_WALLET_ID=...
BITGO_PASSPHRASE=...
BITGO_ENV=test

# Deployed contracts (populated after deploy.js)
DARKAGENT_CONTRACT=0xA77f8507838CC8719ac5B59567D2c260c007A366
CAPABILITY_CHECK_CONTRACT=0x357cC7108B86221AC83920713c0dA5B1e4800794
VERIFIER_CONTRACT=0x7D5d1222e12D1D26F512a9626B68ce2394C7e034
TRADING_AGENT_ADDRESS=0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60
DATA_AGENT_ADDRESS=0xA28FA8e3391f4454F8E555F5A1Ef5ECC7486dF4F
```

---

## License

MIT
