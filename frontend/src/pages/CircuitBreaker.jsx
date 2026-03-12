import { useState, useEffect } from 'react'
import { fireCircuitBreakerOnChain, unfreezeAgentOnChain } from '../hooks/useContracts'

export default function CircuitBreaker({ web3, agents, onFired }) {
  const [selectedAgent, setSelectedAgent] = useState('')
  const [reason, setReason] = useState('')
  const [firing, setFiring] = useState(false)
  const [unfreezing, setUnfreezing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [cbHistory, setCbHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Load circuit breaker history for selected agent
  useEffect(() => {
    if (!web3.isLive || !selectedAgent) { setCbHistory([]); return }
    let cancelled = false
    ;(async () => {
      setHistoryLoading(true)
      try {
        const history = await web3.contracts.darkAgent.getCircuitBreakerHistory(selectedAgent)
        if (!cancelled) {
          setCbHistory(history.map(h => ({
            timestamp: Number(h.timestamp),
            reason: h.reason,
            oldHash: h.oldAttestationHash,
            newHash: h.newAttestationHash,
          })))
        }
      } catch {
        if (!cancelled) setCbHistory([])
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [web3.isLive, web3.contracts, selectedAgent])

  const agent = agents.find(a => a.address === selectedAgent)
  const isFrozen = agent?.status === 'FROZEN'

  const handleFire = async () => {
    if (!selectedAgent) { setError('Select an agent'); return }
    if (!reason.trim()) { setError('Provide a reason for the circuit breaker'); return }
    setError(null); setFiring(true); setResult(null)
    try {
      const res = await fireCircuitBreakerOnChain(web3.contracts, selectedAgent, reason)
      setResult({ action: 'fired', ...res })
      onFired?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setFiring(false)
    }
  }

  const handleUnfreeze = async () => {
    if (!selectedAgent) return
    setError(null); setUnfreezing(true); setResult(null)
    try {
      const res = await unfreezeAgentOnChain(web3.contracts, selectedAgent)
      setResult({ action: 'unfrozen', ...res })
      onFired?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setUnfreezing(false)
    }
  }

  if (!web3.isLive) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="glass-card no-hover" style={{ textAlign: 'center', maxWidth: 480, padding: 'var(--space-2xl)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>⚡</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-md)' }}>Wallet Required</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
              Connect to Base Sepolia to access the emergency circuit breaker.
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
          <h2>Circuit Breaker</h2>
          <p>Emergency kill switch — freeze wallets and invalidate attestations instantly</p>
        </div>

        <div className="grid-2">
          {/* Control panel */}
          <div>
            <div className={`cb-panel ${isFrozen ? 'fired' : ''}`}>
              {/* Agent selector */}
              <div className="input-group" style={{ textAlign: 'left', marginBottom: 'var(--space-xl)' }}>
                <label>Select Agent</label>
                <select
                  className="input"
                  value={selectedAgent}
                  onChange={e => { setSelectedAgent(e.target.value); setResult(null); setError(null) }}
                >
                  <option value="">— Choose an agent —</option>
                  {agents.map(a => (
                    <option key={a.address} value={a.address}>
                      {a.ensName || a.address.slice(0, 10) + '...'} [{a.status}]
                    </option>
                  ))}
                </select>
              </div>

              {agent && (
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                  <span className={`badge ${isFrozen ? 'badge-frozen' : 'badge-active'}`}>
                    <span className="dot" />{agent.status}
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    {agent.address}
                  </div>
                </div>
              )}

              {/* Kill button */}
              <button
                className="kill-btn"
                onClick={handleFire}
                disabled={firing || !selectedAgent || isFrozen}
                style={{ opacity: (firing || !selectedAgent || isFrozen) ? 0.4 : 1 }}
              >
                <span className="icon">⚡</span>
                <span>{firing ? 'FIRING...' : isFrozen ? 'FROZEN' : 'KILL SWITCH'}</span>
              </button>

              {/* Reason input */}
              <div className="input-group" style={{ textAlign: 'left', marginTop: 'var(--space-xl)' }}>
                <label>Reason</label>
                <input
                  className="input input-mono"
                  placeholder="e.g. attestation tampered, unauthorized withdrawal"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  disabled={firing}
                />
              </div>

              {/* Unfreeze button */}
              {isFrozen && (
                <button
                  className="btn btn-brand"
                  style={{ width: '100%', marginTop: 'var(--space-md)' }}
                  onClick={handleUnfreeze}
                  disabled={unfreezing}
                >
                  {unfreezing ? '⏳ Unfreezing...' : '🔓 Unfreeze Agent'}
                </button>
              )}

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', color: 'var(--accent-red)', fontSize: '0.82rem', marginTop: 'var(--space-md)', textAlign: 'left' }}>
                  {error}
                </div>
              )}

              {result && (
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', color: 'var(--accent-emerald)', fontSize: '0.82rem', marginTop: 'var(--space-md)', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
                  <div>Action: {result.action}</div>
                  <div>Tx: <a href={`https://sepolia.basescan.org/tx/${result.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>{result.txHash.slice(0, 20)}...</a></div>
                  <div>Block: {result.blockNumber}</div>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          <div className="glass-card no-hover">
            <div className="card-header">
              <div className="card-title">📋 Circuit Breaker History</div>
            </div>

            {!selectedAgent ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                Select an agent to view history
              </div>
            ) : historyLoading ? (
              <div className="loading-spinner" />
            ) : cbHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                No circuit breaker events for this agent
              </div>
            ) : (
              <div className="code-window" style={{ border: 'none' }}>
                <div className="code-window-bar">
                  <span className="code-dot red" /><span className="code-dot yellow" /><span className="code-dot green" />
                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>cb-history</span>
                </div>
                <div className="code-window-body">
                  {cbHistory.map((ev, i) => (
                    <div key={i} className="line" style={{ animationDelay: `${i * 0.05}s`, flexDirection: 'column', gap: 2 }}>
                      <div>
                        <span className="error">[CB FIRED]</span>{' '}
                        <span className="timestamp">{new Date(ev.timestamp * 1000).toLocaleString()}</span>
                      </div>
                      <div><span className="muted">Reason:</span> <span>{ev.reason}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}