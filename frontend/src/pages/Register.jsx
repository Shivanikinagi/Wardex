import { useState } from 'react'
import { registerAgent } from '../hooks/useContracts'

const CAPABILITY_OPTIONS = [
  'yield-farming', 'token-swap', 'payment', 'lending', 'staking',
  'governance', 'nft-trading', 'bridging', 'data-oracle', 'analytics',
]

export default function Register({ web3, onRegistered, onNavigate }) {
  const [form, setForm] = useState({
    name: '',
    capabilities: [],
    maxPerTx: '0.5',
    maxPerDay: '5.0',
    alertThreshold: '1.0',
  })
  const [step, setStep] = useState(0) // 0=form, 1=registering, 2=done
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [txLogs, setTxLogs] = useState([])

  const toggleCap = (cap) => {
    setForm(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter(c => c !== cap)
        : [...prev.capabilities, cap],
    }))
  }

  const addLog = (msg, type = 'info') => setTxLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }])

  const handleRegister = async () => {
    if (!web3.isLive) { setError('Connect wallet first'); return }
    if (!form.name.trim()) { setError('Agent name is required'); return }
    if (form.capabilities.length === 0) { setError('Select at least one capability'); return }

    setError(null)
    setStep(1)
    setTxLogs([])

    try {
      addLog('Generating agent wallet...', 'info')
      addLog(`ENS: ${form.name}.darkagent.eth`, 'info')
      addLog(`Capabilities: ${form.capabilities.join(', ')}`, 'info')
      addLog('Submitting registerAgent transaction...', 'info')

      const res = await registerAgent(web3.contracts, {
        name: form.name,
        capabilities: form.capabilities,
        maxPerTx: form.maxPerTx,
        maxPerDay: form.maxPerDay,
        alertThreshold: form.alertThreshold,
      })

      addLog(`Agent registered! Tx: ${res.txHash.slice(0, 14)}...`, 'success')
      addLog(`Agent address: ${res.address}`, 'success')
      addLog(`Block: ${res.blockNumber}`, 'success')
      addLog('Granting capabilities on-chain...', 'info')
      addLog('Setting initial attestation...', 'info')
      addLog('All on-chain operations complete ✓', 'success')

      setResult(res)
      setStep(2)
      onRegistered?.()
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error')
      setError(err.message)
      setStep(0)
    }
  }

  if (!web3.isLive) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="glass-card no-hover" style={{ textAlign: 'center', maxWidth: 480, padding: 'var(--space-2xl)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>🤖</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-md)' }}>Wallet Required</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
              Connect MetaMask to Base Sepolia to register a new AI agent on-chain.
            </p>
            <button className="btn btn-brand" onClick={web3.connect} disabled={web3.connecting}>{web3.connecting ? '⏳ Connecting...' : 'Connect Wallet'}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="page-content">
        <div className="page-header">
          <h2>Register Agent</h2>
          <p>Deploy a new AI agent identity on-chain with capabilities and spending limits</p>
        </div>

        <div className="grid-2">
          {/* Form */}
          <div className="glass-card no-hover">
            {step === 2 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>✅</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-md)' }}>Agent Registered!</h3>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', wordBreak: 'break-all' }}>
                  <div style={{ marginBottom: 4 }}>Address: <span style={{ color: 'var(--brand-pink)' }}>{result.address}</span></div>
                  <div style={{ marginBottom: 4 }}>ENS: <span style={{ color: 'var(--accent-emerald)' }}>{result.ensName}</span></div>
                  <div>Tx: <a href={`https://sepolia.basescan.org/tx/${result.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>{result.txHash.slice(0, 20)}...</a></div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
                  <button className="btn btn-brand btn-sm" onClick={() => { setStep(0); setForm({ name: '', capabilities: [], maxPerTx: '0.5', maxPerDay: '5.0', alertThreshold: '1.0' }); setResult(null); setTxLogs([]) }}>
                    Register Another
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => onNavigate('dashboard')}>View Dashboard</button>
                </div>
              </div>
            ) : (
              <>
                <div className="card-header">
                  <div className="card-title">🤖 Agent Configuration</div>
                </div>

                <div className="input-group">
                  <label>Agent Name</label>
                  <input
                    className="input"
                    placeholder="e.g. elsa, trading-bot, data-oracle"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    disabled={step === 1}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Will be registered as <span style={{ color: 'var(--brand-pink)' }}>{form.name || '...'}.darkagent.eth</span>
                  </div>
                </div>

                <div className="input-group">
                  <label>Capabilities</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                    {CAPABILITY_OPTIONS.map(cap => (
                      <button
                        key={cap}
                        className={`cap-tag`}
                        style={{
                          cursor: step === 1 ? 'not-allowed' : 'pointer',
                          background: form.capabilities.includes(cap) ? 'rgba(233,30,140,0.2)' : 'rgba(233,30,140,0.05)',
                          borderColor: form.capabilities.includes(cap) ? 'var(--brand-magenta)' : 'rgba(233,30,140,0.15)',
                          color: form.capabilities.includes(cap) ? 'var(--brand-pink)' : 'var(--text-accent)',
                        }}
                        onClick={() => step !== 1 && toggleCap(cap)}
                      >
                        {cap}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="input-group">
                    <label>Max per Tx (ETH)</label>
                    <input className="input input-mono" type="number" step="0.1" min="0"
                      value={form.maxPerTx} onChange={e => setForm({...form, maxPerTx: e.target.value})} disabled={step === 1} />
                  </div>
                  <div className="input-group">
                    <label>Max per Day (ETH)</label>
                    <input className="input input-mono" type="number" step="0.1" min="0"
                      value={form.maxPerDay} onChange={e => setForm({...form, maxPerDay: e.target.value})} disabled={step === 1} />
                  </div>
                  <div className="input-group">
                    <label>Alert Threshold (ETH)</label>
                    <input className="input input-mono" type="number" step="0.1" min="0"
                      value={form.alertThreshold} onChange={e => setForm({...form, alertThreshold: e.target.value})} disabled={step === 1} />
                  </div>
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: 'var(--space-md)' }}>
                    {error}
                  </div>
                )}

                <button
                  className="btn btn-brand"
                  style={{ width: '100%', marginTop: 'var(--space-sm)' }}
                  onClick={handleRegister}
                  disabled={step === 1}
                >
                  {step === 1 ? '⏳ Registering on-chain...' : '🚀 Register Agent On-Chain'}
                </button>
              </>
            )}
          </div>

          {/* Transaction log */}
          <div className="code-window" style={{ alignSelf: 'start' }}>
            <div className="code-window-bar">
              <span className="code-dot red" /><span className="code-dot yellow" /><span className="code-dot green" />
              <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>transaction-log</span>
            </div>
            <div className="code-window-body" style={{ minHeight: 340 }}>
              {txLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Configure your agent and submit to see live transaction logs...
                </div>
              ) : (
                txLogs.map((log, i) => (
                  <div key={i} className="line" style={{ animationDelay: `${i * 0.05}s` }}>
                    <span className="timestamp">{log.time}</span>
                    <span className={log.type}>{log.msg}</span>
                  </div>
                ))
              )}
              {step === 1 && <div className="loading-spinner" style={{ marginTop: 'var(--space-md)' }} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}