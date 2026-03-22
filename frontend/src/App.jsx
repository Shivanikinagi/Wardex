import { useEffect, useMemo, useState } from 'react'
import { WardexProvider, useWardex } from './context/WardexContext'
import './App.css'

const SOURCES = [
  { value: 'ai_bot', label: 'AI bot' },
  { value: 'influencer', label: 'Influencer signal' },
  { value: 'telegram', label: 'Telegram alpha' },
  { value: 'friend', label: 'Friend recommendation' },
  { value: 'copy_trader', label: 'Copy trader' },
]

const TOKENS = ['USDC', 'ETH', 'WBTC', 'AAVE', 'PEPE', 'DEGEN', 'SHIB']

const EXPLORER_BASE = 'https://sepolia.basescan.org'
const BLINK_BASE_URL =
  import.meta.env.VITE_BLINK_BASE_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/trade` : 'https://example.com/trade')

function isHexAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ''))
}

function isTxHash(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(String(value || ''))
}

function isMockTxId(value) {
  return String(value || '').startsWith('mocktx_')
}

function isIpfsCid(value) {
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}|^bafy[a-zA-Z0-9]{20,}$/.test(String(value || ''))
}

function shortValue(value, size = 10) {
  const text = String(value || '')
  if (text.length <= size) return text
  return `${text.slice(0, size)}...`
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  const success = document.execCommand('copy')
  document.body.removeChild(textarea)
  return success
}

async function copyText(value) {
  if (!value) return false
  const text = String(value)

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to legacy copy path.
  }

  return fallbackCopy(text)
}

function openProofJson(proof) {
  if (!proof) return
  const blob = new Blob([JSON.stringify(proof, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
}

function parseBlinkUrl(url) {
  try {
    const parsed = new URL(url)
    return {
      source: parsed.searchParams.get('source') || 'unknown',
      amountUsd: Number(parsed.searchParams.get('amountUsd') || 0),
      tokenIn: parsed.searchParams.get('tokenIn') || 'USDC',
      tokenOut: parsed.searchParams.get('tokenOut') || 'ETH',
      protocol: parsed.searchParams.get('protocol') || 'uniswap',
      ensName: parsed.searchParams.get('ens') || 'alice.eth',
      slippageBps: Number(parsed.searchParams.get('slippageBps') || 0),
    }
  } catch {
    return null
  }
}

function buildBlinkFromLocation() {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const hasBlinkQuery = params.has('amountUsd') || params.has('tokenIn') || params.has('tokenOut') || params.has('protocol')
  if (!hasBlinkQuery) return null

  return {
    source: params.get('source') || 'ai_bot',
    amountUsd: params.get('amountUsd') || '250',
    tokenIn: params.get('tokenIn') || 'USDC',
    tokenOut: params.get('tokenOut') || 'ETH',
    protocol: params.get('protocol') || 'uniswap',
    ensName: params.get('ens') || 'alice.eth',
    slippageBps: params.get('slippageBps') || '120',
    url: window.location.href,
  }
}

function verdictLabel(decision) {
  if (decision === 'block') return 'BLOCK'
  if (decision === 'auto-downsize') return 'DOWNSIZE'
  return 'ALLOW'
}

function statsFromState(state) {
  const events = state?.activity || []
  const proofs = state?.proofs || []
  let blocked = 0
  let downsized = 0
  let allowed = 0

  for (const event of events) {
    if (event.type !== 'analysis') continue
    if (event.status === 'block') blocked += 1
    else if (event.status === 'auto-downsize') downsized += 1
    else if (event.status === 'allow') allowed += 1
  }

  return {
    allowed,
    downsized,
    blocked,
    proofs: proofs.length,
  }
}

function mergeEvidence(...groups) {
  const seen = new Set()
  const merged = []

  for (const group of groups) {
    for (const entry of group || []) {
      if (!entry?.value) continue
      const key = `${entry.label}::${entry.value}::${entry.href || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(entry)
    }
  }

  return merged
}

function nextSponsorStatus(current, candidate) {
  const rank = { pending: 0, configured: 1, ready: 2 }
  return (rank[candidate] || 0) > (rank[current] || 0) ? candidate : current
}

function sponsorStatusLabel(entry) {
  if (entry.status === 'configured') return 'CONFIGURED'
  if (entry.status !== 'ready') return 'PENDING'
  if (entry.key === 'zyfai') return 'FUNDED'
  if (entry.key === 'filecoin') return 'CID READY'
  if (entry.key === 'lit') return 'LINK READY'
  return 'PROOF READY'
}

function buildSponsorEvidence({ analysisResult, executionResult, selectedPolicy, latestProofs, integrations }) {
  const proof = executionResult?.proof || analysisResult?.proof || latestProofs?.[0] || null
  const txid = executionResult?.execution?.txid || integrations?.latestExecution?.txid || ''
  const receiptUrl = executionResult?.execution?.receiptUrl || integrations?.latestExecution?.receiptUrl || ''
  const executionMode = String(executionResult?.execution?.mode || '')
  const fundedBy =
    executionResult?.fundedBy ||
    analysisResult?.fundedBy ||
    proof?.integrations?.fundedBy ||
    ''
  const litActionCid =
    executionResult?.litActionCid ||
    analysisResult?.litActionCid ||
    analysisResult?.analysis?.litActionCid ||
    proof?.integrations?.litActionCid ||
    ''
  const executionFilecoinCid =
    executionResult?.filecoinCid ||
    proof?.integrations?.filecoinCid ||
    integrations?.latestProof?.integrations?.filecoinCid ||
    ''
  const budgetSource = String(
    selectedPolicy?.synced?.budgetSource ||
    proof?.integrations?.budgetSource ||
    ''
  ).toLowerCase()
  const usesYieldBudget = budgetSource.includes('yield') || budgetSource.includes('treasury')
  const isMockTx = isMockTxId(txid) || executionMode === 'mock'
  const txLink = isMockTx ? '' : isTxHash(txid) ? `${EXPLORER_BASE}/tx/${txid}` : receiptUrl
  const serverSponsors = integrations?.sponsors || []
  const sponsorMap = new Map(
    serverSponsors.map((entry) => [
      entry.key,
      {
        key: entry.key,
        name: entry.name,
        track: entry.track,
        status: entry.status || 'pending',
        detail: entry.detail || '',
        evidence: [...(entry.evidence || [])],
      },
    ])
  )

  function ensureSponsor(key, fallback) {
    if (!sponsorMap.has(key)) {
      sponsorMap.set(key, {
        key,
        evidence: [],
        status: 'pending',
        detail: '',
        ...fallback,
      })
    }
    return sponsorMap.get(key)
  }

  const base = ensureSponsor('base', { name: 'Base', track: 'Agent Services', detail: 'Waiting for Base execution evidence.' })
  base.status = nextSponsorStatus(base.status, txLink ? 'ready' : base.status)
  base.detail =
    isMockTx && txid
      ? `Mock execution ${shortValue(txid, 16)} completed locally, so there is no public explorer URL.`
      : txLink
        ? `Live Base execution receipt ${shortValue(txid || txLink, 16)} is available.`
        : base.detail
  base.evidence = mergeEvidence(
    [
      txLink ? { label: 'Base transaction', value: txid || receiptUrl, href: txLink || receiptUrl || '' } : null,
    ],
    base.evidence
  )

  const ens = ensureSponsor('ens', { name: 'ENS Identity', track: 'Identity', detail: 'Waiting for an ENS policy profile.' })
  ens.status = nextSponsorStatus(ens.status, selectedPolicy?.ensName ? 'ready' : ens.status)
  ens.detail = selectedPolicy?.ensName ? `Policy profile ${selectedPolicy.ensName}` : ens.detail
  ens.evidence = mergeEvidence(
    selectedPolicy?.ensName
      ? [{ label: 'ENS profile', value: selectedPolicy.ensName, href: `https://app.ens.domains/${selectedPolicy.ensName}` }]
      : [],
    ens.evidence
  )

  const filecoin = ensureSponsor('filecoin', { name: 'Filecoin', track: 'Agentic Storage', detail: 'Waiting for a persisted storage proof.' })
  filecoin.status = nextSponsorStatus(filecoin.status, executionFilecoinCid ? 'ready' : filecoin.status)
  filecoin.detail = executionFilecoinCid ? `Execution record ${shortValue(executionFilecoinCid, 18)} is persisted.` : filecoin.detail
  filecoin.evidence = mergeEvidence(
    executionFilecoinCid
      ? [
          {
            label: 'Latest CID',
            value: executionFilecoinCid,
            href: `https://calibration.filfox.info/en/message/${executionFilecoinCid}`,
          },
        ]
      : [],
    filecoin.evidence
  )

  const lit = ensureSponsor('lit', { name: 'Lit Protocol', track: 'Dark Knowledge', detail: 'Waiting for Lit action configuration.' })
  lit.status = nextSponsorStatus(lit.status, litActionCid ? 'ready' : lit.status)
  lit.detail = litActionCid ? `Sealed policy action ${shortValue(litActionCid, 18)} is attached.` : lit.detail
  lit.evidence = mergeEvidence(
    [
      {
        label: 'Lit Action CID',
        value: litActionCid,
        href: litActionCid ? `https://ipfs.io/ipfs/${litActionCid}` : '',
      },
    ],
    lit.evidence
  )

  const zyfai = ensureSponsor('zyfai', { name: 'Zyfai', track: 'Yield Powered Agent', detail: 'Waiting for yield-funded inference evidence.' })
  zyfai.status = nextSponsorStatus(zyfai.status, fundedBy === 'zyfai_yield' ? 'ready' : zyfai.status)
  zyfai.detail = fundedBy === 'zyfai_yield' ? 'Inference for this run was funded by Zyfai yield.' : zyfai.detail
  zyfai.evidence = mergeEvidence(
    [{ label: 'Funding source', value: fundedBy === 'zyfai_yield' ? 'Zyfai yield' : '', href: '' }],
    zyfai.evidence
  )

  const lido = ensureSponsor('lido', { name: 'Lido', track: 'stETH Treasury', detail: 'Waiting for treasury-aware budget evidence.' })
  lido.status = nextSponsorStatus(lido.status, usesYieldBudget ? 'ready' : lido.status)
  lido.detail = usesYieldBudget ? 'Execution budget is currently yield-constrained.' : lido.detail
  lido.evidence = mergeEvidence(
    [{ label: 'Budget source', value: budgetSource, href: '' }],
    lido.evidence
  )

  const status = ensureSponsor('status', { name: 'Status Network', track: 'Gasless Deploy', detail: 'Waiting for Status network proof links.' })
  status.evidence = mergeEvidence(status.evidence)

  return ['base', 'ens', 'filecoin', 'lit', 'zyfai', 'lido', 'status']
    .map((key) => sponsorMap.get(key))
    .filter(Boolean)
}

function LivewardexApp() {
  const {
    apiBase,
    state,
    loading,
    busy,
    error,
    analyzeBlinkUrl,
    executeBlinkUrl,
    streamStatus,
  } = usewardex()

  const [tab, setTab] = useState('create')
  const [draft, setDraft] = useState({
    source: 'ai_bot',
    amountUsd: '250',
    tokenIn: 'USDC',
    tokenOut: 'ETH',
    protocol: 'uniswap',
    ensName: 'alice.eth',
    slippageBps: '120',
  })
  const [blinkUrl, setBlinkUrl] = useState('')
  const [analysisInput, setAnalysisInput] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [executionResult, setExecutionResult] = useState(null)
  const [runningAnalyze, setRunningAnalyze] = useState(false)
  const [runningExecute, setRunningExecute] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    const blinkFromUrl = buildBlinkFromLocation()
    if (!blinkFromUrl) return

    setDraft((prev) => ({
      ...prev,
      source: blinkFromUrl.source,
      amountUsd: String(blinkFromUrl.amountUsd),
      tokenIn: blinkFromUrl.tokenIn,
      tokenOut: blinkFromUrl.tokenOut,
      protocol: blinkFromUrl.protocol,
      ensName: blinkFromUrl.ensName,
      slippageBps: String(blinkFromUrl.slippageBps),
    }))
    setAnalysisInput(blinkFromUrl.url)
    setTab('analyze')
    setRunningAnalyze(true)

    analyzeBlinkUrl({
      url: blinkFromUrl.url,
      ensName: blinkFromUrl.ensName,
    })
      .then((payload) => {
        setAnalysisResult(payload)
        setExecutionResult(null)
      })
      .finally(() => {
        setRunningAnalyze(false)
      })
  }, [analyzeBlinkUrl])

  function showCopyMessage(message) {
    setCopyMessage(message)
    setTimeout(() => setCopyMessage(''), 1800)
  }

  async function handleCopy(value, label = 'Value') {
    const copied = await copyText(value)
    showCopyMessage(copied ? `${label} copied` : `Could not copy ${label.toLowerCase()}`)
  }

  const stats = useMemo(() => statsFromState(state), [state])
  const selectedPolicy = useMemo(() => {
    const entries = state?.policies || []
    return entries.find((entry) => entry.ensName === draft.ensName) || entries[0] || null
  }, [state, draft.ensName])

  const historyItems = useMemo(() => {
    const activity = state?.activity || []
    const proofsById = new Map((state?.proofs || []).map((proof) => [proof.id, proof]))

    return activity
      .filter((item) => item.type === 'analysis' || item.type === 'execution')
      .map((item) => {
        const proof = proofsById.get(item.proofId)
        const txHref = !isMockTxId(item.txid) && isTxHash(item.txid)
          ? `${EXPLORER_BASE}/tx/${item.txid}`
          : item.receiptUrl && !isMockTxId(item.txid)
            ? item.receiptUrl
            : ''
        const proofHref = item.proofId ? `${apiBase}/api/proofs/${item.proofId}/view` : ''

        return {
          ...item,
          proof,
          proofHref,
          historyHref: txHref || proofHref,
        }
      })
  }, [apiBase, state])

  const latestProofs = useMemo(() => {
    const proofs = state?.proofs || []
    return [...proofs]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 3)
  }, [state])

  const sponsorEvidence = useMemo(
    () =>
      buildSponsorEvidence({
        analysisResult,
        executionResult,
        selectedPolicy,
        latestProofs,
        integrations: state?.integrations,
      }),
    [analysisResult, executionResult, selectedPolicy, latestProofs, state],
  )

  function generateBlink() {
    const qs = new URLSearchParams({
      source: draft.source,
      amountUsd: String(draft.amountUsd || 0),
      tokenIn: draft.tokenIn,
      tokenOut: draft.tokenOut,
      protocol: draft.protocol,
      ens: draft.ensName,
      slippageBps: String(draft.slippageBps || 0),
      chain: 'base',
      sender: draft.source,
    })
    const url = `${BLINK_BASE_URL}?${qs.toString()}`
    setBlinkUrl(url)
  }

  async function runAnalyze() {
    if (!analysisInput.trim()) return
    setRunningAnalyze(true)
    try {
      const parsed = parseBlinkUrl(analysisInput)
      const ensName = parsed?.ensName || draft.ensName || 'alice.eth'
      const payload = await analyzeBlinkUrl({
        url: analysisInput,
        ensName,
      })
      setAnalysisResult(payload)
      setExecutionResult(null)
    } finally {
      setRunningAnalyze(false)
    }
  }

  async function runExecute() {
    if (!analysisInput.trim() || !analysisResult) return
    setRunningExecute(true)
    try {
      const parsed = parseBlinkUrl(analysisInput)
      const ensName = parsed?.ensName || draft.ensName || 'alice.eth'
      const payload = await executeBlinkUrl({
        url: analysisInput,
        ensName,
      })
      setExecutionResult(payload)
      setTab('success')
    } finally {
      setRunningExecute(false)
    }
  }

  const decision = analysisResult?.analysis?.decision || null
  const verdict = verdictLabel(decision)
  const canExecute = decision === 'allow' || decision === 'auto-downsize'

  return (
    <>
      <div className="grid-bg" />
      <div className="app">
        <header>
          <div className="logo">
            <div className="logo-icon" />
            <div>
              <div className="logo-text">wardex</div>
              <div className="logo-sub">live policy enforcement</div>
            </div>
          </div>
          <div className="header-right">
            <span className="net-pill">BASE SEPOLIA</span>
            <span className="wallet-pill">{selectedPolicy?.ensName || draft.ensName}</span>
          </div>
        </header>

        <div className="stat-row">
          <div className="stat"><div className="stat-val green">{stats.allowed}</div><div className="stat-label">ALLOWED</div></div>
          <div className="stat"><div className="stat-val amber">{stats.downsized}</div><div className="stat-label">DOWNSIZED</div></div>
          <div className="stat"><div className="stat-val red">{stats.blocked}</div><div className="stat-label">BLOCKED</div></div>
          <div className="stat"><div className="stat-val">{stats.proofs}</div><div className="stat-label">PROOFS</div></div>
        </div>

        {latestProofs.length > 0 && (
          <div className="proof-strip" role="region" aria-label="Latest proofs">
            {latestProofs.map((proof) => (
              <div className="proof-chip" key={proof.id}>
                <div className="proof-chip-title">{proof.kind || 'proof'}</div>
                <button className="proof-link" onClick={() => handleCopy(proof.id, 'Proof id')}>
                  {shortValue(proof.id, 14)}
                </button>
                <button className="proof-link" onClick={() => openProofJson(proof)}>
                  view json
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="tabs">
          <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>Create Blink</button>
          <button className={`tab ${tab === 'analyze' ? 'active' : ''}`} onClick={() => setTab('analyze')}>Analyze Blink</button>
          <button className={`tab ${tab === 'policy' ? 'active' : ''}`} onClick={() => setTab('policy')}>My Policy</button>
          <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>

        {error && <div className="reason-block" style={{ marginBottom: 12 }}><div className="reason-text">{error}</div></div>}
        {loading && <div className="reason-block" style={{ marginBottom: 12 }}><div className="reason-text">Loading live state...</div></div>}

        {tab === 'create' && (
          <div className="screen active">
            <div className="screen-head">
              <div className="screen-title">Create a Blink</div>
              <div className="screen-desc">Build a live Blink URL and send it to policy analysis.</div>
            </div>

            <div className="row2">
              <div className="field">
                <div className="field-label">Source</div>
                <select className="select" value={draft.source} onChange={(e) => setDraft((v) => ({ ...v, source: e.target.value }))}>
                  {SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                </select>
              </div>
              <div className="field">
                <div className="field-label">ENS</div>
                <input className="input" value={draft.ensName} onChange={(e) => setDraft((v) => ({ ...v, ensName: e.target.value }))} />
              </div>
            </div>

            <div className="row3">
              <div className="field">
                <div className="field-label">Amount USD</div>
                <input className="input" type="number" value={draft.amountUsd} onChange={(e) => setDraft((v) => ({ ...v, amountUsd: e.target.value }))} />
              </div>
              <div className="field">
                <div className="field-label">Token Out</div>
                <select className="select" value={draft.tokenOut} onChange={(e) => setDraft((v) => ({ ...v, tokenOut: e.target.value }))}>
                  {TOKENS.map((token) => <option key={token} value={token}>{token}</option>)}
                </select>
              </div>
              <div className="field">
                <div className="field-label">Slippage BPS</div>
                <input className="input" type="number" value={draft.slippageBps} onChange={(e) => setDraft((v) => ({ ...v, slippageBps: e.target.value }))} />
              </div>
            </div>

            <div className="btn-row">
              <button className="btn-primary" onClick={generateBlink}>Generate Blink</button>
            </div>

            {blinkUrl && (
              <div className="blink-box">
                <div className="blink-url-text">{blinkUrl}</div>
                <div className="blink-actions">
                  <button
                    className="btn-ghost"
                    onClick={() => handleCopy(blinkUrl, 'Blink URL')}
                  >
                    Copy
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setAnalysisInput(blinkUrl)
                      setTab('analyze')
                    }}
                  >
                    Analyze this Blink
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'analyze' && (
          <div className="screen active">
            <div className="screen-head">
              <div className="screen-title">Analyze Blink</div>
              <div className="screen-desc">Runs live server-side policy with Venice scoring, optional Lit sealed verdicts, and Zyfai-funded inference.</div>
            </div>

            <div className="analyze-row">
              <input
                className="analyze-input"
                value={analysisInput}
                onChange={(e) => setAnalysisInput(e.target.value)}
                placeholder="Paste Blink URL"
              />
              <button className="btn-primary" onClick={runAnalyze} disabled={runningAnalyze || busy}>
                {runningAnalyze ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>

            {(runningAnalyze || busy) && (
              <div className="terminal">
                <div className="t-line active">intercepting blink payload</div>
                <div className="t-line active">resolving ENS policy</div>
                <div className="t-line active">running policy checks</div>
              </div>
            )}

            {analysisResult && (
              <div className="score-card">
                <div className={`score-top ${decision === 'block' ? 'block-state' : decision === 'auto-downsize' ? 'downsize-state' : 'allow-state'}`}>
                  <div className={`verdict-text ${decision === 'block' ? 'block-v' : decision === 'auto-downsize' ? 'downsize-v' : 'allow-v'}`}>
                    {verdict}
                  </div>
                  <div className="score-meta">
                    score: {analysisResult.analysis.riskScore} | scorer: {analysisResult.scoredBy || 'rule-engine'}
                  </div>
                </div>
                <div className="score-body">
                  <div className="check-row">
                    <span className="check-label">Inference funding</span>
                    <span className="check-val info">{analysisResult.fundedBy === 'zyfai_yield' ? 'Zyfai yield' : 'Direct'}</span>
                  </div>
                  <div className="check-row">
                    <span className="check-label">Protocol</span>
                    <span className="check-val info">{analysisResult.parsedBlink.protocol}</span>
                  </div>
                  <div className="check-row">
                    <span className="check-label">Amount</span>
                    <span className="check-val info">
                      {`$${analysisResult.parsedBlink.amountUsd} -> $${analysisResult.analysis.executionAmountUsd}`}
                    </span>
                  </div>
                  <div className="check-row">
                    <span className="check-label">Summary</span>
                    <span className="check-val info">{analysisResult.analysis.summary}</span>
                  </div>
                  {analysisResult.analysis.fallbackUsed && (
                    <div className="reason-block">
                      <div className="reason-label-sm">Fallback</div>
                      <div className="reason-text">{analysisResult.analysis.fallbackReason}</div>
                    </div>
                  )}
                  {analysisResult.litActionCid && (
                    <div className="reason-block">
                      <div className="reason-label-sm">Lit Action (sealed policy)</div>
                      <div className="reason-text">{analysisResult.litActionCid}</div>
                    </div>
                  )}

                  {analysisResult.proof && (
                    <div className="reason-block">
                      <div className="reason-label-sm">Analysis proof</div>
                      <div className="proof-actions">
                        <span className="reason-text">{analysisResult.proof.id}</span>
                        <button className="btn-ghost" onClick={() => handleCopy(analysisResult.proof.id, 'Proof id')}>Copy proof id</button>
                        <button className="btn-ghost" onClick={() => openProofJson(analysisResult.proof)}>Open JSON</button>
                      </div>
                    </div>
                  )}

                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn-ghost" onClick={() => setAnalysisResult(null)}>Clear</button>
                    <button className="btn-primary" onClick={runExecute} disabled={!canExecute || runningExecute || busy}>
                      {runningExecute ? 'Executing...' : canExecute ? 'Execute' : 'Blocked'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'policy' && (
          <div className="screen active">
            <div className="screen-head">
              <div className="screen-title">My Policy</div>
              <div className="screen-desc">Current policy is loaded from live server state.</div>
            </div>
            {selectedPolicy ? (
              <div className="policy-grid">
                <div className="policy-card">
                  <div className="policy-card-title">Limits</div>
                  <div className="pol-row"><span className="pol-k">Max trade</span><span className="pol-v amber">{`$${selectedPolicy.synced?.maxTradeUsd || 0}`}</span></div>
                  <div className="pol-row"><span className="pol-k">Daily limit</span><span className="pol-v amber">{`$${selectedPolicy.synced?.dailyLimitUsd || 0}`}</span></div>
                  <div className="pol-row"><span className="pol-k">Daily spent</span><span className="pol-v">{`$${selectedPolicy.synced?.dailySpentUsd || 0}`}</span></div>
                  <div className="pol-row"><span className="pol-k">Slippage (bps)</span><span className="pol-v">{selectedPolicy.synced?.maxSlippageBps || 0}</span></div>
                  <div className="pol-row"><span className="pol-k">Budget source</span><span className="pol-v">{selectedPolicy.synced?.budgetSource || 'policy'}</span></div>
                  <div className="pol-row"><span className="pol-k">Principal</span><span className="pol-v green">LOCKED</span></div>
                </div>
                <div className="policy-card">
                  <div className="policy-card-title">Tokens</div>
                  <div className="token-grid">
                    {(selectedPolicy.synced?.allowedTokens || []).map((token) => (
                      <span key={token} className="tok allow">{token}</span>
                    ))}
                  </div>
                </div>
                <div className="policy-card">
                  <div className="policy-card-title">Protocols</div>
                  {(selectedPolicy.synced?.trustedProtocols || []).map((protocol) => (
                    <div className="pol-row" key={protocol}><span className="pol-k">{protocol}</span><span className="pol-v green">allowed</span></div>
                  ))}
                </div>
                <div className="policy-card">
                  <div className="policy-card-title">Sources</div>
                  {Object.entries(selectedPolicy.synced?.sourceLimits || {}).map(([source, limit]) => (
                    <div className="pol-row" key={source}><span className="pol-k">{source}</span><span className="pol-v">{`$${limit}`}</span></div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="reason-block"><div className="reason-text">No policy data available.</div></div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="screen active">
            <div className="screen-head">
              <div className="screen-title">History</div>
              <div className="screen-desc">Live activity stream from backend store.</div>
            </div>
            {historyItems.length === 0 ? (
              <div className="reason-block"><div className="reason-text">No activity yet.</div></div>
            ) : (
              historyItems.map((item) => (
                <div className="hist-item" key={item.id}>
                  <div className={`hist-badge ${verdictLabel(item.status)}`}>{verdictLabel(item.status)}</div>
                  <div className="hist-info">
                    <div className="hist-title">{item.source || item.protocol || item.type}</div>
                    <div className="hist-meta">{`${item.createdAt} | $${item.amountUsd || 0}`}</div>
                  </div>
                  {item.historyHref ? (
                    <a className="hist-proof" href={item.historyHref} target="_blank" rel="noopener noreferrer">
                      {item.txid && !isMockTxId(item.txid)
                        ? shortValue(item.txid, 12)
                        : item.proofId
                          ? shortValue(item.proofId, 12)
                          : 'proof'}
                    </a>
                  ) : (
                    <button className="hist-proof" onClick={() => handleCopy(item.txid || item.proofId || item.id, item.proofId ? 'Proof id' : 'Id')}>
                      {item.txid ? shortValue(item.txid, 12) : item.proofId ? shortValue(item.proofId, 12) : 'copy id'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'success' && executionResult && (
          <div className="screen active">
            <div className="success-wrap">
              <div className="success-title">Execution completed</div>
              <div className="success-sub">Live transaction and proof returned by backend execution.</div>
              <div className="tx-table">
                <div className="tx-row-item">
                  <span className="tx-k">Transaction</span>
                  <span className="tx-v">
                    {isTxHash(executionResult.execution?.txid) ? (
                      <a className="tx-link" href={`${EXPLORER_BASE}/tx/${executionResult.execution.txid}`} target="_blank" rel="noopener noreferrer">
                        {executionResult.execution.txid}
                      </a>
                    ) : (
                      <button className="proof-link" onClick={() => handleCopy(executionResult.execution?.txid, 'Transaction id')}>
                        {executionResult.execution?.txid || '-'}
                      </button>
                    )}
                  </span>
                </div>
                <div className="tx-row-item"><span className="tx-k">Stealth address</span><span className="tx-v">{executionResult.execution?.stealthAddress || '-'}</span></div>
                <div className="tx-row-item">
                  <span className="tx-k">Proof id</span>
                  <span className="tx-v">
                    {executionResult.proof?.id ? (
                      <button className="proof-link" onClick={() => handleCopy(executionResult.proof.id, 'Proof id')}>
                        {executionResult.proof.id}
                      </button>
                    ) : '-'}
                  </span>
                </div>
                <div className="tx-row-item">
                  <span className="tx-k">Verifier</span>
                  <span className="tx-v">
                    {isHexAddress(executionResult.execution?.verifierContract) ? (
                      <a className="tx-link" href={`${EXPLORER_BASE}/address/${executionResult.execution.verifierContract}`} target="_blank" rel="noopener noreferrer">
                        {executionResult.execution.verifierContract}
                      </a>
                    ) : 'not configured'}
                  </span>
                </div>
                <div className="tx-row-item">
                  <span className="tx-k">Filecoin CID</span>
                  <span className="tx-v">
                    {isIpfsCid(executionResult.filecoinCid) ? (
                      <a className="tx-link" href={`https://ipfs.io/ipfs/${executionResult.filecoinCid}`} target="_blank" rel="noopener noreferrer">
                        {executionResult.filecoinCid}
                      </a>
                    ) : 'not uploaded'}
                  </span>
                </div>
                <div className="tx-row-item"><span className="tx-k">Inference funded by</span><span className="tx-v">{executionResult.fundedBy === 'zyfai_yield' ? 'Zyfai yield' : 'Direct'}</span></div>
                <div className="tx-row-item">
                  <span className="tx-k">Lit Action CID</span>
                  <span className="tx-v">
                    {isIpfsCid(executionResult.litActionCid) ? (
                      <a className="tx-link" href={`https://ipfs.io/ipfs/${executionResult.litActionCid}`} target="_blank" rel="noopener noreferrer">
                        {executionResult.litActionCid}
                      </a>
                    ) : 'not configured'}
                  </span>
                </div>
              </div>

              <div className="screen-head" style={{ textAlign: 'left', marginTop: 18 }}>
                <div className="screen-title" style={{ fontSize: 16 }}>Sponsor Proofs</div>
                <div className="screen-desc">Track-by-track evidence with real external proof links when a public explorer or gateway exists.</div>
              </div>
              <div className="sponsor-grid">
                {sponsorEvidence.map((entry) => (
                  <div className="sponsor-card" key={entry.key || entry.name}>
                    <div className="sponsor-head">
                      <div>
                        <div className="sponsor-name">{entry.name}</div>
                        {entry.track && <div className="sponsor-track">{entry.track}</div>}
                      </div>
                      <span className={`sponsor-state ${entry.status}`}>
                        {sponsorStatusLabel(entry)}
                      </span>
                    </div>
                    <div className="sponsor-detail">{entry.detail}</div>
                    {(entry.evidence || []).some((item) => item?.href) && (
                      <div className="sponsor-evidence">
                        {(entry.evidence || []).filter((item) => item?.href).slice(0, 3).map((evidence) => (
                          <div className="sponsor-evidence-item" key={`${entry.key || entry.name}-${evidence.label}-${evidence.value}`}>
                            <span className="sponsor-evidence-label">{evidence.label}</span>
                            <a className="sponsor-link" href={evidence.href} target="_blank" rel="noopener noreferrer">
                              {shortValue(evidence.value, 24)}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button className="btn-ghost" onClick={() => setTab('create')}>New blink</button>
                <button className="btn-ghost" onClick={() => setTab('history')}>View history</button>
              </div>
            </div>
          </div>
        )}

        <div className="logo-sub" style={{ marginTop: 12 }}>
          stream: {streamStatus}
        </div>
        {copyMessage && (
          <div className="logo-sub" style={{ marginTop: 6 }}>
            {copyMessage}
          </div>
        )}
      </div>
    </>
  )
}

export default function App() {
  return (
    <wardexProvider>
      <LivewardexApp />
    </wardexProvider>
  )
}
