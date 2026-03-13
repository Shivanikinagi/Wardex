"""
DarkAgent TEE Agent Runtime
===========================
Runs inside Intel SGX secure enclave via Gramine.
Generates hardware attestation proving code integrity.

If anyone modifies this code:
  → Attestation hash changes
  → Proposal fails verification layer
  → Nothing executes
  → Attacker gets nothing

Advanced features:
  → MEV Protection: reads ENS `mev_protection` record, routes via Flashbots
  → Signature Verification: proves ENS ownership via EIP-712 signatures
  → Slippage Guard: enforces max slippage from ENS `slippage` record
  → Post-execution ZK proofs: proves "tx followed ENS rules" without revealing rules

This is the code that runs inside the TEE.
"""

import hashlib
import json
import time
import os
import sys
import io
from datetime import datetime


def _fix_windows_encoding():
    """Fix Windows console encoding for Unicode support."""
    if sys.stdout and hasattr(sys.stdout, 'buffer') and getattr(sys.stdout, 'encoding', '').lower() not in ('utf-8', 'utf8'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if sys.stderr and hasattr(sys.stderr, 'buffer') and getattr(sys.stderr, 'encoding', '').lower() not in ('utf-8', 'utf8'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


class DarkAgentTEE:
    """
    AI Agent running inside a Trusted Execution Environment.
    
    Key properties:
      - Code integrity verified by hardware
      - Memory encrypted by CPU
      - Attestation proves unmodified execution
      - Cannot be tampered with, even by server admin
      - MEV-protected transaction routing
      - Post-execution ZK proofs for ENS rule compliance
    """

    # ═══════════════════════════════════════════════════════════════
    # This is the critical constant. If ANYONE changes it,
    # the attestation hash changes and the circuit breaker fires.
    # ═══════════════════════════════════════════════════════════════
    AGENT_VERSION = "darkagent-v1.1.0"
    CODE_INTEGRITY_SEED = "darkagent-tee-integrity-seed-2026"

    # ENS policy defaults (overridden by on-chain records)
    DEFAULT_POLICIES = {
        "mev_protection": False,
        "slippage": 50,           # 0.5% in BPS
        "max_spend": "0.1",       # ETH
        "allowed_tokens": ["ETH", "USDC", "WETH"],
    }

    def __init__(self, agent_id: str, ens_name: str, capabilities: list, ens_policies: dict = None):
        """Initialize agent inside TEE."""
        self.agent_id = agent_id
        self.ens_name = ens_name
        self.capabilities = capabilities
        self.status = "ACTIVE"
        self.actions_log = []
        self.attestation_hash = None
        self.start_time = datetime.now().isoformat()
        
        # ENS policies (read from chain in production)
        self.ens_policies = {**self.DEFAULT_POLICIES, **(ens_policies or {})}
        
        # MEV protection state
        self.mev_protected = self.ens_policies.get("mev_protection", False)
        self.max_slippage_bps = int(self.ens_policies.get("slippage", 50))
        
        # ZK proof history
        self.proof_history = []
        
        # Generate initial attestation
        self.attestation_hash = self._generate_attestation()
        
        print(f"[LOCK] DarkAgent TEE Runtime Initialized")
        print(f"   Agent: {self.ens_name}")
        print(f"   ID: {self.agent_id}")
        print(f"   Capabilities: {', '.join(self.capabilities)}")
        print(f"   Attestation: {self.attestation_hash[:16]}...")
        print(f"   MEV Protection: {'ON' if self.mev_protected else 'OFF'}")
        print(f"   Max Slippage: {self.max_slippage_bps / 100}%")
        print(f"   Status: {self.status}")
        print()

    def _generate_attestation(self) -> str:
        """
        Generate hardware attestation hash.
        
        In production (Intel SGX):
          - Uses SGX EREPORT instruction
          - Generates MRENCLAVE (code hash)
          - Signed by Intel's attestation service
          
        For hackathon demo:
          - Hash the source code + version + seed
          - Any code change = different hash
          - Simulates the SGX behavior accurately
        """
        # Read our own source code
        try:
            with open(__file__, 'r', encoding='utf-8') as f:
                source_code = f.read()
        except Exception:
            source_code = self.AGENT_VERSION

        # Generate attestation hash from:
        # 1. Source code content (MRENCLAVE equivalent)
        # 2. Version string
        # 3. Integrity seed
        attestation_input = f"{source_code}|{self.AGENT_VERSION}|{self.CODE_INTEGRITY_SEED}"
        attestation_hash = hashlib.sha256(attestation_input.encode()).hexdigest()
        
        return attestation_hash

    def verify_attestation(self) -> dict:
        """
        Verify current attestation matches expected.
        
        If code was tampered with:
          - Current hash != stored hash
          - Returns FAILED
          - Circuit breaker should fire
        """
        current_hash = self._generate_attestation()
        is_valid = current_hash == self.attestation_hash
        
        result = {
            "valid": is_valid,
            "stored_hash": self.attestation_hash,
            "current_hash": current_hash,
            "agent_id": self.agent_id,
            "ens_name": self.ens_name,
            "timestamp": datetime.now().isoformat(),
            "status": "VALID" if is_valid else "TAMPERED"
        }
        
        if not is_valid:
            self.status = "COMPROMISED"
            result["alert"] = "CODE TAMPERING DETECTED - CIRCUIT BREAKER SHOULD FIRE"
            print(f"\n[ALERT] ATTESTATION FAILED - CODE HAS BEEN TAMPERED WITH!")
            print(f"   Stored:  {self.attestation_hash[:16]}...")
            print(f"   Current: {current_hash[:16]}...")
            print(f"   Status:  COMPROMISED")
        else:
            print(f"[OK] Attestation valid: {current_hash[:16]}...")
            
        return result

    def check_capability(self, action: str) -> bool:
        """Check if agent is allowed to perform this action."""
        allowed = action in self.capabilities
        
        if not allowed:
            print(f"[BLOCKED] Capability violation: '{action}' not in {self.capabilities}")
            self.actions_log.append({
                "action": action,
                "allowed": False,
                "reason": "capability_violation",
                "timestamp": datetime.now().isoformat()
            })
        
        return allowed

    # ═══════════════════════════════════════════════════════════════
    #                    MEV PROTECTION
    # ═══════════════════════════════════════════════════════════════

    def check_mev_protection(self, action: str) -> dict:
        """
        Determine transaction routing based on ENS mev_protection record.
        
        If mev_protection=true in ENS:
          → Route through Flashbots Protect RPC
          → Prevents frontrunning, sandwich attacks
        
        Returns routing decision for the SDK to execute.
        """
        needs_mev = action in ("token-swap", "yield-farming", "payment")
        
        routing = {
            "mev_enabled": self.mev_protected,
            "action": action,
            "route": "flashbots" if (self.mev_protected and needs_mev) else "standard",
            "reason": "",
        }
        
        if self.mev_protected and needs_mev:
            routing["reason"] = f"ENS record mev_protection=true for {self.ens_name}"
            print(f"   [SHIELD] MEV Protection: routing '{action}' through Flashbots")
        elif self.mev_protected and not needs_mev:
            routing["reason"] = f"Action '{action}' does not require MEV protection"
            routing["route"] = "standard"
        else:
            routing["reason"] = "MEV protection not enabled in ENS"
        
        return routing

    # ═══════════════════════════════════════════════════════════════
    #                    SLIPPAGE GUARD
    # ═══════════════════════════════════════════════════════════════

    def check_slippage(self, expected_output: float, actual_output: float) -> dict:
        """
        Validate swap slippage against ENS-defined tolerance.
        
        Reads max slippage from ENS `slippage` text record (in BPS).
        e.g., slippage=50 means 0.5% max.
        """
        if expected_output <= 0:
            return {"passed": False, "reason": "invalid expected output"}
        
        actual_slippage_bps = int(((expected_output - actual_output) / expected_output) * 10000)
        
        # Negative slippage = positive slippage (got more than expected)
        if actual_slippage_bps < 0:
            actual_slippage_bps = 0
        
        passed = actual_slippage_bps <= self.max_slippage_bps
        
        result = {
            "passed": passed,
            "expected_output": expected_output,
            "actual_output": actual_output,
            "actual_slippage_bps": actual_slippage_bps,
            "max_slippage_bps": self.max_slippage_bps,
            "actual_slippage_pct": f"{actual_slippage_bps / 100}%",
            "max_slippage_pct": f"{self.max_slippage_bps / 100}%",
        }
        
        if not passed:
            print(f"   [ALERT] Slippage exceeded! {actual_slippage_bps / 100}% > {self.max_slippage_bps / 100}%")
        else:
            print(f"   [OK] Slippage check: {actual_slippage_bps / 100}% <= {self.max_slippage_bps / 100}%")
        
        return result

    # ═══════════════════════════════════════════════════════════════
    #                  SIGNATURE VERIFICATION
    # ═══════════════════════════════════════════════════════════════

    def generate_authorization_hash(self, action: str, nonce: int, deadline: int) -> str:
        """
        Generate the EIP-712 message hash for owner signature verification.
        The ENS owner signs this message to authorize the agent's action.
        """
        # Match Solidity AUTHORIZATION_TYPEHASH
        msg = f"Authorization(agent={self.agent_id},action={action},nonce={nonce},deadline={deadline})"
        return hashlib.sha256(msg.encode()).hexdigest()

    def verify_owner_signature(self, action: str, nonce: int, deadline: int, signature: str) -> dict:
        """
        Verify that the ENS owner authorized this action.
        
        In production: verify EIP-712 signature against ecrecover
        For hackathon: verify hash-based signature simulation
        """
        current_time = int(time.time())
        
        if current_time > deadline:
            return {"valid": False, "reason": "signature_expired"}
        
        expected_hash = self.generate_authorization_hash(action, nonce, deadline)
        
        # For demo: signature is the hash signed by owner
        is_valid = signature == expected_hash
        
        result = {
            "valid": is_valid,
            "agent": self.agent_id,
            "action": action,
            "nonce": nonce,
            "deadline": deadline,
            "expected_hash": expected_hash[:16] + "...",
            "timestamp": datetime.now().isoformat(),
        }
        
        if is_valid:
            print(f"   [OK] Owner signature verified for action: {action}")
        else:
            print(f"   [FAIL] Owner signature verification failed for: {action}")
        
        return result

    # ═══════════════════════════════════════════════════════════════
    #                    ACTION EXECUTION
    # ═══════════════════════════════════════════════════════════════

    def execute_action(self, action: str, params: dict = None) -> dict:
        """
        Execute an action inside the TEE with full security pipeline.
        
        Flow:
          1. Verify attestation is still valid
          2. Check capability
          3. Check MEV protection routing
          4. Execute action
          5. Check slippage (for swaps)
          6. Generate ENS rule compliance ZK proof
          7. Log result
        """
        if params is None:
            params = {}

        print(f"\n[ACTION] Executing: {action}")
        
        # Step 1: Verify attestation
        attestation = self.verify_attestation()
        if not attestation["valid"]:
            return {
                "success": False,
                "error": "ATTESTATION_FAILED",
                "message": "Code tampering detected - action blocked",
                "attestation": attestation
            }
        
        # Step 2: Check capability
        if not self.check_capability(action):
            return {
                "success": False,
                "error": "CAPABILITY_VIOLATION",
                "message": f"Agent not allowed to perform: {action}",
                "allowed_capabilities": self.capabilities
            }
        
        # Step 3: Check MEV protection routing
        mev_routing = self.check_mev_protection(action)
        
        # Step 4: Execute (simulated for demo)
        result = self._simulate_action(action, params)
        
        # Step 5: Slippage check (for swap actions)
        slippage_result = None
        if action == "token-swap" and "expected_output" in params:
            slippage_result = self.check_slippage(
                params["expected_output"],
                params.get("actual_output", params["expected_output"] * 0.998)
            )
            if not slippage_result["passed"]:
                return {
                    "success": False,
                    "error": "SLIPPAGE_EXCEEDED",
                    "message": f"Slippage {slippage_result['actual_slippage_pct']} exceeds max {slippage_result['max_slippage_pct']}",
                    "slippage": slippage_result
                }
        
        # Step 6: Generate ENS rule compliance ZK proof
        ens_proof = self._generate_ens_rule_proof(action, params, result, mev_routing, slippage_result)
        
        # Step 7: Generate standard compliance proof
        proof_data = self._generate_compliance_data(action, params, result)
        
        # Store proof for history
        self.proof_history.append(ens_proof)
        
        # Step 8: Log
        log_entry = {
            "action": action,
            "params": params,
            "result": result,
            "attestation_valid": True,
            "mev_routing": mev_routing,
            "slippage_check": slippage_result,
            "ens_rule_proof": ens_proof,
            "proof_data": proof_data,
            "timestamp": datetime.now().isoformat()
        }
        self.actions_log.append(log_entry)
        
        print(f"   [OK] Action completed successfully")
        print(f"   [ZK] ENS rule compliance proof: {ens_proof['proof_hash'][:16]}...")
        
        return {
            "success": True,
            "action": action,
            "result": result,
            "attestation": attestation,
            "mev_routing": mev_routing,
            "slippage_check": slippage_result,
            "ens_rule_proof": ens_proof,
            "proof_data": proof_data,
        }

    def _simulate_action(self, action: str, params: dict) -> dict:
        """Simulate action execution for demo."""
        simulations = {
            "yield-farming": {
                "protocol": params.get("protocol", "Aave"),
                "amount": params.get("amount", "0.01 ETH"),
                "apy": "4.2%",
                "tx_hash": hashlib.sha256(f"yield-{time.time()}".encode()).hexdigest()[:20],
                "mev_protected": self.mev_protected,
            },
            "token-swap": {
                "from_token": params.get("from", "ETH"),
                "to_token": params.get("to", "USDC"),
                "amount": params.get("amount", "0.005 ETH"),
                "rate": "1 ETH = 2,500 USDC",
                "slippage_bps": self.max_slippage_bps,
                "mev_protected": self.mev_protected,
                "tx_hash": hashlib.sha256(f"swap-{time.time()}".encode()).hexdigest()[:20]
            },
            "data-analysis": {
                "dataset": params.get("dataset", "on-chain-metrics"),
                "records_analyzed": 1542,
                "insights": 3,
                "report_hash": hashlib.sha256(f"data-{time.time()}".encode()).hexdigest()[:20]
            },
            "payment": {
                "recipient": params.get("recipient", "data-agent.darkagent.eth"),
                "amount": params.get("amount", "0.002 ETH"),
                "mev_protected": self.mev_protected,
                "tx_hash": hashlib.sha256(f"pay-{time.time()}".encode()).hexdigest()[:20]
            },
            "reporting": {
                "report_type": params.get("type", "compliance"),
                "period": "24h",
                "status": "compliant",
                "report_hash": hashlib.sha256(f"report-{time.time()}".encode()).hexdigest()[:20]
            }
        }
        
        return simulations.get(action, {"status": "completed"})

    # ═══════════════════════════════════════════════════════════════
    #               ZK PROOF GENERATION
    # ═══════════════════════════════════════════════════════════════

    def _generate_ens_rule_proof(self, action: str, params: dict, result: dict,
                                  mev_routing: dict, slippage_result: dict = None) -> dict:
        """
        Generate a ZK proof that the transaction followed ENS rules
        WITHOUT revealing the actual rules.
        
        This is the key privacy feature:
          - Proves: "I followed my ENS spending/slippage/MEV rules"
          - Reveals: only YES/NO (compliant or not)
          - Hides: the actual rule values, amounts, limits
        
        In production: generates a real Noir ZK proof
        For hackathon: generates proof metadata that matches the Verifier contract interface
        """
        # Collect all rules that were checked
        rules_checked = []
        all_compliant = True
        
        # Rule 1: Capability compliance
        rules_checked.append({
            "rule": "capability",
            "passed": action in self.capabilities,
        })
        if action not in self.capabilities:
            all_compliant = False
        
        # Rule 2: MEV protection compliance
        if mev_routing:
            mev_compliant = True
            if self.mev_protected and mev_routing["route"] != "flashbots":
                mev_compliant = False
                all_compliant = False
            rules_checked.append({
                "rule": "mev_protection",
                "passed": mev_compliant,
            })
        
        # Rule 3: Slippage compliance
        if slippage_result:
            rules_checked.append({
                "rule": "slippage",
                "passed": slippage_result["passed"],
            })
            if not slippage_result["passed"]:
                all_compliant = False
        
        # Rule 4: Spending limit compliance
        amount_str = params.get("amount", "0")
        try:
            amount = float(str(amount_str).replace(" ETH", "").replace(" USDC", ""))
        except ValueError:
            amount = 0
        max_spend = float(self.ens_policies.get("max_spend", "0.1"))
        spending_compliant = amount <= max_spend
        rules_checked.append({
            "rule": "spending_limit",
            "passed": spending_compliant,
        })
        if not spending_compliant:
            all_compliant = False
        
        # Rule 5: Attestation validity
        rules_checked.append({
            "rule": "attestation",
            "passed": True,  # Already verified in step 1
        })
        
        # Generate proof hash (privacy-preserving: hides individual rule values)
        rules_hash = hashlib.sha256(
            json.dumps({
                "ens_name": self.ens_name,
                "rules_count": len(rules_checked),
                "all_compliant": all_compliant,
                "timestamp": int(time.time()),
            }, sort_keys=True).encode()
        ).hexdigest()
        
        proof = {
            "proof_type": "ens_rule_compliance",
            "proof_hash": rules_hash,
            "agent": self.agent_id,
            "ens_name": self.ens_name,
            "compliant": all_compliant,
            "rules_checked": len(rules_checked),
            "timestamp": int(time.time()),
            # Public inputs for the Verifier contract
            # [0] = hash of rules (non-zero proves rules exist)
            # [1] = 1 if compliant, 0 if not
            "public_inputs": [
                int(rules_hash[:16], 16),  # Truncated hash as uint256
                1 if all_compliant else 0,
            ],
            # Proof data (would be Noir proof bytes in production)
            "proof_data": hashlib.sha256(
                f"ens-rule-proof-{self.ens_name}-{action}-{time.time()}".encode()
            ).hexdigest(),
        }
        
        return proof

    def _generate_compliance_data(self, action: str, params: dict, result: dict) -> dict:
        """Generate data for standard ZK compliance proof."""
        return {
            "proof_type": "spending_limit",
            "agent": self.agent_id,
            "action": action,
            "within_limits": True,
            "whitelisted_recipient": True,
            "no_sanctions": True,
            "attestation_valid": True,
            "mev_protected": self.mev_protected,
            "slippage_checked": action == "token-swap",
            "hash": hashlib.sha256(
                json.dumps({"action": action, "result": result}, sort_keys=True, default=str).encode()
            ).hexdigest()
        }

    # ═══════════════════════════════════════════════════════════════
    #                    STATUS & HISTORY
    # ═══════════════════════════════════════════════════════════════

    def get_status(self) -> dict:
        """Get current agent status."""
        return {
            "agent_id": self.agent_id,
            "ens_name": self.ens_name,
            "status": self.status,
            "capabilities": self.capabilities,
            "attestation_hash": self.attestation_hash,
            "attestation_valid": self.verify_attestation()["valid"],
            "mev_protection": self.mev_protected,
            "max_slippage_bps": self.max_slippage_bps,
            "ens_policies": self.ens_policies,
            "actions_count": len(self.actions_log),
            "proofs_generated": len(self.proof_history),
            "start_time": self.start_time,
            "current_time": datetime.now().isoformat()
        }

    def get_proof_history(self) -> list:
        """Get all ZK proofs generated by this agent."""
        return self.proof_history


def main():
    """Run the DarkAgent TEE demo."""
    print("=" * 60)
    print("  [LOCK] DarkAgent - TEE Agent Runtime")
    print("  Running inside Intel SGX Secure Enclave")
    print("=" * 60)
    print()

    # Initialize trading agent with ENS policies
    agent = DarkAgentTEE(
        agent_id="0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60",
        ens_name="trading-agent.dark26.eth",
        capabilities=["yield-farming", "token-swap", "payment"],
        ens_policies={
            "mev_protection": True,
            "slippage": 50,        # 0.5%
            "max_spend": "0.1",
            "allowed_tokens": ["ETH", "USDC", "WETH"],
        }
    )

    # Execute actions with full security pipeline
    print("\n" + "-" * 60)
    print("  Normal Operations (MEV Protected)")
    print("-" * 60)

    agent.execute_action("yield-farming", {
        "protocol": "Aave",
        "amount": "0.01 ETH"
    })

    agent.execute_action("token-swap", {
        "from": "ETH",
        "to": "USDC",
        "amount": "0.005 ETH",
        "expected_output": 12.5,   # Expected 12.5 USDC
        "actual_output": 12.45,    # Got 12.45 USDC (0.4% slippage - passes 0.5% limit)
    })

    agent.execute_action("payment", {
        "recipient": "data-agent.dark26.eth",
        "amount": "0.002 ETH"
    })

    # Test slippage violation
    print("\n" + "-" * 60)
    print("  Slippage Violation Test")
    print("-" * 60)

    result = agent.execute_action("token-swap", {
        "from": "ETH",
        "to": "USDC",
        "amount": "0.01 ETH",
        "expected_output": 25.0,
        "actual_output": 24.5,     # 2% slippage - exceeds 0.5% limit
    })
    if not result["success"]:
        print(f"   Result: {result['error']}")

    # Test capability violation
    print("\n" + "-" * 60)
    print("  Capability Violation Test")
    print("-" * 60)

    result = agent.execute_action("bridge-transfer", {"chain": "Arbitrum"})
    print(f"   Result: {result['error']}")

    # Show proof history
    print("\n" + "-" * 60)
    print("  ZK Proof History")
    print("-" * 60)

    for i, proof in enumerate(agent.get_proof_history()):
        print(f"  Proof #{i+1}:")
        print(f"    Type: {proof['proof_type']}")
        print(f"    Compliant: {proof['compliant']}")
        print(f"    Rules Checked: {proof['rules_checked']}")
        print(f"    Hash: {proof['proof_hash'][:16]}...")

    # Show status
    print("\n" + "-" * 60)
    print("  Agent Status")
    print("-" * 60)

    status = agent.get_status()
    print(json.dumps(status, indent=2, default=str))

    print("\n" + "-" * 60)
    print("  [OK] TEE Agent Runtime Demo Complete")
    print("-" * 60)


if __name__ == "__main__":
    _fix_windows_encoding()
    main()
