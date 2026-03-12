import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

export default function Dashboard({ web3, agents, stats, loading, onRefresh, onNavigate }) {
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [slippageStats, setSlippageStats] = useState(null)
  const [sigStats, setSigStats] = useState(null)

  // Load recent on-chain events
  useEffect(() => {
    if (!web3.isLive) return
    let cancelled = false
    ;(async () => {
      setEventsLoading(true)
      try {
        const currentBlock = await web3.provider.getBlockNumber()
        const fromBlock = Math.max(0, currentBlock - 5000)

        const queries = [
          web3.contracts.darkAgent.queryFilter(web3.contracts.darkAgent.filters.AgentRegistered(), fromBlock),
          web3.contracts.darkAgent.queryFilter(web3.contracts.darkAgent.filters.CircuitBreakerFired(), fromBlock),
          web3.contracts.darkAgent.queryFilter(web3.contracts.darkAgent.filters.ComplianceProofPosted(), fromBlock),
        ]

        // Query new contract events if available
        if (web3.contracts.slippageGuard) {
          queries.push(web3.contracts.slippageGuard.queryFilter(web3.contracts.slippageGuard.filters.SlippageViolationDetected(), fromBlock))
        }
        if (web3.contracts.signatureVerifier) {
          queries.push(web3.contracts.signatureVerifier.queryFilter(web3.contracts.signatureVerifier.filters.AuthorizationVerified(), fromBlock))
        }

        const results = await Promise.all(queries)
        const [regEvents, cbEvents, proofEvents] = results

        const all = [
          ...regEvents.map(e => ({ type: 'register', agent: e.args[0], name: e.args[2], block: e.blockNumber, tx: e.transactionHash })),
          ...cbEvents.map(e => ({ type: 'circuit-breaker', agent: e.args[0], reason: e.args[1], block: e.blockNumber, tx: e.transactionHash })),
          ...proofEvents.map(e => ({ type: 'proof', agent: e.args[0], proofType: e.args[2], verified: e.args[3], block: e.blockNumber, tx: e.transactionHash })),
        ]

        // Add slippage violation events if present
        if (results[3]) {
          all.push(...results[3].map(e => ({ type: 'slippage-violation', agent: e.args[0], block: e.blockNumber, tx: e.transactionHash })))
        }

        // Add signature auth events if present
        if (results[4]) {
          all.push(...results[4].map(e => ({ type: 'sig-verified', agent: e.args[0], action: e.args[2], block: e.blockNumber, tx: e.transactionHash })))
        }

        all.sort((a, b) => b.block - a.block)

        if (!cancelled) setEvents(all.slice(0, 30))

        // Load stats from new contracts
        if (web3.contracts.slippageGuard) {
          try {
            const ss = await web3.contracts.slippageGuard.getStats()
            if (!cancelled) setSlippageStats({ totalSwaps: Number(ss[0]), totalViolations: Number(ss[1]), successRate: Number(ss[2]) })
          } catch { /* contract may not have data yet */ }
        }
        if (web3.contracts.signatureVerifier) {
          try {
            const sigS = await web3.contracts.signatureVerifier.getStats()
            if (!cancelled) setSigStats({ totalVerified: Number(sigS[0]), totalFailed: Number(sigS[1]), totalExpired: Number(sigS[2]) })
          } catch { /* contract may not have data yet */ }
        }
      } catch (err) {
        console.error('Error loading events:', err)
      } finally {
        if (!cancelled) setEventsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [web3.isLive, web3.provider, web3.contracts])

  if (!web3.isLive) {
    return (
      <div className="page-shell">
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="glass-card no-hover" style={{ textAlign: 'center', maxWidth: 480, padding: 'var(--space-2xl)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>🔒</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-md)' }}>Connect Your Wallet</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
              Connect MetaMask to Base Sepolia to view your registered agents, on-chain events, and compliance data.
            </p>
            <button className="btn btn-brand" onClick={web3.connect} disabled={web3.connecting}>{web3.connecting ? '⏳ Connecting...' : 'Connect to Base Sepolia'}</button>
          </div>
        </div>
      </div>
    )
  }

  const addr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`

  return (
    <div className="page-shell">
      <div className="page-content">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Dashboard</h2>
            <p>Real-time overview of all registered agents and on-chain events</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onRefresh} disabled={loading}>
            {loading ? '↻ Loading...' : '↻ Refresh'}
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-grid stagger">
            <div className="stat-card brand">
              <div className="stat-label">Total Agents</div>
              <div className="stat-value brand">{stats.totalAgents}</div>
              <div className="stat-subtitle">registered on-chain</div>
            </div>
            <div className="stat-card emerald">
              <div className="stat-label">Active</div>
              <div className="stat-value emerald">{stats.activeAgents}</div>
              <div className="stat-subtitle">currently operating</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">Frozen</div>
              <div className="stat-value red">{stats.frozenAgents}</div>
              <div className="stat-subtitle">circuit breaker fired</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-label">CB Events</div>
              <div className="stat-value cyan">{stats.totalCBEvents}</div>
              <div className="stat-subtitle">total emergency kills</div>
            </div>
          </div>
        )}

        <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
          {/* Agents list */}
          <div className="glass-card no-hover" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <div className="card-header">
              <div className="card-title">🤖 Registered Agents</div>
              <button className="btn btn-brand btn-sm" onClick={() => onNavigate('register')}>+ Register</button>
            </div>

            {loading ? (
              <div className="loading-spinner" />
            ) : agents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>🔍</div>
                <p>No agents registered yet</p>
                <button className="btn btn-brand btn-sm" style={{ marginTop: 'var(--space-md)' }} onClick={() => onNavigate('register')}>
                  Register First Agent
                </button>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {agents.map(agent => (
                  <div key={agent.address} className="agent-card" style={{ padding: 'var(--space-md)' }}>
                    <div className="agent-header">
                      <div>
                        <div className="agent-name">{agent.ensName || addr(agent.address)}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {addr(agent.address)}
                        </div>
                      </div>
                      <span className={`badge ${agent.status === 'ACTIVE' ? 'badge-active' : 'badge-frozen'}`}>
                        <span className="dot" />{agent.status}
                      </span>
                    </div>
                    <div className="capabilities">
                      {agent.capabilities.map(c => <span key={c} className="cap-tag">{c}</span>)}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-xl)', marginTop: 'var(--space-sm)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Rep: {agent.reputationScore}</span>
                      <span>Max/Tx: {agent.maxPerTx} ETH</span>
                      <span>Max/Day: {agent.maxPerDay} ETH</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event log */}
          <div className="glass-card no-hover" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <div className="card-header">
              <div className="card-title">📡 On-Chain Events</div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Last 5000 blocks</span>
            </div>

            {eventsLoading ? (
              <div className="loading-spinner" />
            ) : events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>📭</div>
                <p>No recent events</p>
              </div>
            ) : (
              <div className="code-window" style={{ border: 'none' }}>
                <div className="code-window-bar">
                  <span className="code-dot red" /><span className="code-dot yellow" /><span className="code-dot green" />
                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>event-log</span>
                </div>
                <div className="code-window-body">
                  {events.map((ev, i) => (
                    <div key={i} className="line" style={{ animationDelay: `${i * 0.03}s` }}>
                      <span className="timestamp">#{ev.block}</span>
                      <span className={ev.type === 'register' ? 'success' : ev.type === 'circuit-breaker' || ev.type === 'slippage-violation' ? 'error' : 'info'}>
                        [{ev.type === 'register' ? 'REGISTER' : ev.type === 'circuit-breaker' ? 'CB_FIRED' : ev.type === 'slippage-violation' ? 'SLIPPAGE' : ev.type === 'sig-verified' ? 'SIG_AUTH' : 'PROOF'}]
                      </span>
                      <span className="muted">{addr(ev.agent)}</span>
                      <span>
                        {ev.type === 'register' && ev.name}
                        {ev.type === 'circuit-breaker' && ev.reason}
                        {ev.type === 'proof' && `${ev.proofType} ${ev.verified ? '✓' : '✗'}`}
                        {ev.type === 'slippage-violation' && 'Slippage exceeded'}
                        {ev.type === 'sig-verified' && `${ev.action} authorized`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Features Stats */}
        <div className="glass-card no-hover" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="card-header">
            <div className="card-title">Advanced Security Features</div>
          </div>
          <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="stat-card brand">
              <div className="stat-label">MEV Protection</div>
              <div className="stat-value brand" style={{ fontSize: '1.2rem' }}>Flashbots</div>
              <div className="stat-subtitle">Frontrunning prevention via ENS</div>
            </div>
            <div className="stat-card emerald">
              <div className="stat-label">Slippage Guard</div>
              <div className="stat-value emerald">{slippageStats ? `${slippageStats.successRate}%` : '--'}</div>
              <div className="stat-subtitle">{slippageStats ? `${slippageStats.totalSwaps} swaps guarded` : 'On-chain enforcement'}</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-label">Signature Auth</div>
              <div className="stat-value cyan">{sigStats ? sigStats.totalVerified : '--'}</div>
              <div className="stat-subtitle">{sigStats ? `${sigStats.totalFailed} failed` : 'EIP-712 verification'}</div>
            </div>
            <div className="stat-card" style={{ '--accent': 'var(--purple)' }}>
              <div className="stat-label">Permit2</div>
              <div className="stat-value" style={{ color: 'var(--purple)' }}>Gasless</div>
              <div className="stat-subtitle">Uniswap token approvals</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">ZK Proofs</div>
              <div className="stat-value red">{stats?.verificationRate ?? '--'}%</div>
              <div className="stat-subtitle">ENS rule compliance</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}