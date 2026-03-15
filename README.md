# DarkAgent Protocol

> *"ENS defines what your agent can do. Noir ZK Proofs ensure it complies. Coinbase Smart Wallet gives it a home. DarkAgent connects them all."*

**DarkAgent** is a load-bearing decentralized infrastructure layer for AI agent permissions in DeFi. It solves the exact gap currently restricting institutional and mainstream adoption of autonomous agents: the lack of standardized, on-chain, verifiable execution boundaries without compromising trading privacy.

---

## 🏗 The Architecture Flow

Our core pipeline is a single, bulletproof verification flow entirely secured on Base Sepolia:

`	ext
User Policy Configuration
(Dashboards & Source Limits)
         ↓
Action Payload (Blink)
(intercepted from external agents/bots)
         ↓
DarkAgent Policy Engine
(evaluates amounts, slippage, and whitelists)
         ↓
Base Sepolia Execution
(triggers Coinbase Smart Wallet)
         ↓
Noir ZK Circuit Simulation (Verifier.sol)
(generates proof of compliance without revealing targets)
         ↓
Approved & Executed
`

## 🌟 Hackathon Pitch Highlight  (ETHMumbai 2026)

**The Problem:** 
The DeFi space is sprinting toward an AI-agent future, but trust is missing. Handing an AI bot access to your funds without mathematical guarantees means risking your liquidity to slippage, unapproved protocols, or meme coin rugpulls.

**The Solution:** 
DarkAgent acts as an unbreakable firewall. We let users clearly define what their agents can do. When an external agent (like an AI bot) sends a transaction payload, our internal Policy Engine dynamically scores it based on token safety, protocol trust, and source limits.

**The Magic (ZK Privacy):**
When a transaction executes, a Noir Zero-Knowledge proof is compiled. This proves to any external observers or regulators that the agent strictly adhered to your specific spending limits, only interacted with whitelisted protocols, and touched zero sanctioned entities—all without revealing your specific trading strategies to the public.

---

## 💻 Running the Demo Locally

To run the full stack and demo the UI locally during judging:

### 1. Start the Proxy Server
This runs the background proxy on port 8787 that simulates the Blink interception.

`ash
cd darkagent
npm run blink:server
`

### 2. Start the Frontend WebApp
This runs the Vite React UI.

`ash
cd darkagent/frontend
npm run dev
`

### 3. Demo Walkthrough Steps
- Navigate to **Create Blink**.
- Attempt a high-risk operation (e.g., source: i_bot, 800 USDC to DEGEN).
- Click **Generate Blink**.
- Watch the **Analyze Blink** dashboard intercept the payload, cross-reference it against your internal policy, and flag it as Blocked or Downsized.
- Force the execution using **Continue**, and view the simulated **ZK Proof Verification** directly linked to the Base Sepolia Testnet.

---

## 🛠 Tech Stack
- Frontend: **React, Vite, TailwindCSS, Framer Motion**
- Blockchain Environment: **Base Sepolia**
- Wallets: **Coinbase Smart Wallets**
- Privacy / Compliance: **Noir (Aztec) ZK Circuits**
- Authentication / Identity: **ENS**

## 🤝 Team
Developed with ❤️ by **shivanik1105** for the ETHMumbai Hackathon.
