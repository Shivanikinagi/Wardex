/**
 * DarkAgent 🤝 Fileverse: The Default Audit Trail Layer
 *
 * Problem: Fileverse is decentralized storage, but nobody is using it for 
 *          accountability in DeFi. No killer use case yet.
 * 
 * Solution: Compliance receipts stored permanently on Fileverse. Every AI agent 
 *           execution produces a tamper-proof verification receipt stored on Fileverse forever.
 * 
 * You give Fileverse its killer use case:
 * "The audit trail layer for all AI agents in DeFi."
 */

require('dotenv').config()

const FILEVERSE_API = process.env.FILEVERSE_API_URL || 'https://api.fileverse.io/v1'
const API_KEY = process.env.FILEVERSE_API_KEY || ''
const NAMESPACE = process.env.FILEVERSE_NAMESPACE || 'darkagent'

// ── Audit Document Types ────────────────────────────────────

const DOC_TYPES = {
  VERIFICATION_RECEIPT: 'verification-receipt',
  CIRCUIT_BREAKER: 'circuit-breaker-event',
  COMPLIANCE_PROOF: 'compliance-proof',
  TRANSACTION: 'transaction-receipt',
  ATTESTATION: 'attestation-record',
  REGISTRATION: 'agent-registration',
}

// ── Core API ────────────────────────────────────────────────

/**
 * Store an audit document on Fileverse.
 * @param {string} docType - One of DOC_TYPES
 * @param {object} data - Document payload
 * @param {object} metadata - Additional metadata (agent address, tx hash, etc.)
 * @returns {{ success: boolean, cid: string, url: string }}
 */
async function storeAuditDocument(docType, data, metadata = {}) {
  const document = {
    type: docType,
    namespace: NAMESPACE,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    data,
    metadata: {
      ...metadata,
      project: 'darkagent',
      network: 'base-sepolia',
    },
  }

  if (!API_KEY) {
    // Offline mode — return a simulated CID for demo
    const hash = simpleHash(JSON.stringify(document))
    console.log(`📋 [Fileverse offline] Document stored locally: ${hash}`)
    return {
      success: true,
      cid: `Qm${hash}`,
      url: `https://portal.fileverse.io/#/ns/${NAMESPACE}/${hash}`,
      offline: true,
    }
  }

  const response = await fetch(`${FILEVERSE_API}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(document),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Fileverse API error: ${response.status} ${err}`)
  }

  const result = await response.json()
  console.log(`✅ Audit document stored: ${result.cid}`)

  return {
    success: true,
    cid: result.cid,
    url: result.url || `https://portal.fileverse.io/#/ns/${NAMESPACE}/${result.cid}`,
    offline: false,
  }
}

// ── Specialized Document Stores ─────────────────────────────

/**
 * Store a complete Verification Receipt on Fileverse.
 * Proves that an execution passed the ENS rules via DarkAgent.
 */
async function storeVerificationReceipt({ proposalId, agentAddress, user, action, rulesChecked, signature }) {
  return storeAuditDocument(DOC_TYPES.VERIFICATION_RECEIPT, {
    proposal_id: proposalId,
    agent: agentAddress,
    user: user,
    action: action,
    rules_checked: rulesChecked,
    verified_by: "DarkAgent",
    signature: signature
  })
}

/**
 * Store a circuit breaker firing event.
 */
async function storeCircuitBreakerEvent({ agentAddress, agentName, reason, txHash, blockNumber, attestationHash }) {
  return storeAuditDocument(DOC_TYPES.CIRCUIT_BREAKER, {
    event: 'circuit-breaker-fired',
    agent: agentAddress,
    agentName,
    reason,
    attestationHash,
  }, { txHash, blockNumber })
}

/**
 * Store a ZK compliance proof verification.
 */
async function storeComplianceProof({ agentAddress, proofType, verified, txHash, blockNumber, proofHash }) {
  return storeAuditDocument(DOC_TYPES.COMPLIANCE_PROOF, {
    agent: agentAddress,
    proofType,
    verified,
    proofHash,
  }, { txHash, blockNumber })
}

/**
 * Store a transaction receipt for audit.
 */
async function storeTransactionReceipt({ agentAddress, action, recipient, amount, txHash, blockNumber }) {
  return storeAuditDocument(DOC_TYPES.TRANSACTION, {
    agent: agentAddress,
    action,
    recipient,
    amount,
  }, { txHash, blockNumber })
}

/**
 * Store an attestation verification record.
 */
async function storeAttestationRecord({ agentAddress, attestationHash, valid, mrenclave, mrsigner }) {
  return storeAuditDocument(DOC_TYPES.ATTESTATION, {
    agent: agentAddress,
    attestationHash,
    valid,
    mrenclave,
    mrsigner,
  })
}

/**
 * Store an agent registration event.
 */
async function storeRegistrationEvent({ agentAddress, ensName, capabilities, txHash, blockNumber }) {
  return storeAuditDocument(DOC_TYPES.REGISTRATION, {
    agent: agentAddress,
    ensName,
    capabilities,
  }, { txHash, blockNumber })
}

// ── Retrieval ───────────────────────────────────────────────

/**
 * List audit documents for a specific agent.
 * @param {string} agentAddress - Agent wallet address
 * @param {string} docType - Optional filter by document type
 */
async function listAuditDocuments(agentAddress, docType = null) {
  if (!API_KEY) {
    console.log('📋 [Fileverse offline] Cannot list documents without API key')
    return []
  }

  const params = new URLSearchParams({
    namespace: NAMESPACE,
    'metadata.project': 'darkagent',
  })
  if (agentAddress) params.set('data.agent', agentAddress)
  if (docType) params.set('data.type', docType)

  const response = await fetch(`${FILEVERSE_API}/documents?${params}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  })

  if (!response.ok) throw new Error(`Fileverse API error: ${response.status}`)

  const result = await response.json()
  return result.documents || []
}

// ── Utility ─────────────────────────────────────────────────

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(12, '0').slice(0, 46)
}

module.exports = {
  DOC_TYPES,
  storeAuditDocument,
  storeCircuitBreakerEvent,
  storeComplianceProof,
  storeTransactionReceipt,
  storeAttestationRecord,
  storeRegistrationEvent,
  listAuditDocuments,
}
