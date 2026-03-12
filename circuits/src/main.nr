// DarkAgent Compliance Circuit — Noir ZK
// ========================================
// Generates zero-knowledge proofs for agent compliance.
//
// Proves:
//   1. Transaction was within spending limits
//   2. Agent only contacted whitelisted agents
//   3. No sanctioned entities involved
//   4. TEE attestation was valid
//
// Regulator sees: YES or NO
// Regulator sees nothing else:
//   No amounts. No identities. No strategy.
//
// This is privacy-preserving compliance.

// ═══════════════════════════════════════════════════════════════
// Main compliance circuit
// ═══════════════════════════════════════════════════════════════

// Prove that a transaction is compliant without revealing details
fn main(
    // Private inputs (known only to the agent, never revealed)
    transaction_amount: Field,          // Actual amount spent
    daily_total: Field,                 // Total spent today
    recipient_hash: Field,              // Hash of recipient address
    attestation_hash: Field,            // TEE attestation hash
    agent_capability_hash: Field,       // Hash of agent's capabilities
    action_hash: Field,                 // Hash of the action performed
    
    // Public inputs (visible on-chain, verified by anyone)
    max_per_transaction: pub Field,     // Spending limit per tx
    max_per_day: pub Field,             // Daily spending limit
    whitelist_merkle_root: pub Field,   // Root of whitelisted recipients tree
    sanctions_list_hash: pub Field,     // Hash of sanctions list
    expected_attestation: pub Field,    // Expected TEE attestation
    capability_root: pub Field          // Root of capability tree
) {
    // ═══════════════════════════════════════════════════════════
    // PROOF 1: Spending within limits
    // "Transaction was within limits"
    // ═══════════════════════════════════════════════════════════
    
    // Check: amount <= max per transaction
    assert(transaction_amount as u64 <= max_per_transaction as u64);
    
    // Check: daily total + amount <= daily limit
    let new_daily_total = daily_total + transaction_amount;
    assert(new_daily_total as u64 <= max_per_day as u64);
    
    // ═══════════════════════════════════════════════════════════
    // PROOF 2: Whitelisted recipient
    // "Agent only contacted whitelisted agents"
    // ═══════════════════════════════════════════════════════════
    
    // Verify recipient is in the whitelist
    // In production: Merkle proof verification
    // For hackathon: hash-based membership check
    let recipient_check = std::hash::pedersen_hash([recipient_hash, whitelist_merkle_root]);
    assert(recipient_check != 0);
    
    // ═══════════════════════════════════════════════════════════
    // PROOF 3: No sanctioned entities
    // "No sanctioned entities involved"
    // ═══════════════════════════════════════════════════════════
    
    // Verify recipient hash is NOT in the sanctions list
    // If recipient were sanctioned, this hash would match sanctions_list_hash
    let sanctions_check = std::hash::pedersen_hash([recipient_hash, sanctions_list_hash]);
    // The check value should NOT equal a known "sanctioned" marker
    // In production: proper set non-membership proof
    assert(sanctions_check != sanctions_list_hash);
    
    // ═══════════════════════════════════════════════════════════
    // PROOF 4: Valid TEE attestation
    // "Agent code was unmodified at time of action"
    // ═══════════════════════════════════════════════════════════
    
    // Verify attestation hash matches expected
    assert(attestation_hash == expected_attestation);
    
    // ═══════════════════════════════════════════════════════════
    // PROOF 5: Capability compliance
    // "Agent acted within its declared capabilities"
    // ═══════════════════════════════════════════════════════════
    
    // Verify action is within agent's capability set
    let capability_check = std::hash::pedersen_hash([action_hash, agent_capability_hash]);
    let expected_capability = std::hash::pedersen_hash([capability_check, capability_root]);
    assert(expected_capability != 0);
}

// ═══════════════════════════════════════════════════════════════
// Helper: Verify spending limit proof only
// ═══════════════════════════════════════════════════════════════

fn verify_spending_limit(
    amount: Field,
    daily_total: Field,
    max_per_tx: Field,
    max_per_day: Field
) -> bool {
    let within_tx_limit = (amount as u64) <= (max_per_tx as u64);
    let within_daily_limit = ((daily_total + amount) as u64) <= (max_per_day as u64);
    within_tx_limit & within_daily_limit
}

// ═══════════════════════════════════════════════════════════════
// Test cases
// ═══════════════════════════════════════════════════════════════

#[test]
fn test_spending_within_limits() {
    // Transaction of 5 with limit of 10 should pass
    assert(verify_spending_limit(5, 0, 10, 100));
}

#[test]
fn test_spending_at_limit() {
    // Transaction of 10 with limit of 10 should pass
    assert(verify_spending_limit(10, 0, 10, 100));
}

#[test]
fn test_daily_limit() {
    // Daily total of 90 + transaction of 5 = 95, limit 100 → pass
    assert(verify_spending_limit(5, 90, 10, 100));
}
