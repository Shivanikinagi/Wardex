"""
DarkAgent TEE Attestation Engine
=================================
Handles hardware attestation generation, verification, and circuit breaker logic.

In production:
  - Uses Intel SGX DCAP (Data Center Attestation Primitives)
  - MRENCLAVE = hash of loaded code
  - MRSIGNER = hash of signing key
  - Attestation verified by Intel's attestation service

For hackathon demo:
  - Simulates SGX attestation with cryptographic hashing
  - Source code change = hash change = attestation failure
  - Circuit breaker fires on any attestation mismatch
"""

import hashlib
import json
import time
import os
import sys
import io
from datetime import datetime
from pathlib import Path


def _fix_windows_encoding():
    """Fix Windows console encoding for Unicode support."""
    if sys.stdout and hasattr(sys.stdout, 'buffer') and getattr(sys.stdout, 'encoding', '').lower() not in ('utf-8', 'utf8'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    if sys.stderr and hasattr(sys.stderr, 'buffer') and getattr(sys.stderr, 'encoding', '').lower() not in ('utf-8', 'utf8'):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


class AttestationEngine:
    """
    Generates and verifies TEE attestation for DarkAgent.
    
    The attestation proves:
      1. The exact code running is unmodified
      2. The execution environment is secure
      3. No one has tampered with the agent
    """

    def __init__(self, agent_code_path: str = None):
        """
        Initialize attestation engine.
        
        Args:
            agent_code_path: Path to the agent source code to attest
        """
        self.agent_code_path = agent_code_path or os.path.join(
            os.path.dirname(__file__), "agent.py"
        )
        self.attestation_history = []
        self.circuit_breaker_fired = False
        self.initial_attestation = None
        
        # Generate initial attestation on startup
        self.initial_attestation = self.generate_attestation()
        
        print(f"🔐 Attestation Engine Initialized")
        print(f"   Code path: {self.agent_code_path}")
        print(f"   Initial attestation: {self.initial_attestation['mrenclave'][:16]}...")

    def generate_attestation(self) -> dict:
        """
        Generate a hardware attestation report.
        
        Simulates Intel SGX attestation:
          MRENCLAVE = SHA256(source_code)
          MRSIGNER  = SHA256(signer_key)
          Report    = {MRENCLAVE, MRSIGNER, user_data, timestamp}
        """
        # Read source code (MRENCLAVE equivalent)
        try:
            with open(self.agent_code_path, 'r', encoding='utf-8') as f:
                source_code = f.read()
        except FileNotFoundError:
            source_code = "FILE_NOT_FOUND"

        # Generate MRENCLAVE (measurement of loaded code)
        mrenclave = hashlib.sha256(source_code.encode()).hexdigest()
        
        # Generate MRSIGNER (measurement of signing identity)
        signer_key = "darkagent-signer-v1"
        mrsigner = hashlib.sha256(signer_key.encode()).hexdigest()
        
        # Generate report data
        report_data = hashlib.sha256(
            f"{mrenclave}|{mrsigner}|{time.time()}".encode()
        ).hexdigest()

        attestation = {
            "mrenclave": mrenclave,
            "mrsigner": mrsigner,
            "report_data": report_data,
            "timestamp": datetime.now().isoformat(),
            "epoch": int(time.time()),
            "platform": "Intel SGX (simulated)",
            "enclave_status": "SECURE",
            "code_path": self.agent_code_path,
            "code_size": len(source_code),
        }

        self.attestation_history.append(attestation)
        return attestation

    def verify_attestation(self) -> dict:
        """
        Verify current attestation against initial attestation.
        
        If code was tampered with:
          → MRENCLAVE changes
          → Verification fails
          → Circuit breaker fires
          
        Returns:
          {
            "valid": bool,
            "reason": str,
            "initial_mrenclave": str,
            "current_mrenclave": str,
            ...
          }
        """
        if self.initial_attestation is None:
            return {"valid": False, "reason": "No initial attestation"}

        current = self.generate_attestation()
        
        is_valid = current["mrenclave"] == self.initial_attestation["mrenclave"]
        
        result = {
            "valid": is_valid,
            "reason": "Code integrity verified" if is_valid else "CODE TAMPERING DETECTED",
            "initial_mrenclave": self.initial_attestation["mrenclave"],
            "current_mrenclave": current["mrenclave"],
            "mrsigner_match": current["mrsigner"] == self.initial_attestation["mrsigner"],
            "timestamp": datetime.now().isoformat(),
            "verification_count": len(self.attestation_history),
        }

        if not is_valid:
            result["alert"] = "🚨 CRITICAL: Code has been modified!"
            result["action_required"] = "Fire circuit breaker and freeze wallet immediately"
            
            # Auto-fire circuit breaker
            if not self.circuit_breaker_fired:
                self.fire_circuit_breaker(
                    reason="Attestation mismatch — code tampered",
                    old_hash=self.initial_attestation["mrenclave"],
                    new_hash=current["mrenclave"]
                )

        return result

    def fire_circuit_breaker(self, reason: str, old_hash: str, new_hash: str) -> dict:
        """
        🚨 CIRCUIT BREAKER — Freeze everything.
        
        This is the kill switch that fires when:
          - TEE attestation fails
          - Code hash doesn't match
          - Any tampering is detected
          
        Actions taken:
          1. Mark circuit breaker as fired
          2. Generate alert
          3. Return freeze command for BitGo wallet
          4. Log everything
        """
        self.circuit_breaker_fired = True
        
        event = {
            "event": "CIRCUIT_BREAKER_FIRED",
            "reason": reason,
            "old_attestation": old_hash[:16] + "...",
            "new_attestation": new_hash[:16] + "...",
            "timestamp": datetime.now().isoformat(),
            "actions": [
                "WALLET_FROZEN",
                "AGENT_SUSPENDED",
                "ALERT_SENT",
                "ALL_TRANSACTIONS_BLOCKED"
            ]
        }

        print()
        print("🚨" + "═" * 56 + "🚨")
        print("   CIRCUIT BREAKER FIRED")
        print("═" * 60)
        print(f"   Reason: {reason}")
        print(f"   Old hash: {old_hash[:32]}...")
        print(f"   New hash: {new_hash[:32]}...")
        print(f"   Time: {event['timestamp']}")
        print()
        print("   Actions taken:")
        print("   ❄️  Wallet: FROZEN")
        print("   🛑 Agent:  SUSPENDED")
        print("   📢 Alert:  SENT TO OWNER")
        print("   🚫 Transactions: ALL BLOCKED")
        print()
        print("   💰 Funds: COMPLETELY SAFE")
        print("   🦹 Attacker gets: NOTHING")
        print("🚨" + "═" * 56 + "🚨")
        print()

        return event

    def get_attestation_for_contract(self) -> str:
        """
        Get attestation hash formatted for smart contract.
        Returns bytes32 hex string for DarkAgent.sol.
        """
        attestation = self.generate_attestation()
        # Convert to bytes32 format (0x prefixed, 64 hex chars)
        return "0x" + attestation["mrenclave"]

    def get_status(self) -> dict:
        """Get current attestation engine status."""
        return {
            "engine": "DarkAgent Attestation Engine",
            "code_path": self.agent_code_path,
            "initial_attestation": self.initial_attestation["mrenclave"][:16] + "..." if self.initial_attestation else None,
            "circuit_breaker_fired": self.circuit_breaker_fired,
            "verification_count": len(self.attestation_history),
            "status": "COMPROMISED" if self.circuit_breaker_fired else "SECURE"
        }


class AttestationMonitor:
    """
    Continuously monitors attestation and fires circuit breaker if tampered.
    
    This runs as a background process:
      - Checks attestation every N seconds
      - Compares against initial hash
      - Fires circuit breaker on any change
    """

    def __init__(self, engine: AttestationEngine, check_interval: int = 5):
        self.engine = engine
        self.check_interval = check_interval
        self.monitoring = False
        self.checks_performed = 0

    def start_monitoring(self, max_checks: int = None):
        """Start continuous attestation monitoring."""
        self.monitoring = True
        print(f"👁️  Attestation Monitor started (checking every {self.check_interval}s)")
        
        try:
            while self.monitoring:
                result = self.engine.verify_attestation()
                self.checks_performed += 1
                
                if not result["valid"]:
                    print(f"\n🚨 Check #{self.checks_performed}: ATTESTATION FAILED!")
                    self.monitoring = False
                    return result
                else:
                    sys.stdout.write(f"\r   ✅ Check #{self.checks_performed}: Attestation valid")
                    sys.stdout.flush()
                
                if max_checks and self.checks_performed >= max_checks:
                    break
                    
                time.sleep(self.check_interval)
                
        except KeyboardInterrupt:
            print(f"\n\n👁️  Monitor stopped after {self.checks_performed} checks")
            self.monitoring = False

        return {"valid": True, "checks": self.checks_performed}

    def stop_monitoring(self):
        """Stop the attestation monitor."""
        self.monitoring = False


def main():
    """Demo the attestation engine."""
    print("═" * 60)
    print("  🔐 DarkAgent Attestation Engine Demo")
    print("═" * 60)
    print()

    # Initialize engine
    engine = AttestationEngine()
    
    # Verify attestation (should pass)
    print("\n━━━ Verification Test ━━━")
    result = engine.verify_attestation()
    print(f"Result: {'✅ VALID' if result['valid'] else '❌ FAILED'}")
    print(f"MRENCLAVE: {result['current_mrenclave'][:32]}...")
    
    # Get contract-ready attestation
    print("\n━━━ Contract Attestation ━━━")
    contract_hash = engine.get_attestation_for_contract()
    print(f"bytes32: {contract_hash[:34]}...")
    
    # Show status
    print("\n━━━ Engine Status ━━━")
    status = engine.get_status()
    print(json.dumps(status, indent=2))
    
    print("\n━━━ Demo Complete ━━━")
    print("To test tamper detection, modify agent.py and run verify again.")


if __name__ == "__main__":
    _fix_windows_encoding()
    main()
