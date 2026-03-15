<div align="center">
  <h1>🛡️ DarkAgent Protocol</h1>
  <p><b>Trustless, ZK-Verified Execution Boundaries for AI Agents in DeFi</b></p>
  <p><i>Built with ❤️ for ETHMumbai 2026</i></p>
</div>

> *"ENS defines what your agent can do. Noir ZK circuits prove it complied. Coinbase Smart Wallet gives it a home. DarkAgent connects them all."*

---

## 🚨 The Problem
The DeFi space is sprinting toward an **AI-agent future**, but it lacks a fundamental layer of trust. Handing an autonomous AI bot or a social signal access to your funds without mathematical guarantees is reckless. It risks your liquidity to high slippage, unapproved protocol usage, and unauthorized token swaps (like meme coin rugpulls). Institutions and retail users alike need a way to securely **sandbox** their agents.

## 💡 The Solution
**DarkAgent** acts as an unbreakable decentralized firewall between autonomous agents and your wallet. We allow users to clearly define *exactly* what their agents are allowed to do. 

When an external agent attempts to execute a transaction (a **Blink**), our **Policy Engine** intercepts it, dynamically scoring it based on token safety, protocol trust, and source spending limits. Upon execution, we generate a **Zero-Knowledge proof** establishing that the agent acted within compliance—without ever revealing your specific trading strategies or target alpha to regulators or the public.

---

## ✨ Key Features
1. 📊 **Dynamic Policy Engine:** Intercepts payloads and evaluates them against user-defined limits (e.g., Block all meme coins, set a hard maximum of $300 per AI bot transaction).
2. 🔐 **Zero-Knowledge Compliance:** Uses **Noir (Aztec)** to generate ZK proofs that an agent adhered strictly to spending limits and whitelists, proving compliance on-chain while hiding exact targets.
3. 💳 **Coinbase Smart Wallet Integrations:** Secure, gas-abstracted transaction execution directly on **Base Sepolia**.
4. 🌍 **ENS Identity:** Binds human-readable decentralized identities directly to the agent's policy bounds.

---

## 🏗 Architecture Flow
Our core pipeline is a single, bulletproof verification flow entirely secured on-chain:

`	ext
1. User Policy Configuration (ENS Profiles & Source Limits)
         ↓
2. Action Payload (Blinks intercepted from AI/External sources)
         ↓
3. DarkAgent Policy Engine (Evaluates limits, slippage, whitelists)
         ↓
4. Base Sepolia Execution (via Coinbase Smart Wallets)
         ↓
5. Noir ZK Circuit Verification (Verifier.sol generates compliance proof)
         ↓
✅ Approved, Executed & Cryptographically Proven
`

---

## 💻 How to Run the Demo Locally
To run the full stack and experience the UI locally during judging:

### 1. Start the Proxy Server
This runs the background proxy on port 8787 that simulates the Blink interception and API generation.
`ash
npm run blink:server
`

### 2. Start the Frontend WebApp
This runs the Vite React UI on port 5177. Open a new terminal:
`ash
cd frontend
npm run dev
`

### 3. Demo Walkthrough Steps for Judges
- Navigate to the **Create Blink** tab.
- Attempt a high-risk operation (e.g., select source: i_bot, set 800 USDC to swap for DEGEN).
- Click **Generate Blink**.
- Watch the **Analyze Blink** dashboard intercept the payload, cross-reference it against your internal policy limits, and flag it as Blocked or Downsized with a low safety score.
- Override the block (for demo purposes) by clicking **Continue**, and view the simulated execution.
- Observe the **ZK Proof Verification** link that routes directly to the Base Sepolia Testnet confirmation.

---

## 🛠 Tech Stack & Track Submissions
- **Base / Base Sepolia:** Core deployment environment for fast, cheap execution.
- **Coinbase Developer Platform (CDP):** For Smart Wallet account abstraction and seamless user onboarding.
- **Noir / Aztec:** ZK Circuit compilation for privacy-preserving verifiable compute.
- **Vite, React, TailwindCSS:** Frontend interface and routing.
- **ENS:** Decentralized handles for agent policies.

---
<div align="center">
  <b>Developed by shivanik1105</b><br>
  <i>Because your AI agent shouldn't have the keys to the kingdom without a chaperone.</i>
</div>
