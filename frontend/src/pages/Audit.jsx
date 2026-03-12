import { useState, useEffect } from 'react'
import { queryComplianceOnChain, submitProofOnChain } from '../hooks/useContracts'

const PROOF_TYPES = [
  { id: 'spending_limit', label: 'Spending Limit', desc: 'Verify agent stays within daily spending budget' },
  { id: 'capability_check', label: 'Capability Check', desc: 'Verify agent performs only authorized actions' },
  { id: 'attestation_valid', label: 'Attestation Valid', desc: 'Verify TEE attestation integrity' },
  { id: 'identity_check', label: 'Identity Check', desc: 'Verify agent ENS identity and ownership' },
  { id: 'ens_rule_compliance', label: 'ENS Rule Compliance', desc: 'Prove transaction followed ENS rules without revealing them' },
  { id: 'slippage_check', label: 'Slippage Check', desc: 'Prove swap slippage was within ENS-defined tolerance' },
  { id: 'signature_auth', label: 'Signature Auth', desc: 'Prove action was authorized by ENS owner signature' },
]

export default function Audit({ web3, agents }) {
  const [selectedAgent, setSelectedAgent] = useState('')
  const [compliance, setCompliance] = useState(null)
  const [proofs, setProofs] = useState([])
  const [compLoading, setCompLoading] = useState(false)
  const [proofsLoading, setProofsLoading] = useState(false)
  const [selectedProofType, setSelectedProofType] = useState('spending_limit')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const [error, setError] = useState(null)

  // Load compliance and proofs when agent is selected
  useEffect(() => {
    if (!web3.isLive || !selectedAgent) { setCompliance(null); setProofs([]); return }
    let cancelled = false

    ;(async () => {
      setCompLoading(true)
      setProofsLoading(true)
      try {
        const [comp, agentProofs] = await Promise.all([
          queryComplianceOnChain(web3.contracts, selectedAgent),
          web3.contracts.verifier.getAllProofs(selectedAgent),
        ])
        if (!cancelled) {
          setCompliance(comp)
          setProofs(agentProofs.map(p => ({
            proofHash: p.proofHash,
            proofType: p.proofType,
            verified: p.verified,
            timestamp: Number(p.timestamp),
            blockNumber: Number(p.blockNumber),
          })).reverse())
        }
      } catch (err) {
        console.error('Audit load error:', err)
        if (!cancelled) { setCompliance(null); setProofs([]) }
      } finally {
        if (!cancelled) { setCompLoading(false); setProofsLoading(false) }
      }
    })()

    return () => { cancelled = true }
  }, [web3.isLive, web3.contracts, selectedAgent])

  const handleSubmitProof = async () => {
    if (!selectedAgent) { setError('Select an agent'); return }
    setError(null); setSubmitting(true); setSubmitResult(null)
    try {
      const res = await submitProofOnChain(web3.contracts, selectedAgent, selectedProofType, [0, 0])
      setSubmitResult(res)
      // Reload compliance data
      const [comp, agentProofs] = await Promise.all([
        queryComplianceOnChain(web3.contracts, selectedAgent),
        web3.contracts.verifier.getAllProofs(selectedAgent),
      ])
      setCompliance(comp)
      setProofs(agentProofs.map(p => ({
        proofHash: p.proofHash,
        proofType: p.proofType,
        verified: p.verified,
        timestamp: Number(p.timestamp),
        blockNumber: Number(p.blockNumber),
      })).reverse())
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!web3.isLive) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="glass-card no-hover" style={{ textAlign: 'center', maxWidth: 480, padding: 'var(--space-2xl)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>🔍</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-md)' }}>Wallet Required</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
              Connect to Base Sepolia to audit agent compliance and view zero-knowledge proofs.
            </p>
            <button className="btn btn-brand" onClick={web3.connect} disabled={web3.connecting}>{web3.connecting ? '⏳ Connecting...' : 'Connect Wallet'}</button>
          </div>
        </div>
      </div>
    )
  }

  const agent = agents.find(a => a.address === selectedAgent)

  return (
    <div className="page-shell">
      <div className="page-content">
        <div className="page-header">
          <h2>Compliance Audit</h2>
          <p>Query ZK compliance status and submit verification proofs via the Verifier contract</p>
        </div>

        {/* Agent Selector */}
        <div className="glass-card no-hover" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Select Agent to Audit</label>
              <select className="input" value={selectedAgent} onChange={e => { setSelectedAgent(e.target.value); setSubmitResult(null); setError(null) }}>
                <option value="">— Choose an agent —</option>
                {agents.map(a => (
                  <option key={a.address} value={a.address}>
                    {a.ensName || a.address.slice(0, 10) + '...'} [{a.status}]
                  </option>
                ))}
              </select>
            </div>
            {agent && (
              <span className={`badge ${agent.status === 'ACTIVE' ? 'badge-active' : 'badge-frozen'}`} style={{ marginBottom: 2 }}>
                <span className="dot" />{agent.status}
              </span>
            )}
          </div>
        </div>

        {selectedAgent && (
          <div className="grid-2">
            {/* Compliance status + Submit proof */}
            <div>
              {/* Compliance verdict */}
              <div className="glass-card no-hover" style={{ marginBottom: 'var(--space-lg)' }}>
                {compLoading ? (
                  <div className="loading-spinner" />
                ) : compliance ? (
                  <div className="verdict-display">
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Compliance Status</div>
                    <div className={`verdict ${compliance.compliant ? 'yes' : 'no'}`}>
                      {compliance.compliant ? 'COMPLIANT ✓' : 'NON-COMPLIANT ✗'}
                    </div>
                    <div className="stats-grid" style={{ marginBottom: 0 }}>
                      <div className="stat-card emerald" style={{ padding: 'var(--space-md)' }}>
                        <div className="stat-label">Verified</div>
                        <div className="stat-value emerald" style={{ fontSize: '1.5rem' }}>{compliance.verifiedProofs}</div>
                      </div>
                      <div className="stat-card red" style={{ padding: 'var(--space-md)' }}>
                        <div className="stat-label">Failed</div>
                        <div className="stat-value red" style={{ fontSize: '1.5rem' }}>{compliance.failedProofs}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                    No compliance data available
                  </div>
                )}
              </div>

              {/* Submit proof */}
              <div className="glass-card no-hover">
                <div className="card-header">
                  <div className="card-title">🔐 Submit ZK Proof</div>
                </div>
                <div className="input-group">
                  <label>Proof Type</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {PROOF_TYPES.map(pt => (
                      <label key={pt.id} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                        padding: 'var(--space-sm) var(--space-md)',
                        background: selectedProofType === pt.id ? 'rgba(233,30,140,0.08)' : 'var(--bg-glass)',
                        border: `1px solid ${selectedProofType === pt.id ? 'var(--border-active)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
                      }}>
                        <input type="radio" name="proofType" value={pt.id} checked={selectedProofType === pt.id}
                          onChange={e => setSelectedProofType(e.target.value)} style={{ accentColor: 'var(--brand-magenta)' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{pt.label}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button className="btn btn-brand" style={{ width: '100%' }} onClick={handleSubmitProof} disabled={submitting}>
                  {submitting ? '⏳ Submitting proof...' : '🔐 Submit & Verify Proof'}
                </button>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', color: 'var(--accent-red)', fontSize: '0.82rem', marginTop: 'var(--space-md)' }}>
                    {error}
                  </div>
                )}
                {submitResult && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', fontSize: '0.82rem', marginTop: 'var(--space-md)', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                    Proof submitted! Tx: <a href={`https://sepolia.basescan.org/tx/${submitResult.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>{submitResult.txHash.slice(0, 20)}...</a>
                  </div>
                )}
              </div>
            </div>

            {/* Proof history */}
            <div className="glass-card no-hover" style={{ maxHeight: 700, overflowY: 'auto' }}>
              <div className="card-header">
                <div className="card-title">📜 Proof History</div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{proofs.length} proofs</span>
              </div>

              {proofsLoading ? (
                <div className="loading-spinner" />
              ) : proofs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                  No proofs submitted for this agent
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Block</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proofs.map((p, i) => (
                        <tr key={i}>
                          <td><span className="cap-tag">{p.proofType}</span></td>
                          <td>
                            <span className={`badge ${p.verified ? 'badge-active' : 'badge-frozen'}`}>
                              <span className="dot" />{p.verified ? 'Verified' : 'Failed'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>#{p.blockNumber}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(p.timestamp * 1000).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}