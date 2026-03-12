import { useState, useEffect, useCallback } from 'react'
import './index.css'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Register from './pages/Register'
import Audit from './pages/Audit'
import CircuitBreaker from './pages/CircuitBreaker'
import ElsaChat from './pages/ElsaChat'
import { useContracts, fetchAgents } from './hooks/useContracts'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'register', label: 'Register' },
  { id: 'circuit-breaker', label: 'Circuit Breaker' },
  { id: 'audit', label: 'Audit' },
  { id: 'chat', label: 'Agent Chat' },
]

export default function App() {
  const [activePage, setActivePage] = useState('landing')
  const web3 = useContracts()
  const [agents, setAgents] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadAgents = useCallback(async () => {
    if (!web3.isLive) { setAgents([]); setStats(null); return }
    setLoading(true)
    try {
      const list = await fetchAgents(web3.contracts, web3.config)
      const agentList = list || []
      setAgents(agentList)

      let totalCBEvents = 0
      try { totalCBEvents = Number(await web3.contracts.darkAgent.totalCircuitBreakerEvents()) } catch {}

      let totalProofs = 0
      try {
        const vStats = await web3.contracts.verifier.getStats()
        totalProofs = Number(vStats[0]) + Number(vStats[1])
      } catch {}

      setStats({
        totalAgents: agentList.length,
        activeAgents: agentList.filter(a => a.status === 'ACTIVE').length,
        frozenAgents: agentList.filter(a => a.status === 'FROZEN').length,
        totalCBEvents,
        totalProofs,
      })
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setLoading(false)
    }
  }, [web3.isLive, web3.contracts, web3.config])

  useEffect(() => { loadAgents() }, [loadAgents])

  const renderPage = () => {
    switch (activePage) {
      case 'landing': return <Landing onNavigate={setActivePage} stats={stats} />
      case 'dashboard': return <Dashboard web3={web3} agents={agents} stats={stats} loading={loading} onRefresh={loadAgents} onNavigate={setActivePage} />
      case 'register': return <Register web3={web3} onRegistered={loadAgents} onNavigate={setActivePage} />
      case 'circuit-breaker': return <CircuitBreaker web3={web3} agents={agents} onFired={loadAgents} />
      case 'audit': return <Audit web3={web3} agents={agents} />
      case 'chat': return <ElsaChat web3={web3} agents={agents} />
      default: return <Landing onNavigate={setActivePage} stats={stats} />
    }
  }

  return (
    <div className="app-root">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand" onClick={() => setActivePage('landing')}>
          <div className="brand-icon">🔒</div>
          <span>DarkAgent</span>
        </div>

        <div className="navbar-links">
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              className={`nav-link ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="navbar-actions">
          {web3.isLive ? (
            <div className="btn btn-outline btn-sm" style={{ cursor: 'default' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }} />
              {web3.account?.slice(0, 6)}...{web3.account?.slice(-4)}
            </div>
          ) : (
            <button className="btn btn-brand btn-sm" onClick={web3.connect} disabled={web3.connecting}>
              {web3.connecting ? '⏳ Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </nav>

      {/* Page content */}
      {renderPage()}

      {web3.error && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)', padding: '12px 20px', maxWidth: 400,
          color: 'var(--accent-red)', fontSize: '0.82rem', backdropFilter: 'blur(10px)',
        }}>
          {web3.error}
        </div>
      )}
    </div>
  )
}
