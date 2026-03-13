# DarkAgent: The Verification Infrastructure for AI Agents

> *"Verification layer that ensures AI agents can only execute what users allow"*

DarkAgent is a protocol. Not an app. Anyone building an AI agent plugs into DarkAgent instead of building their own security layer.

## The Problem

```text
Old Workflow (Reactive):
User → HeyElsa → Agent → Execute → Circuit Breaker Checks Limits
(Agent acts first, checks happen after. Like checking ID after entering the club.)
```

## The Paradigm Shift

```text
New Workflow (Proactive Protocol):
User → HeyElsa → Agent → Propose → DarkAgent Verifies → Execute
(Nothing executes without approval. Agent has zero direct power.)
```

## The Infrastructure Stack

DarkAgent is built as deep infrastructure across four layers:

### Layer 1: ENS Permission Standard (The Rules)
Don't just read ENS records. We propose the **"ENS Agent Permission Standard"**. Any ENS name can store an `agent.permissions` JSON:
```json
{
  "max_spend": 100,
  "slippage": 0.5,
  "allowed_protocols": ["uniswap", "aave"],
  "allowed_tokens": ["ETH", "USDC"],
  "time_window": 86400
}
```
Any protocol can now read `alice.eth` permissions before executing anything. It's a standard, not a feature.

### Layer 2: Verification Contract (The Core Protocol)
```solidity
import "IDarkAgent.sol";

// 1. Agent proposes action
bytes32 id = darkAgent.propose(agent, user, action);

// 2. DarkAgent verifies against user's ENS rules
bool verified = darkAgent.verify(id);

// 3. Only executes if verified
darkAgent.execute(id);
```
Other developers import this. Other agents use this. DarkAgent becomes the standard security interface.

### Layer 3: BitGo Policy Sync (The Enforcer)
We mirror ENS rules directly into BitGo wallet policies.
1. User sets rules on ENS
2. DarkAgent reads ENS and syncs to BitGo wallet policy automatically
3. Two layers enforce the exact same rules (On-chain + Wallet Level). 

### Layer 4: Fileverse Receipt (The Proof)
Every execution produces a permanent Verification Receipt stored on Fileverse:
```json
{
  "proposal_id": "0x123",
  "agent": "0xabc",
  "user": "alice.eth",
  "action": "swap ETH→USDC",
  "rules_checked": {"max_spend": true, "slippage": true, "protocol": true},
  "verified_by": "DarkAgent",
  "signature": "0xdef"
}
```
Now any developer can audit any agent, prove compliance, and build trust systems on top of DarkAgent.

## Core Integrations Building the Ecosystem

We built this specifically bridging the gap between every sponsor. Here is how DarkAgent acts as load-bearing infrastructure for the entire pack:

**Base — The Home Chain**
* *The Problem:* Base wants devs building load-bearing protocol infrastructure, not just isolated dApps.
* *The Solution:* The Verification Contract is deployed natively on Base. This makes Base the home chain for AI agent security. "All AI agent verification happens on Base."

**ENS — The Financial Identity Layer**
* *The Problem:* ENS is just names. There's no standard for machine-readable preferences. Agents can't read user intentions.
* *The Solution:* We built a new ENS standard schema: "Agent Permission Records". Any AI agent reads the `agent.permissions` ENS record before executing. You turn ENS from a name into a financial identity layer.

**HeyElsa — The Trust Gateway**
* *The Problem:* HeyElsa executes DeFi beautifully but has no safety layer. Users don't fully trust AI autonomous execution.
* *The Solution:* We built a safety SDK that plugs directly into HeyElsa's execution pipeline. Before HeyElsa executes anything, it calls `DarkAgent.verify()`. We make HeyElsa perfectly trustworthy.

**BitGo — The Institutional Enforcer**
* *The Problem:* AI agents bypass traditional BitGo institutional policies by signing transactions directly. 
* *The Solution:* A bridge that mathematically syncs DarkAgent on-chain ENS rules directly into BitGo wallet policies. Users set rules once—DarkAgent AND BitGo enforce the same rules automatically. We make BitGo relevant for the AI era.

**Fileverse — The Killer Use Case**
* *The Problem:* Fileverse is amazing decentralized storage without a defining killer-app narrative in DeFi. 
* *The Solution:* We built Fileverse into the default **Audit Trail Layer for all AI Agents**. Every agent execution produces a tamper-proof compliance receipt stored on Fileverse forever. 

---

## Developer Experience (3 Lines)

Any developer can use DarkAgent to secure their AI agents instantly:

```javascript
import DarkAgent from 'darkagent-sdk';

// Verify the action against the user's ENS rules
const verified = await DarkAgent.verify(agentAddress, "alice.eth", actionData);

// Only execute if DarkAgent approves
if (verified) execute(actionData);
```

## Why This Wins

- **Novel Infrastructure:** We aren't building a chat bot with a seatbelt. We're building the decentralized bouncer that every AI agent in DeFi will need to use.
- **Deep Integrations:** 
  - **ENS:** A genuine new standard proposal for the ecosystem.
  - **BitGo:** True wallet-level security synced with on-chain rules.
  - **Fileverse:** Accountability and auditability layer.
  - **Base:** The scalable L2 where the Verification Protocol lives.
  - **HeyElsa:** Connects as a demo client to visual the workflow.

DarkAgent. Built to be load-bearing infrastructure.
