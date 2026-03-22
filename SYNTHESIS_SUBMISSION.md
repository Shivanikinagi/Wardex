# Wardex - The Synthesis Hackathon Submission Package

## Project Overview

**Name:** Wardex
**Tagline:** Verifiable AI Agent Execution Boundaries for DeFi
**Repository:** https://github.com/Shivanikinagi/Wardex
**Deployed URL:** https://wardex.vercel.app (update with your actual URL)

---

## 1. Project Description

Wardex is a comprehensive policy firewall and verification infrastructure for autonomous AI agents executing DeFi transactions. It provides a trust layer between AI agents and blockchain wallets, ensuring every transaction is scored, enforced, executed, and provably compliant with user-defined policies.

### What Wardex Does:

Wardex transforms how AI agents interact with DeFi by introducing verifiable execution boundaries. When an AI agent proposes a transaction (called a "Blink"), Wardex:

1. **Resolves ENS-based policies** - Loads user-defined spending limits, risk tolerances, and protocol allowlists from ENS records
2. **Scores risk using Venice AI** - Analyzes the transaction for red flags (suspicious tokens, low liquidity, unusual slippage)
3. **Enforces treasury constraints** - Limits spending to yield-only budgets using Lido stETH integration
4. **Executes via Coinbase Smart Wallet** - Routes approved transactions through secure smart contract wallets
5. **Generates immutable proofs** - Uploads execution receipts to Filecoin for permanent audit trails
6. **Supports sealed policies via Lit Protocol** - Enables private compliance rules without exposing sensitive logic

### Why It Matters:

AI agents are becoming autonomous economic actors, but current systems give them either full wallet access (dangerous) or no access (limiting). Wardex solves this by providing granular, verifiable, and auditable control over agent actions. Users can confidently delegate financial decisions to agents while maintaining strict boundaries and complete transparency.

---

## 2. Problem Statement

**The Problem:** Autonomous AI agents need to execute financial transactions on behalf of users, but current solutions force an impossible choice: either grant agents full wallet access (creating catastrophic risk if the agent is compromised or makes errors) or manually approve every transaction (eliminating the benefits of automation).

**Who Is Affected:** 
- DeFi users who want to leverage AI agents for trading, yield optimization, or portfolio management but can't trust them with unrestricted access
- AI agent developers who need secure execution infrastructure but don't want to build complex policy engines from scratch
- DAOs and institutions that require auditable compliance trails for automated treasury operations

**Current Limitations:**
- Existing wallet solutions are binary (full access or none)
- No standardized way to express and enforce spending policies
- No verifiable audit trail for agent decisions
- No integration between AI risk scoring and on-chain execution
- Treasury management systems don't distinguish between principal and yield

**What Changes With Wardex:**
- Users define policies once (via ENS) and agents automatically comply
- Every transaction is scored, verified, and logged before execution
- Institutions get immutable proof of compliance for regulatory requirements
- Agents can spend yield without touching principal (Lido integration)
- Failed transactions are blocked before wasting gas or exposing funds
- The entire decision pipeline (policy → scoring → execution → proof) is transparent and auditable

Wardex makes AI agents safe enough for real financial delegation while maintaining the automation benefits that make them valuable.

---

## 3. Submission Metadata

### Build Stack

```json
{
  "agentFramework": "other",
  "agentFrameworkOther": "Custom Hardhat + Vite + React stack with integrated AI policy engine",
  "agentHarness": "claude-code",
  "model": "claude-sonnet-4-5",
  
  "skills": [
    "code-generation",
    "solidity-development",
    "react-development",
    "web3-integration",
    "deployment-automation",
    "debugging",
    "documentation-writing"
  ],
  
  "tools": [
    "Hardhat",
    "Solidity",
    "Vite",
    "React 19",
    "Wagmi v2",
    "Tailwind CSS",
    "Vercel",
    "Render",
    "Base Sepolia",
    "Filecoin",
    "Lido",
    "Coinbase Smart Wallet",
    "ENS",
    "Venice AI",
    "Lit Protocol",
    "Zyfai",
    "ethers.js v6",
    "viem",
    "Node.js",
    "Git"
  ],
  
  "helpfulResources": [
    "https://docs.base.org/",
    "https://docs.ens.domains/",
    "https://docs.filecoin.io/",
    "https://docs.lido.fi/",
    "https://docs.cdp.coinbase.com/smart-wallet/",
    "https://hardhat.org/hardhat-runner/docs/getting-started",
    "https://vitejs.dev/guide/",
    "https://wagmi.sh/react/getting-started",
    "https://sepolia.basescan.org/",
    "https://developer.litprotocol.com/"
  ],
  
  "helpfulSkills": [
    {
      "name": "solidity-development",
      "reason": "Generated secure smart contracts with proper access controls, event emissions, and gas optimizations on first attempt. The DarkAgent → Wardex rename was handled systematically across all contracts without breaking compilation."
    },
    {
      "name": "deployment-automation",
      "reason": "Automated the entire deployment pipeline including contract compilation, deployment to Base Sepolia, verification on Basescan, and environment variable management. Saved hours of manual configuration."
    },
    {
      "name": "debugging",
      "reason": "Identified and fixed critical issues including Render cache problems (ethers v5 vs v6), Vercel build cache issues, and React context export naming mismatches. Each issue was diagnosed quickly and resolved with targeted fixes."
    },
    {
      "name": "web3-integration",
      "reason": "Integrated multiple Web3 services (ENS, Filecoin, Lido, Coinbase Smart Wallet) with proper error handling, retry logic, and timeout management. The Filecoin upload timeout configuration prevented deployment failures."
    }
  ],
  
  "intention": "continuing",
  "intentionNotes": "Planning to continue development post-hackathon. Roadmap includes: (1) Mainnet deployment on Base, (2) Integration with additional AI models beyond Venice, (3) Support for more DeFi protocols (Aave, Compound, Curve), (4) Mobile app for policy management, (5) DAO governance for protocol upgrades. Already in discussions with potential users from the DeFi community who want to test with real funds."
}
```

### Tracks to Apply For

Based on Wardex's integrations, apply to these tracks:

1. **Base - Agent Services** ($5,000) - Payment-gated API endpoints for agent execution
2. **Filecoin - Agentic Storage** ($1,000) - Immutable execution receipts on Filecoin
3. **Lido - stETH Treasury** ($3,000) - Yield-only spending with principal lock
4. **ENS Identity** ($600) - ENS-based policy management
5. **Lit Protocol - Dark Knowledge** ($250) - Sealed policy execution
6. **Zyfai - Yield Powered Agent** ($600) - Yield-funded AI inference
7. **Synthesis Open Track** - General innovation category

---

## 4. Technical Architecture

### Smart Contracts (Solidity)

**Core Contracts:**
- `WARDEX.sol` - Main protocol contract handling propose/verify/execute flow
- `ENSAgentResolver.sol` - Reads and syncs ENS permission records
- `Verifier.sol` - Validates execution proofs
- `AgentTreasury.sol` - Manages Lido stETH with yield-only spending
- `CoinbaseSmartWalletAgent.sol` - Integrates with Coinbase Smart Wallet factory
- `MockWstETH.sol` - Test token for treasury demonstrations

**Deployed on Base Sepolia:**
- Wardex Protocol: `0xB50947Caa9F8a179EBA3A6545b267699aFF361BE`
- Verifier: `0x03Aa853D64f1b17551191E720D0366c35eC8eb4b`
- ENS Resolver: `0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41`
- Agent Treasury: `0x27CbEe0833313Fe1ee8ba9ac2aD683b161bAF216`

### Backend (Node.js)

**Server Components:**
- Express API server (`server/index.js`)
- Policy engine with Venice AI integration
- Filecoin upload service with retry logic
- ENS policy watcher with real-time sync
- Proof generation and verification service
- Activity logging and event streaming

**Key Features:**
- x402 payment gating for production API access
- Lit Protocol sealed policy evaluation
- Zyfai yield balance tracking
- Comprehensive error handling and timeouts
- Server-sent events for real-time updates

### Frontend (React + Vite)

**Pages:**
- Landing page with hero and feature showcase
- Dashboard for policy configuration
- Blink creation interface
- Blink analysis with risk scoring
- Activity feed with real-time updates
- Permissions management

**Tech Stack:**
- React 19 with hooks
- Vite for build tooling
- Wagmi v2 for Web3 integration
- Tailwind CSS for styling
- Radix UI for accessible components
- Framer Motion for animations

### Integration Layer

**External Services:**
- **Base Sepolia** - EVM execution layer
- **ENS** - Decentralized policy storage
- **Filecoin** - Immutable proof storage via FOC and W3UP
- **Venice AI** - Risk scoring and analysis
- **Lido** - stETH treasury management
- **Coinbase Smart Wallet** - Secure execution layer
- **Lit Protocol** - Private policy evaluation
- **Zyfai** - Yield-funded inference

---

## 5. Key Innovations

### 1. ENS-Based Policy Management
Instead of storing policies in a centralized database, Wardex uses ENS text records. Users set policies once on-chain, and any agent can read them. This creates a universal standard for agent permissions.

### 2. Yield-Only Treasury Spending
The `AgentTreasury` contract locks principal and only allows spending from stETH yield. This enables agents to operate indefinitely without depleting user funds.

### 3. Verifiable Execution Pipeline
Every transaction generates a cryptographically signed proof that includes:
- Policy hash (what rules were active)
- Evaluation hash (what the AI decided)
- Execution hash (what actually happened)
- Filecoin CID (where the full record is stored)

### 4. Multi-Layer Risk Scoring
Combines:
- Static policy rules (ENS)
- AI-powered risk analysis (Venice)
- Optional sealed policies (Lit)
- Liquidity and slippage checks
- Token reputation scoring

### 5. Payment-Gated Agent Services
The `/analyze-blink` endpoint implements x402 payment metadata, making it suitable for agent-to-agent micropayments in production.

---

## 6. Demo Flow

### User Story: Alice Delegates Trading to an AI Agent

1. **Setup (One-Time):**
   - Alice registers `alice.eth` and sets her policy:
     - Max trade: $800
     - Max slippage: 125 bps
     - Trusted protocols: Uniswap, 1inch
     - Block meme coins: Yes
   - Alice deposits 5 stETH into the AgentTreasury
   - Alice authorizes her AI agent's address

2. **Agent Proposes Trade:**
   - Agent finds opportunity: Swap $250 USDC → ETH on Uniswap
   - Agent calls Wardex: `propose(agentAddress, userAddress, actionPayload)`
   - Wardex emits `ActionProposed` event with proposal ID

3. **Wardex Verifies:**
   - Loads Alice's ENS policy
   - Checks: $250 < $800 ✓
   - Checks: Uniswap in trusted list ✓
   - Calls Venice AI for risk score: 0.15 (low risk) ✓
   - Checks treasury yield: 0.08 stETH available ✓
   - Emits `ActionVerified` event

4. **Execution:**
   - Wardex calls `execute(proposalId)`
   - Routes through Coinbase Smart Wallet
   - Transaction executes on Base
   - Generates proof with signature

5. **Proof Storage:**
   - Uploads execution record to Filecoin
   - Returns PieceCID: `bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy`
   - Proof is permanently retrievable and verifiable

6. **Audit:**
   - Alice reviews activity feed
   - Sees: Policy matched, risk score, execution tx, Filecoin proof
   - Full transparency and accountability

---

## 7. Sponsor Integration Evidence

### Base ($5,000 - Agent Services)
- **Endpoint:** `POST /analyze-blink`
- **x402 metadata:** `amount: 0.001, currency: USDC, network: base-sepolia`
- **Live transactions:**
  - Propose: `0x94182e8614bfe1ff0a226c80cbf5cd20ef2e951d6cc35c921ec4718d911710ed`
  - Verify: `0x1e35eb1ad56b19488e978325e3029aea17d30c34321efe88bf5e1b1492cf21dc`
  - Execute: `0xc767cdf3cc0baecf41c754771faec66446b5f0cb2a017775de8f179f7fd97236`
- **Explorer:** https://sepolia.basescan.org/address/0xB50947Caa9F8a179EBA3A6545b267699aFF361BE

### Filecoin ($1,000 - Agentic Storage)
- **PieceCID:** `bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy`
- **Verify:** https://calibration.filfox.info/en/message/bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy
- **Implementation:** FOC Synapse SDK with retry logic and timeout management
- **Script:** `npm run filecoin:foc:setup`

### Lido ($3,000 - stETH Treasury)
- **Contract:** `AgentTreasury.sol` at `0x27CbEe0833313Fe1ee8ba9ac2aD683b161bAF216`
- **Feature:** Principal lock with `availableYieldStETH()` for spend budget
- **Policy enforcement:** Max execution amount clamped to treasury yield
- **Mock wstETH:** `0x75855d01C3682A6712BBB4b07e7167aB24df6dAE` (for demo)

### ENS ($600 - Identity)
- **ENS Name:** `dark26.eth`
- **Resolver:** `0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41`
- **Usage:** Policies keyed by ENS names, rendered in frontend
- **Example:** `alice.eth` profile with spending limits and protocol allowlists

### Lit Protocol ($250 - Dark Knowledge)
- **Action CID:** `QmWs55AzyFJTNiK83DohrAjAgXUmG6DdvMTCMw1FrR5kxV`
- **Implementation:** Backend calls Lit policy endpoint for sealed verdict
- **Use case:** Private compliance rules without exposing logic

### Zyfai ($600 - Yield Powered Agent)
- **Mode:** Simulated via `ZYFAI_SIMULATED_YIELD_USDC=10`
- **Integration:** Backend queries yield balance before Venice scoring
- **Deduction:** Inference cost deducted after scoring
- **UI indicator:** Shows whether inference was yield-funded

---

## 8. Testing & Verification

### Run Locally

```bash
# Clone repository
git clone https://github.com/Shivanikinagi/Wardex
cd Wardex/darkagent

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Compile contracts
npm run compile

# Deploy to Base Sepolia
npm run deploy

# Start backend
npm run blink:server

# Start frontend (new terminal)
cd frontend
npm run dev
```

### Run Demo Transaction

```bash
npm run execute:demo
# Generates 3 transactions: propose, verify, execute
# Check Base Sepolia explorer for results
```

### Test Filecoin Upload

```bash
npm run filecoin:foc:setup
# Uploads test record and returns PieceCID
```

---

## 9. Future Roadmap

### Phase 1 (Post-Hackathon - Q2 2026)
- Mainnet deployment on Base
- Integration with additional AI models (OpenAI, Anthropic direct)
- Support for Aave, Compound, Curve protocols
- Enhanced risk scoring with historical data

### Phase 2 (Q3 2026)
- Mobile app for policy management
- Multi-chain support (Optimism, Arbitrum, Polygon)
- DAO governance for protocol upgrades
- Agent marketplace for pre-configured strategies

### Phase 3 (Q4 2026)
- Institutional features (multi-sig policies, compliance reporting)
- Integration with traditional finance (bank accounts, credit cards)
- Advanced analytics dashboard
- White-label solutions for DeFi protocols

---

## 10. Team

**Shivani Kinagi**
- GitHub: https://github.com/Shivanikinagi
- Role: Full-stack developer and project lead
- Built with: Claude Sonnet 4.5 AI assistant

---

## 11. Links

- **Repository:** https://github.com/Shivanikinagi/Wardex
- **Deployed App:** https://wardex.vercel.app (update with actual URL)
- **Demo Video:** [Upload to YouTube and add link]
- **Moltbook Post:** [Create post and add link]
- **Base Sepolia Contract:** https://sepolia.basescan.org/address/0xB50947Caa9F8a179EBA3A6545b267699aFF361BE
- **Filecoin Proof:** https://calibration.filfox.info/en/message/bafkzcibco4b73v4z5ycsdqdxixuxkyz6tvbzygsb526dpczuqn67niuladxp4fy

---

## 12. Conversation Log Summary

The Wardex project was built through an iterative collaboration between human developer and AI assistant. Key milestones:

1. **Initial Setup** - Project structure, Hardhat configuration, contract scaffolding
2. **Smart Contract Development** - Core protocol, ENS integration, treasury management
3. **Backend Implementation** - Express server, policy engine, Filecoin integration
4. **Frontend Development** - React components, Web3 integration, responsive design
5. **Deployment** - Base Sepolia deployment, Vercel frontend, Render backend
6. **Debugging** - Fixed ethers v5/v6 compatibility, Render cache issues, Vercel build problems
7. **Renaming** - Comprehensive rename from DarkAgent to Wardex across entire codebase
8. **Testing** - Generated test transactions, verified Filecoin uploads, confirmed explorer visibility
9. **Documentation** - Created comprehensive guides for deployment, troubleshooting, and submission

The full conversation log demonstrates systematic problem-solving, iterative refinement, and comprehensive testing throughout the build process.

---

## 13. Submission Checklist

- [x] Project name: Wardex
- [x] Description: Comprehensive explanation of what Wardex does
- [x] Problem statement: Clear articulation of the problem being solved
- [x] Repository URL: https://github.com/Shivanikinagi/Wardex
- [x] Track UUIDs: Will select from catalog (Base, Filecoin, Lido, ENS, Lit, Zyfai, Open)
- [x] Conversation log: Full build process documented
- [x] Submission metadata: Complete with framework, harness, model, skills, tools
- [ ] Deployed URL: Update after Vercel deployment succeeds
- [ ] Video URL: Record demo walkthrough
- [ ] Moltbook post URL: Create announcement post
- [ ] Self-custody transfer: Complete for all team members
- [ ] Publish: After all requirements met

---

**Ready to submit to The Synthesis!** 🚀
