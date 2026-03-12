/**
 * sdk/elsa.js
 *
 * HeyElsa x402 integration for DarkAgent.
 * Parses natural language commands into DarkAgent actions,
 * and formats receipts for display.
 *
 * HeyElsa API: https://heyelsa.ai
 * x402 payment protocol for HTTP-based micropayments.
 */

const { ethers } = require('ethers')

const ELSA_API_BASE = process.env.HEYELSA_API_URL || 'https://api.heyelsa.ai/v1'
const ELSA_API_KEY = process.env.HEYELSA_API_KEY || ''

// ── Intent mapping ──────────────────────────────────────────

const INTENT_MAP = {
  'check-balance': { action: 'query', contract: 'darkAgent', method: 'getAgent' },
  'register-agent': { action: 'write', contract: 'darkAgent', method: 'registerAgent' },
  'fire-circuit-breaker': { action: 'write', contract: 'darkAgent', method: 'fireCircuitBreaker' },
  'unfreeze-agent': { action: 'write', contract: 'darkAgent', method: 'unfreezeAgent' },
  'check-compliance': { action: 'query', contract: 'verifier', method: 'getComplianceStatus' },
  'submit-proof': { action: 'write', contract: 'verifier', method: 'submitAndVerifyProof' },
  'list-agents': { action: 'query', contract: 'darkAgent', method: 'getAllAgents' },
  'grant-capabilities': { action: 'write', contract: 'capabilityCheck', method: 'grantCapabilities' },
}

/**
 * Parse a natural language command into structured intent + params.
 * Falls back to local regex parsing when HeyElsa API is unavailable.
 */
async function parseIntent(naturalLanguage) {
  // Try HeyElsa API first
  if (ELSA_API_KEY) {
    try {
      const response = await fetch(`${ELSA_API_BASE}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ELSA_API_KEY}`,
          'X-402-Payment': 'darkagent',
        },
        body: JSON.stringify({
          input: naturalLanguage,
          context: 'darkagent-management',
          intents: Object.keys(INTENT_MAP),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return {
          intent: data.intent,
          params: data.params,
          confidence: data.confidence,
          source: 'heyelsa',
        }
      }
    } catch {
      // Fall through to local parsing
    }
  }

  return localParse(naturalLanguage)
}

/**
 * Local regex-based command parser (offline fallback).
 */
function localParse(input) {
  const patterns = [
    { regex: /register\s+agent\s+(.+)/i, intent: 'register-agent', extract: m => ({ ensName: m[1].trim() }) },
    { regex: /(?:check|get)\s+(?:status|balance)\s+(?:of\s+|for\s+)?(.+)/i, intent: 'check-balance', extract: m => ({ target: m[1].trim() }) },
    { regex: /(?:fire|trigger)\s+circuit\s*breaker\s+(?:on\s+|for\s+)?(.+)/i, intent: 'fire-circuit-breaker', extract: m => ({ target: m[1].trim() }) },
    { regex: /freeze\s+(.+)/i, intent: 'fire-circuit-breaker', extract: m => ({ target: m[1].trim() }) },
    { regex: /unfreeze\s+(.+)/i, intent: 'unfreeze-agent', extract: m => ({ target: m[1].trim() }) },
    { regex: /compliance\s+(?:check|query)\s+(?:for\s+)?(.+)/i, intent: 'check-compliance', extract: m => ({ target: m[1].trim() }) },
    { regex: /(?:list|show)\s+(?:all\s+)?agents/i, intent: 'list-agents', extract: () => ({}) },
    { regex: /grant\s+(.+?)\s+to\s+(.+)/i, intent: 'grant-capabilities', extract: m => ({ capabilities: m[1].trim(), target: m[2].trim() }) },
    { regex: /submit\s+(?:zk\s+)?proof\s+(?:for\s+)?(.+)/i, intent: 'submit-proof', extract: m => ({ target: m[1].trim() }) },
  ]

  for (const { regex, intent, extract } of patterns) {
    const match = input.match(regex)
    if (match) {
      return { intent, params: extract(match), confidence: 0.85, source: 'local' }
    }
  }

  return { intent: 'unknown', params: { raw: input }, confidence: 0, source: 'local' }
}

/**
 * Execute a parsed intent against DarkAgent contracts.
 */
async function executeIntent(parsedIntent, contracts, signer) {
  const mapping = INTENT_MAP[parsedIntent.intent]
  if (!mapping) {
    return { success: false, error: `Unknown intent: ${parsedIntent.intent}` }
  }

  const contract = contracts[mapping.contract]
  if (!contract) {
    return { success: false, error: `Contract ${mapping.contract} not available` }
  }

  try {
    if (mapping.action === 'query') {
      const result = await contract[mapping.method](
        ...(parsedIntent.params.target ? [parsedIntent.params.target] : [])
      )
      return { success: true, data: result, type: 'query' }
    }

    // Write transaction
    const connectedContract = contract.connect(signer)
    const args = buildTxArgs(parsedIntent)
    const tx = await connectedContract[mapping.method](...args)
    const receipt = await tx.wait()

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      type: 'transaction',
    }
  } catch (err) {
    return { success: false, error: err.reason || err.message }
  }
}

function buildTxArgs(parsedIntent) {
  const { intent, params } = parsedIntent

  switch (intent) {
    case 'fire-circuit-breaker':
      return [params.target, 'Elsa command: circuit breaker fired']
    case 'unfreeze-agent':
      return [params.target, ethers.zeroPadValue('0x', 32)]
    case 'submit-proof':
      return [
        params.target,
        ethers.toUtf8Bytes('elsa-compliance-proof'),
        'spending_limit',
        [0, 0],
      ]
    default:
      return Object.values(params)
  }
}

/**
 * Format an execution result into a human-readable receipt.
 */
function formatReceipt(result) {
  if (!result.success) return `❌ ${result.error}`

  if (result.type === 'query') {
    return `✅ Query result: ${JSON.stringify(result.data, null, 2)}`
  }

  return [
    '✅ Transaction confirmed',
    `  TX:    ${result.txHash}`,
    `  Block: ${result.blockNumber}`,
    `  Gas:   ${result.gasUsed}`,
  ].join('\n')
}

module.exports = {
  parseIntent,
  localParse,
  executeIntent,
  formatReceipt,
  INTENT_MAP,
}
