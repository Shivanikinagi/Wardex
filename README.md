# DarkAgent Protocol

> *"ENS defines what your agent can do. BitGo makes sure it never does more. DarkAgent connects them."*

DarkAgent is load-bearing decentralized infrastructure layer for AI agent permissions in DeFi. It solves the exact gap currently restricting institutional and mainstream adoption of autonomous agents: lack of standardized, on-chain, verifiable execution boundaries.

---

## 🏗 The Architecture Flow

Our core pipeline is a single, bulletproof verification flow entirely secured on Base testnet:

```text
alice.eth
(ENSIP-XX permission records)
         ↓
DarkAgent Resolver (ENSAgentResolver.sol)
(reads + parses ENS)
         ↓
Verification Contract (DarkAgent.sol)
(checks every rule dynamically on Base)
         ↓
BitGo Agent Policy Adapter (bitgo.js SDK)
(enforces at wallet level)
(generates fresh address per tx for privacy)
         ↓
Execute on Base / Base Sepolia
```

---

## 🔵 BitGo Protocol Adapter (What We Built for BitGo)

We didn't just spin up a wallet. We built the first **BitGo Agent Policy Adapter**.

**What it does:**
1. **Reads ENS permissions** directly mapping them to an agent profile.
2. **Automatically creates matching BitGo policies**: Translates `agent.max_spend` into BitGo's enterprise `velocityLimit` engine, and `agent.protocols` into an `addressWhitelist`.
3. Ensures strict **Privacy** by executing via `wallet.createAddress()`—generating a purely fresh un-linkable output address every single time an agent acts.

```javascript
// Excerpt from /sdk/bitgo.js AgentPolicyAdapter
async syncPermissions(ensName, perms) {
   // Generates matching BitGo enterprise policies instantly from ENS
   await wallet.updatePolicyRule({
     type: 'velocityLimit',
     amountString: String(perms.maxSpend),
     timeWindow: 86400 // Daily limit
   });
}

async getExecutionAddress() {
    // $1,200 Privacy Prize criteria hit precisely.
    return await wallet.createAddress({ label: `agent-tx-${Date.now()}` });
}
```

---

## 🪪 ENSIP-XX: Agent Permission Records (What We Built for ENS)

We aren't just calling `getText()`. We are formally proposing **ENSIP-XX** to turn ENS from an identity service into the ultimate decentralized financial policy standard. 

By defining the `agent.*` prefix, *any* protocol can read what limits a user has enforced upon their AI Agents.

*   `agent.max_spend`: Daily cap
*   `agent.slippage`: AMM tolerance
*   `agent.protocols`: Whitelist of DeFi routers (like Uniswap)

The newly deployed `ENSAgentResolver.sol` converts these standards into an easily callable struct that the `DarkAgent.sol` verification contract consumes strictly before any protocol execution state is verified.

---

## 🎯 What We're Pitching

**To ENS Judges ($2,000 Creative + Pool):**
"We proposed ENSIP-XX. ENS becomes the permission layer for all AI agents. Any protocol reads it using our ENSAgentResolver."

**To BitGo Judges ($2,000 Privacy + DeFi):**
"We built the first agent policy adapter for BitGo. ENS permissions automatically sync to BitGo policies. Agents cannot exceed limits, and every single execution fires from a perfectly fresh, un-linkable address."

**To ETHMumbai / Base Judges:**
"We built the infrastructure layer that every AI agent in DeFi needs. ENS defines the rules. BitGo enforces them. Nobody can bypass either. It runs entirely on Base."

## 🚀 Run the Project
DarkAgent requires minimal setup:
```bash
npm install
npx hardhat compile

# Run the frontend Interface
cd frontend
npm run dev
```
