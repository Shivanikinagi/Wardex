# wardex - Demo Recording Script

## Preparation
1. **Ensure all dependent services are running:**
   - Term 1: `npm run blink:server` (running the backend at `http://localhost:8787`).
   - Term 2: `cd frontend && npm run dev` (running the frontend).
2. **Setup environment variables:** 
   - Ensure your `.env` has all required keys: `VENICE_API_KEY`, `FILECOIN_API_KEY`, `LIDO`/`WSTETH` contracts, `ZYFAI` variables, etc.
3. **Screen Setup:** 
   - Have the wardex web app open in your primary browser window.
   - Have basescan.org / Filecoin calibration explorer / ENS domains tabs ready for quick proof.

---

## Script / Walkthrough

### 1. Introduction (0:00 - 0:30)
**Speaker:** 
"Hello, let me introduce you to **wardex** - a verifiable policy firewall for agentic DeFi execution. We built this to solve a major problem: how do we let autonomous AI agents execute financial transactions safely without giving them a blank check?"

**Action:** 
- Show the main dashboard of the wardex interface.
- Point to the "Agent URL" / "Blink URL" input area.

### 2. The Core Concept & ENS Identity (0:30 - 1:00)
**Speaker:** 
"In wardex, every execution request starts with an ENS identity. By tying an agent to an ENS domain (like `alice.eth`), we load on-chain permissions and execution boundaries."

**Action:** 
- Type an ENS name into the dashboard (or show one that is pre-populated).
- Show the "Policy Loaded" UI element displaying constraints for that agent.

### 3. Agent Execution Proposal & Venice AI (1:00 - 1:45)
**Speaker:** 
"Let's see an agent in action. The agent proposes a Blink URL for a DeFi transaction. Before signing or executing, the system passes the transaction intent to **Venice AI**, a privacy-focused model, to score the risk of the transaction against the ENS policy limits."

**Action:** 
- Paste a sample Blink URL into the interface and hit "Analyze / Submit".
- Show the UI indicating loading or "Analyzing with Venice AI".
- Point out the returned risk score and compliance verdict.

### 4. Yield-Powered Execution Tracking - Zyfai & Lido (1:45 - 2:30)
**Speaker:** 
"AI inference and transaction execution cost money. But agents shouldn't drain our main funds. Through our integration with **Zyfai** and **Lido**, our Agent Treasury enforces *principal lock semantics*. The agent is only allowed to spend the *yield* generated (e.g., wstETH yield), ensuring our principal remains intact. We also use Zyfai yield to directly fund the Venice AI inference cost."

**Action:** 
- Highlight the "Treasury Budget" or "Yield available" section in the UI.
- Show the simulated inference cost deduction from the available budget.

### 5. Private Policies - Lit Protocol (2:30 - 3:00)
**Speaker:** 
"Some trading strategies or compliance rules are proprietary. We use **Lit Protocol** Actions to evaluate private policies in a secure enclave. The backend queries a Lit endpoint and only consumes a sealed boolean verdict without over-exposing the internal rule payloads."

**Action:** 
- Show the interface section where Lit Protocol's "Dark Knowledge" verdict is displayed ("Lit Policy Override: Allowed").

### 6. Executing on Base / Status Network (3:00 - 3:45)
**Speaker:** 
"Once approved by the firewall, the transaction is executed securely. Our infrastructure runs on **Base Sepolia** and **Status Network**, providing low-friction and gasless transaction layers as an agentic service."

**Action:** 
- Click "Execute".
- Show the system returning the execution receipt. 
- Open up Basescan / Status Network explorer to show the transaction was confirmed successfully.

### 7. Verifiable Proofs with Filecoin (3:45 - 4:15)
**Speaker:** 
"After execution, the backend generates an immutable compliance record. We upload this verifiable execution receipt to **Filecoin** (FOC). Here is the CID in our UI."

**Action:** 
- Point out the `filecoinCid` returned in the success panel.
- Copy the CID and open the Filecoin Calibration block explorer (`https://calibration.filfox.info/en/message/...`) to verify the immutable log.

### 8. Outro (4:15 - 4:30)
**Speaker:** 
"That is wardex. With ENS policies, Venice risk scoring, yield-funded execution via Lido and Zyfai, private rules via Lit, and verifiable logs on Filecoin, we're building the trust layer for autonomous finance. Thank you!"

---

## Recording Tips
- **Pacing:** Keep it moving fast. You don't have to explain the code, just explain the *what* and the *why*.
- **Pre-load Tabs:** Have the explorers (Basescan, Filfox) pre-loaded if you know the CIDs or TX hashes in advance to save loading time.
- **Failures:** If you want to show the 'firewall' aspect, optionally run a very quick transaction that *fails* the risk score to show it getting blocked, before showing the successful path.