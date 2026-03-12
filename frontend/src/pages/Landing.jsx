import { useState, useEffect } from 'react'

const FEATURES = [
  { icon: '🛡️', title: 'Agent Registry', desc: 'Register AI agents with ENS identities, capability hashes, and spending limits — fully on-chain.' },
  { icon: '⚡', title: 'Circuit Breaker', desc: 'One-click kill switch that freezes wallets, invalidates attestations, and halts all operations instantly.' },
  { icon: '🔐', title: 'ZK Compliance', desc: 'Noir zero-knowledge proofs verify agent compliance without exposing sensitive data.' },
  { icon: '🧠', title: 'TEE Attestation', desc: 'Trusted Execution Environments provide tamper-proof runtime attestation for every agent.' },
  { icon: '💰', title: 'Spending Guardrails', desc: 'Per-transaction and daily limits with real-time alerts prevent unauthorized fund movement.' },
  { icon: '🔍', title: 'Capability Enforcement', desc: 'On-chain capability checks ensure agents only perform actions they are authorized for.' },
]

const CODE_LINES = [
  { type: 'cmt', text: '// Register a new autonomous AI agent' },
  { type: 'kw', text: 'const ' , rest: [{ type: 'fn', text: 'agent' }, { type: 'op', text: ' = await ' }, { type: 'fn', text: 'darkAgent' }, { type: 'op', text: '.' }, { type: 'fn', text: 'registerAgent' }, { type: 'op', text: '(' }] },
  { type: 'str', text: '  agentWallet.address,' },
  { type: 'str', text: '  "elsa.darkagent.eth",' },
  { type: 'str', text: '  ["yield-farming", "token-swap"],' },
  { type: 'num', text: '  parseEther("0.5"),  // maxPerTx' },
  { type: 'num', text: '  parseEther("5.0"),  // maxPerDay' },
  { type: 'num', text: '  parseEther("1.0")   // alertThreshold' },
  { type: 'op', text: ')' },
  { type: 'cmt', text: '' },
  { type: 'cmt', text: '// Fire circuit breaker if agent is compromised' },
  { type: 'kw', text: 'await ', rest: [{ type: 'fn', text: 'darkAgent' }, { type: 'op', text: '.' }, { type: 'fn', text: 'fireCircuitBreaker' }, { type: 'op', text: '(' }] },
  { type: 'str', text: '  agent.address,' },
  { type: 'str', text: '  "attestation tampered",' },
  { type: 'str', text: '  invalidHash' },
  { type: 'op', text: ')' },
]

export default function Landing({ onNavigate, stats }) {
  const [visibleLines, setVisibleLines] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleLines(prev => prev < CODE_LINES.length ? prev + 1 : prev)
    }, 120)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="page-shell">
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="dot" />
          Live on Base Sepolia
        </div>

        <h1 className="animate-fade-up">
          Digital Bodyguard for{' '}
          <span className="gradient">Autonomous AI Agents</span>
        </h1>

        <p className="subtitle animate-fade-up" style={{ animationDelay: '0.1s' }}>
          On-chain registry, TEE attestation, ZK compliance proofs, and a one-click
          circuit breaker — everything your AI agent needs to operate safely.
        </p>

        <div className="hero-cta animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <button className="btn btn-brand" onClick={() => onNavigate('register')}>
            Register Agent
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('dashboard')}>
            View Dashboard →
          </button>
        </div>

        {/* Code preview */}
        <div className="code-window animate-fade-up" style={{ animationDelay: '0.3s', maxWidth: 600, width: '100%' }}>
          <div className="code-window-bar">
            <span className="code-dot red" />
            <span className="code-dot yellow" />
            <span className="code-dot green" />
            <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>register-agent.js</span>
          </div>
          <div className="code-window-body" style={{ minHeight: 280 }}>
            {CODE_LINES.slice(0, visibleLines).map((line, i) => (
              <div key={i} className="code-preview" style={{ opacity: 0, animation: `fadeIn 0.3s ease forwards ${i * 0.03}s` }}>
                {line.rest ? (
                  <span>
                    <span className={line.type}>{line.text}</span>
                    {line.rest.map((seg, j) => <span key={j} className={seg.type}>{seg.text}</span>)}
                  </span>
                ) : (
                  <span className={line.type}>{line.text || '\u00A0'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live stats */}
      {stats && (
        <section className="page-content" style={{ paddingTop: 0 }}>
          <div className="stats-grid stagger">
            <div className="stat-card brand">
              <div className="stat-label">Registered Agents</div>
              <div className="stat-value brand">{stats.totalAgents}</div>
              <div className="stat-subtitle">on-chain identities</div>
            </div>
            <div className="stat-card emerald">
              <div className="stat-label">Active Agents</div>
              <div className="stat-value emerald">{stats.activeAgents}</div>
              <div className="stat-subtitle">currently operating</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">Circuit Breakers</div>
              <div className="stat-value red">{stats.totalCBEvents}</div>
              <div className="stat-subtitle">emergency kills fired</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-label">ZK Proofs</div>
              <div className="stat-value cyan">{stats.totalProofs ?? '—'}</div>
              <div className="stat-subtitle">compliance verified</div>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="page-content" style={{ paddingTop: 0 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Complete <span style={{ background: 'var(--gradient-brand-h)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Security Stack</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Six layers of protection for autonomous AI operations</p>
        </div>
        <div className="grid-3 stagger">
          {FEATURES.map((f, i) => (
            <div key={i} className="glass-card" style={{ cursor: 'default' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{f.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="page-content">
        <div className="grid-2" style={{ alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 'var(--space-md)' }}>
              Built for <span style={{ background: 'var(--gradient-brand-h)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Real Security</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-lg)' }}>
              DarkAgent combines Solidity smart contracts on Base, Noir zero-knowledge circuits,
              TEE attestation, and ENS naming into a unified security framework. Every action
              is verified, every proof is on-chain, and every agent has a kill switch.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-brand btn-sm" onClick={() => onNavigate('audit')}>View Audit Trail</button>
              <button className="btn btn-outline btn-sm" onClick={() => onNavigate('circuit-breaker')}>Circuit Breaker</button>
            </div>
          </div>
          <div className="code-window">
            <div className="code-window-bar">
              <span className="code-dot red" /><span className="code-dot yellow" /><span className="code-dot green" />
              <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>architecture</span>
            </div>
            <div className="code-window-body code-preview" style={{ minHeight: 200 }}>
              <div><span className="cmt">// DarkAgent Security Stack</span></div>
              <div><span className="kw">Layer 1:</span> <span className="str">Smart Contracts (Base Sepolia)</span></div>
              <div><span className="kw">Layer 2:</span> <span className="str">Capability Enforcement</span></div>
              <div><span className="kw">Layer 3:</span> <span className="str">Spending Guardrails</span></div>
              <div><span className="kw">Layer 4:</span> <span className="str">TEE Attestation</span></div>
              <div><span className="kw">Layer 5:</span> <span className="str">ZK Compliance (Noir)</span></div>
              <div><span className="kw">Layer 6:</span> <span className="op">Circuit Breaker (Kill Switch)</span></div>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: 'var(--space-3xl) var(--space-xl)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        DarkAgent — ETHMumbai 2026 · Built on Base · Powered by Noir ZK &amp; TEE Attestation
      </footer>
    </div>
  )
}
