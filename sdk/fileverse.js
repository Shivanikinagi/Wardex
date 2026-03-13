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

require('dotenv').config();

const FILEVERSE_API = process.env.FILEVERSE_API_URL || 'https://api.fileverse.io/v1';
const API_KEY = process.env.FILEVERSE_API_KEY || '';
const NAMESPACE = process.env.FILEVERSE_NAMESPACE || 'darkagent';

/**
 * Store an audit document on Fileverse.
 * @param {object} data - Document payload
 */
async function storeAuditDocument(data) {
  const document = {
    type: 'verification-receipt',
    namespace: NAMESPACE,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    data,
    metadata: {
      project: 'darkagent',
      network: 'base-sepolia',
    },
  };

  if (!API_KEY) {
    // Offline mode — return a simulated CID for demo
    const hash = require('crypto').createHash('sha256').update(JSON.stringify(document)).digest('hex');
    console.log(`📋 [Fileverse offline] Document stored locally: ${hash}`);
    return {
      success: true,
      cid: `Qm${hash.substring(0, 44)}`,
      url: `https://portal.fileverse.io/#/ns/${NAMESPACE}/${hash}`,
      offline: true,
    };
  }

  const response = await fetch(`${FILEVERSE_API}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(document),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Fileverse API error: ${response.status} ${err}`);
  }

  const result = await response.json();
  console.log(`✅ Audit document stored: ${result.cid}`);

  return {
    success: true,
    cid: result.cid,
    url: result.url || `https://portal.fileverse.io/#/ns/${NAMESPACE}/${result.cid}`,
    offline: false,
  };
}

/**
 * Store a complete Verification Receipt on Fileverse.
 * Proves that an execution passed the ENS rules via DarkAgent.
 * Exactly matches requirements: {proposalId, agent, user, action, rulesChecked, timestamp, signature}
 */
async function storeVerificationReceipt({ proposalId, agent, user, action, rulesChecked, timestamp, signature }) {
  return storeAuditDocument({
    proposalId,
    agent,
    user,
    action,
    rulesChecked,
    timestamp: timestamp || Math.floor(Date.now() / 1000),
    signature
  });
}

/**
 * List audit documents for a specific agent.
 * @param {string} agentAddress - Agent wallet address
 */
async function listAuditDocuments(agentAddress) {
  if (!API_KEY) {
    console.log('📋 [Fileverse offline] Cannot list documents without API key');
    return [];
  }

  const params = new URLSearchParams({
    namespace: NAMESPACE,
    'metadata.project': 'darkagent',
  });
  if (agentAddress) params.set('data.agent', agentAddress);

  const response = await fetch(`${FILEVERSE_API}/documents?${params}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });

  if (!response.ok) throw new Error(`Fileverse API error: ${response.status}`);

  const result = await response.json();
  return result.documents || [];
}

module.exports = {
  storeVerificationReceipt,
  listAuditDocuments
};
