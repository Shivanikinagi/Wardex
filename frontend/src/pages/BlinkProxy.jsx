import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  FileCheck2,
  Radio,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
} from 'lucide-react'
import { useBlinkProxyDemo } from '../hooks/useBlinkProxyDemo'

function formatTime(value) {
  if (!value) return 'Never'
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function toCsv(value) {
  return Array.isArray(value) ? value.join(', ') : String(value || '')
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function shortHash(value) {
  if (!value) return '-'
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}

function decisionTone(decision) {
  if (decision === 'block') return 'border-red-500/20 bg-red-500/10 text-red-200'
  if (decision === 'auto-downsize') return 'border-amber-400/20 bg-amber-400/10 text-amber-200'
  if (decision === 'allow-with-warning') return 'border-vault-blue/20 bg-vault-blue/10 text-vault-blue'
  return 'border-vault-green/20 bg-vault-green/10 text-vault-green'
}

function statusIcon(decision) {
  if (decision === 'block') return ShieldX
  if (decision === 'auto-downsize') return AlertTriangle
  if (decision === 'allow-with-warning') return ShieldAlert
  return ShieldCheck
}

export default function BlinkProxy() {
  const {
    apiBase,
    state,
    loading,
    error,
    busy,
    streamStatus,
    lastEvent,
    refresh,
    analyzeBlinkUrl,
    executeBlinkUrl,
    updatePolicy,
    syncWatcher,
    resetDemo,
    policiesByEns,
  } = useBlinkProxyDemo()

  const defaults = state?.defaults || {
    ensName: 'alice.eth',
    blinkUrl: '',
  }

  const [selectedEns, setSelectedEns] = useState('alice.eth')
  const [blinkUrl, setBlinkUrl] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [executionResult, setExecutionResult] = useState(null)
  const [statusText, setStatusText] = useState(
    'Paste a trading Blink URL to score the risk, explain the verdict, and optionally execute the safe version.'
  )
  const [policyForm, setPolicyForm] = useState({
    persona: 'balanced',
    maxTradeUsd: 500,
    maxSlippageBps: 125,
    minLiquidityUsd: 250000,
    blockMemeCoins: true,
    allowTopTokensOnly: false,
    autoDownsize: true,
    trustedProtocols: 'uniswap, jupiter, aave, raydium',
    twitterLimit: 300,
  })

  const selectedPolicy = policiesByEns[selectedEns]
  const samples = state?.samples || []
  const personas = state?.personas || {}
  const activity = state?.activity || []

  useEffect(() => {
    if (defaults.ensName) {
      setSelectedEns((current) => current || defaults.ensName)
    }
    if (defaults.blinkUrl) {
      setBlinkUrl((current) => current || defaults.blinkUrl)
    }
  }, [defaults])

  useEffect(() => {
    if (!selectedPolicy?.stored) return
    const stored = selectedPolicy.stored
    setPolicyForm({
      persona: stored.persona,
      maxTradeUsd: stored.maxTradeUsd,
      maxSlippageBps: stored.maxSlippageBps,
      minLiquidityUsd: stored.minLiquidityUsd,
      blockMemeCoins: stored.blockMemeCoins,
      allowTopTokensOnly: stored.allowTopTokensOnly,
      autoDownsize: stored.autoDownsize,
      trustedProtocols: toCsv(stored.trustedProtocols),
      twitterLimit: stored.sourceLimits?.twitter ?? 300,
    })
  }, [selectedPolicy])

  const latestProof = useMemo(() => {
    if (executionResult?.proof) return executionResult.proof
    if (analysisResult?.proof) return analysisResult.proof
    return state?.proofs?.[0] || null
  }, [analysisResult, executionResult, state])

  const parsedBlink = analysisResult?.parsedBlink || executionResult?.parsedBlink || null
  const analysis = analysisResult?.analysis || executionResult?.analysis || null
  const canExecute = Boolean(analysis && analysis.decision !== 'block')
  const CurrentDecisionIcon = statusIcon(analysis?.decision)

  async function loadSample(sample) {
    setBlinkUrl(sample.url)
    setAnalysisResult(null)
    setExecutionResult(null)
    setStatusText(`Loaded ${sample.label}. Click Analyze Blink to inspect the live verdict.`)
  }

  async function runAnalysis() {
    try {
      setStatusText('wardex is parsing the URL, tagging the source, and matching the trade against your live policy...')
      const result = await analyzeBlinkUrl({ url: blinkUrl, ensName: selectedEns })
      setAnalysisResult(result)
      setExecutionResult(null)
      setStatusText(result.analysis.summary)
    } catch (err) {
      setAnalysisResult(err.payload || null)
      setExecutionResult(null)
      setStatusText(err.message)
    }
  }

  async function runExecution() {
    try {
      setStatusText('wardex is forwarding only the policy-approved version of this Blink...')
      const result = await executeBlinkUrl({ url: blinkUrl, ensName: selectedEns })
      setExecutionResult(result)
      setAnalysisResult(result)
      setStatusText(result.analysis.summary)
    } catch (err) {
      setExecutionResult(err.payload || null)
      setAnalysisResult(err.payload || analysisResult)
      setStatusText(err.message)
    }
  }

  function applyPersona(personaKey) {
    const preset = personas[personaKey]
    if (!preset) return

    setPolicyForm({
      persona: personaKey,
      maxTradeUsd: preset.maxTradeUsd,
      maxSlippageBps: preset.maxSlippageBps,
      minLiquidityUsd: preset.minLiquidityUsd,
      blockMemeCoins: preset.blockMemeCoins,
      allowTopTokensOnly: preset.allowTopTokensOnly,
      autoDownsize: preset.autoDownsize,
      trustedProtocols: toCsv(preset.trustedProtocols),
      twitterLimit: preset.sourceLimits.twitter,
    })
  }

  async function savePolicy() {
    await updatePolicy(selectedEns, {
      persona: policyForm.persona,
      maxTradeUsd: Number(policyForm.maxTradeUsd),
      maxSlippageBps: Number(policyForm.maxSlippageBps),
      minLiquidityUsd: Number(policyForm.minLiquidityUsd),
      blockMemeCoins: policyForm.blockMemeCoins,
      allowTopTokensOnly: policyForm.allowTopTokensOnly,
      autoDownsize: policyForm.autoDownsize,
      trustedProtocols: parseCsv(policyForm.trustedProtocols),
      sourceLimits: {
        twitter: Number(policyForm.twitterLimit),
      },
    })
    setStatusText('Policy saved. Run Sync Watcher to make the next Blink use the updated rules immediately.')
  }

  async function handleReset() {
    await resetDemo()
    setAnalysisResult(null)
    setExecutionResult(null)
    setStatusText('Demo reset. Paste a new Blink or load one of the sample URLs.')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-vault-slate/20 bg-[#1a1d23]/70 p-8 backdrop-blur-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="text-sm uppercase tracking-[0.3em] text-vault-slate">wardex</div>
            <h2 className="mt-3 text-4xl font-bold text-vault-text">Not every Blink deserves your wallet.</h2>
            <p className="mt-3 text-base text-vault-slate">
              wardex is a personal firewall for trading Blinks. It analyzes any pasted trade URL in real time, scores the risk,
              explains the verdict, and only forwards a version that matches the user&apos;s policy.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TopStat label="Live Stream" value={streamStatus} detail={`${state?.live?.subscribers || 0} subscribers`} />
            <TopStat
              label="Proof Signer"
              value={shortHash(state?.proofSigner?.signerAddress)}
              detail={latestProof?.verified ? 'Latest proof verified' : 'Waiting for first proof'}
            />
            <TopStat label="Last Event" value={lastEvent?.type || 'idle'} detail={formatTime(lastEvent?.at)} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-vault-text">Blink Analyzer</h3>
                <p className="mt-1 text-sm text-vault-slate">
                  Paste a shareable trading URL from X, Telegram, AI bots, or private groups and get a source-aware verdict.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => refresh()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-vault-slate/20 bg-vault-bg/60 px-4 py-3 text-sm font-medium text-vault-text transition hover:bg-vault-slate/10"
                >
                  <RefreshCcw className="h-4 w-4" /> Refresh
                </button>
                <button
                  onClick={handleReset}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-vault-blue/20 bg-vault-blue/10 px-4 py-3 text-sm font-medium text-vault-blue transition hover:bg-vault-blue/15"
                >
                  <Sparkles className="h-4 w-4" /> Reset Demo
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
              <Field label="Policy Profile">
                <select value={selectedEns} onChange={(event) => setSelectedEns(event.target.value)} className="input-shell">
                  {(state?.policies || []).map((entry) => (
                    <option key={entry.ensName} value={entry.ensName}>
                      {entry.ensName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Trading Blink URL">
                <textarea
                  rows={4}
                  value={blinkUrl}
                  onChange={(event) => setBlinkUrl(event.target.value)}
                  placeholder="https://x.com/... or https://ai.wardex.trade/..."
                  className="input-shell resize-none"
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => loadSample(sample)}
                  className="rounded-full border border-vault-slate/20 bg-black/20 px-4 py-2 text-sm text-vault-text transition hover:border-vault-green/30 hover:text-vault-green"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={runAnalysis}
                disabled={busy || !blinkUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-vault-green px-5 py-3 font-semibold text-black transition hover:bg-vault-green/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Activity className="h-4 w-4" /> Analyze Blink
              </button>
              <button
                onClick={runExecution}
                disabled={busy || !canExecute}
                className="inline-flex items-center gap-2 rounded-xl bg-vault-blue px-5 py-3 font-semibold text-white transition hover:bg-vault-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" /> Execute Safe Version
              </button>
              <button
                onClick={() => syncWatcher()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-vault-green/20 bg-vault-green/10 px-4 py-3 text-sm font-medium text-vault-green transition hover:bg-vault-green/15"
              >
                <Radio className="h-4 w-4" /> Sync Watcher
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-vault-slate/20 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-vault-slate">Live Status</div>
              <p className="mt-2 text-sm text-vault-text">{statusText}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-vault-text">Analysis Result</h3>
                <p className="mt-1 text-sm text-vault-slate">The risk decision is derived from the URL payload, source host, and your current policy.</p>
              </div>
              {analysis && (
                <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${decisionTone(analysis.decision)}`}>
                  {analysis.label} - {analysis.decision}
                </span>
              )}
            </div>

            {parsedBlink && analysis ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InfoTile label="Source" value={`${parsedBlink.sourceCategory} - ${parsedBlink.sourceName}`} />
                  <InfoTile label="Protocol" value={parsedBlink.protocol} />
                  <InfoTile label="Trade" value={`${parsedBlink.tokenIn} -> ${parsedBlink.tokenOut}`} />
                  <InfoTile label="Requested Size" value={formatCurrency(parsedBlink.amountUsd)} />
                  <InfoTile label="Execution Size" value={formatCurrency(analysis.executionAmountUsd)} />
                  <InfoTile label="Risk Score" value={`${analysis.riskScore}/100`} />
                  <InfoTile label="Liquidity" value={formatCurrency(parsedBlink.liquidityUsd)} />
                  <InfoTile label="Slippage" value={`${parsedBlink.slippageBps} bps`} />
                  <InfoTile label="Source Limit" value={formatCurrency(analysis.sourceLimitUsd)} />
                </div>

                <div className="rounded-2xl border border-vault-slate/20 bg-black/20 p-4">
                  <div className="flex items-center gap-3">
                    <CurrentDecisionIcon className="h-5 w-5 text-vault-text" />
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-vault-slate">Decision</div>
                      <div className="mt-1 text-lg font-semibold text-vault-text">{analysis.summary}</div>
                    </div>
                  </div>
                </div>

                {analysis.explanation?.length > 0 && (
                  <div className="space-y-2">
                    {analysis.explanation.map((item) => (
                      <div key={item} className="rounded-xl border border-vault-slate/20 bg-black/20 px-4 py-3 text-sm text-vault-text">
                        {item}
                      </div>
                    ))}
                  </div>
                )}

                {analysisResult?.rewrittenBlinkUrl && analysisResult.rewrittenBlinkUrl !== blinkUrl && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-amber-200">Rewritten Safe Blink</div>
                    <div className="mt-2 break-all font-mono text-sm text-amber-50">{analysisResult.rewrittenBlinkUrl}</div>
                  </div>
                )}

                {executionResult?.execution && (
                  <div className="rounded-2xl border border-vault-green/20 bg-vault-green/10 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-vault-green">Execution Proof</div>
                    <div className="mt-2 text-sm text-vault-text">Stealth address: {executionResult.execution.stealthAddress}</div>
                    <div className="mt-1 text-sm text-vault-text">Transaction: {executionResult.execution.txid}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-vault-slate/20 bg-black/20 px-4 py-8 text-sm text-vault-slate">
                Paste a Blink URL and click <strong className="text-vault-text">Analyze Blink</strong>.
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-vault-text">Policy Setup</h3>
                <p className="mt-1 text-sm text-vault-slate">Set limits for Twitter.</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  selectedPolicy?.pendingSync
                    ? 'border border-amber-400/20 bg-amber-400/10 text-amber-300'
                    : 'border border-vault-green/20 bg-vault-green/10 text-vault-green'
                }`}
              >
                {selectedPolicy?.pendingSync ? 'Pending sync' : 'Live policy'}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {Object.keys(personas).map((personaKey) => (
                <button
                  key={personaKey}
                  onClick={() => applyPersona(personaKey)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    policyForm.persona === personaKey
                      ? 'border border-vault-green/20 bg-vault-green/10 text-vault-green'
                      : 'border border-vault-slate/20 bg-black/20 text-vault-text hover:border-vault-green/20 hover:text-vault-green'
                  }`}
                >
                  {personaKey}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Max Trade (USD)">
                <input value={policyForm.maxTradeUsd} onChange={(event) => setPolicyForm((current) => ({ ...current, maxTradeUsd: event.target.value }))} className="input-shell" />
              </Field>
              <Field label="Max Slippage (bps)">
                <input value={policyForm.maxSlippageBps} onChange={(event) => setPolicyForm((current) => ({ ...current, maxSlippageBps: event.target.value }))} className="input-shell" />
              </Field>
              <Field label="Min Liquidity (USD)">
                <input value={policyForm.minLiquidityUsd} onChange={(event) => setPolicyForm((current) => ({ ...current, minLiquidityUsd: event.target.value }))} className="input-shell" />
              </Field>
              <Field label="Trusted Protocols">
                <input value={policyForm.trustedProtocols} onChange={(event) => setPolicyForm((current) => ({ ...current, trustedProtocols: event.target.value }))} className="input-shell" />
              </Field>
<Field label="Twitter Limit">
                  <input value={policyForm.twitterLimit} onChange={(event) => setPolicyForm((current) => ({ ...current, twitterLimit: event.target.value }))} className="input-shell" />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-vault-slate">
              <ToggleChip label="Block meme coins" active={policyForm.blockMemeCoins} onClick={() => setPolicyForm((current) => ({ ...current, blockMemeCoins: !current.blockMemeCoins }))} />
              <ToggleChip label="Top tokens only" active={policyForm.allowTopTokensOnly} onClick={() => setPolicyForm((current) => ({ ...current, allowTopTokensOnly: !current.allowTopTokensOnly }))} />
              <ToggleChip label="Auto-downsize" active={policyForm.autoDownsize} onClick={() => setPolicyForm((current) => ({ ...current, autoDownsize: !current.autoDownsize }))} />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={savePolicy}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-vault-blue px-5 py-3 font-semibold text-white transition hover:bg-vault-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" /> Save Policy
              </button>
              <div className="text-sm text-vault-slate">
                Current persona: <span className="text-vault-text">{selectedPolicy?.synced?.persona || policyForm.persona}</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-vault-text">Proof Receipt</h3>
                <p className="mt-1 text-sm text-vault-slate">Every analysis and execution emits a signed proof receipt that can be verified.</p>
              </div>
              {latestProof?.verdict === 'blocked' ? (
                <ShieldX className="h-5 w-5 text-red-300" />
              ) : (
                <FileCheck2 className="h-5 w-5 text-vault-green" />
              )}
            </div>

            {latestProof ? (
              <div className="mt-5 space-y-3">
                <ProofRow label="Proof ID" value={latestProof.id} />
                <ProofRow label="Verdict" value={latestProof.verdict} />
                <ProofRow label="Receipt Hash" value={latestProof.receiptHash} />
                <ProofRow label="Signer" value={latestProof.signerAddress} />
                <ProofRow label="Signature" value={latestProof.signature} />
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-vault-slate/20 bg-black/20 px-4 py-8 text-sm text-vault-slate">No proof yet.</div>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-vault-text">Activity Feed</h3>
            <p className="mt-1 text-sm text-vault-slate">
              Live events stream from <code className="font-mono text-vault-text">{`${apiBase}/api/events`}</code>.
            </p>
          </div>
          <span className="text-sm text-vault-slate">{activity.length} events</span>
        </div>

        <div className="mt-5 space-y-3">
          {activity.slice(0, 10).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-vault-slate/20 bg-black/20 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-semibold text-vault-text">
                  {entry.type} - {entry.sourceName || entry.ensName || 'system'}
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-vault-slate">{entry.status}</div>
              </div>
              <div className="mt-2 text-sm text-vault-slate">
                {entry.protocol ? `${entry.protocol} - ${formatCurrency(entry.amountUsd || 0)}` : 'System event'}
              </div>
              {entry.reason && <div className="mt-2 text-sm text-vault-text">{entry.reason}</div>}
              <div className="mt-2 text-xs text-vault-slate">{formatTime(entry.createdAt)}</div>
            </div>
          ))}
          {activity.length === 0 && !loading && (
            <div className="rounded-xl border border-vault-slate/20 bg-black/20 px-4 py-8 text-sm text-vault-slate">Waiting for live activity.</div>
          )}
        </div>
      </section>

      {(error || loading) && (
        <div className="rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 p-4 text-sm text-vault-slate">
          {loading ? 'Connecting to the Blink proxy...' : error}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-vault-slate">{label}</span>
      {children}
    </label>
  )
}

function TopStat({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-vault-slate/20 bg-black/20 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.2em] text-vault-slate">{label}</div>
      <div className="mt-2 text-lg font-semibold text-vault-text">{value}</div>
      <div className="mt-1 text-sm text-vault-slate">{detail}</div>
    </div>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-vault-slate/20 bg-black/20 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-vault-slate">{label}</div>
      <div className="mt-2 text-sm font-semibold text-vault-text">{value}</div>
    </div>
  )
}

function ToggleChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 transition ${
        active
          ? 'border border-vault-green/20 bg-vault-green/10 text-vault-green'
          : 'border border-vault-slate/20 bg-black/20 text-vault-slate'
      }`}
    >
      {label}
    </button>
  )
}

function ProofRow({ label, value }) {
  return (
    <div className="rounded-xl border border-vault-slate/20 bg-black/20 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-vault-slate">{label}</div>
      <div className="mt-2 break-all font-mono text-sm text-vault-text">{value}</div>
    </div>
  )
}
