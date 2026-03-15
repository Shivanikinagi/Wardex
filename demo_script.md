## 🚨 The Problem & Solution

### The Problem
The DeFi space is sprinting toward an AI-agent future, but it lacks a fundamental layer of trust. Everyone wants the benefit of an autonomous bot trading for them 24/7. However, handing an AI bot or an external social signal access to your actual funds without hard, mathematical boundaries is reckless. It exposes your liquidity to runaway slippage, unauthorized interactions with malicious smart contracts, and dangerous token swaps (like dumping your portfolio into a meme-coin rugpull). 

Retail users and institutions alike need a way to **sandbox** their agents so they can operate freely, but only within strict, predefined limits. The problem is: how do you prove an agent followed the rules without exposing your exact trading strategies and bankroll to the public?

### The Solution: DarkAgent
**DarkAgent** acts as an unbreakable, decentralized firewall between autonomous agents and your wallet. We allow users to clearly define *exactly* what their agents are allowed to do.

1. **Decentralized Rules via ENS:** Users bind their trading rules (daily limits, whitelisted tokens, trusted protocols) directly to their ENS identity (e.g., lice.eth).
2. **Real-time Interception (Policy Engine):** When an agent attempts a transaction (a "Blink"), the DarkAgent Policy Engine intercepts it, dynamically scoring it. If the transaction violates the rules—like trying to spend  on an unverified meme coin—the engine forcefully Blocks it or Downsizes it to a safe amount (e.g.,  max).
3. **ZK-Compliance with Noir:** Once execution is approved, DarkAgent generates a Zero-Knowledge Proof (via Noir). This mathematically proves on-chain that the agent acted strictly within the ENS rules, *without ever revealing the exact limits or strategy to the public.*
4. **Seamless Execution:** The verified transaction is then executed gaslessly using Coinbase Smart Wallets deployed on Base Sepolia.

---

## 🎥 Recording Script for the Demo

**[0:00 - 0:15] The Hook**
*"Imagine waking up to find your favorite AI trading bot went rogue—dumping your entire portfolio into a meme coin. Handing bots the keys to your wallet is reckless. We built DarkAgent because your AI agent shouldn’t have the keys to the kingdom without a chaperone."*

**[0:15 - 0:35] Creating the Threat (Create Blink Tab)**
*(Visual: On the 'Create Blink' tab. Select 'AI_Bot', set Amount to '800' USDC, and select 'DEGEN' meme coin. Click 'Generate Blink'.)*
*"Let’s look at a live example on Base Sepolia. Here, a rogue AI agent has generated a transaction request—a Blink—trying to dump  USDC into an unverified meme coin. Normally, if this bot had our keys, our funds would be gone."*

**[0:35 - 1:00] The Interception (Analyze Blink Tab)**
*(Visual: Switch to 'Analyze Blink' tab, paste the Blink URL or watch it auto-load. Hover over the red warning cards.)*
*"But DarkAgent intercepts it. Our Policy Engine checks this transaction against the rules stored on this user’s ENS profile. Instantly, it detects the unauthorized token and realizes the  amount breaches our daily budget limit. Instead of failing completely, DarkAgent steps in and forcefully downsizes the risky trade to a strictly enforced, safe  limit."*

**[1:00 - 1:20] Smart Wallet Execution**
*(Visual: Click the 'Continue / Execute Simulated' button. Show the confirmation UI.)*
*"Since the trade is now within our safety bounds, we execute it seamlessly and gaslessly using a Coinbase Smart Wallet. No complicated seed phrases, just secure account abstraction."*

**[1:20 - 1:45] The ZK Magic (Final Verification)**
*(Visual: Show the Success message screen. Click the 'View ZK Proof' text and pull up the Base Sepolia block explorer showing Verifier.sol interaction.)*
*"Finally, we generate a Noir Zero-Knowledge proof and verify it on-chain in real-time. This cryptographically proves to regulators and auditors that the AI acted exactly within compliance, without ever exposing our actual trading limits or strategy to the public. DarkAgent: Secure, private, and fully automated AI execution."*
