import { useState, useRef, useEffect } from 'react'
import { queryComplianceOnChain } from '../hooks/useContracts'

export default function ElsaChat({ web3, agents }) {
  const [messages, setMessages] = useState([
    { role: 'system', text: 'DarkAgent CLI ready. Type /help for available commands. All data is fetched live from Base Sepolia contracts.' },
  ])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const addMsg = (role, text) => setMessages(prev => [...prev, { role, text }])

  const resolveAgent = (query) => {
    if (!query) return null
    const q = query.toLowerCase().trim()
    return agents.find(a =>
      a.address.toLowerCase() === q ||
      a.ensName?.toLowerCase().includes(q) ||
      a.address.toLowerCase().startsWith(q)
    )
  }

  const handleCommand = async (cmd) => {
    const parts = cmd.trim().split(/\s+/)
    const command = parts[0].toLowerCase()
    const arg = parts.slice(1).join(' ')

    if (!web3.isLive && command !== '/help') {
      addMsg('error', 'Not connected. Connect wallet to Base Sepolia first.')
      return
    }

    switch (command) {
      case '/help':
        addMsg('system', [
          'Available commands:',
          '  /agents           — List all registered agents',
          '  /status <agent>   — Show agent details (use address or ENS name)',
          '  /compliance <agent> — Query ZK compliance status',
          '  /capabilities <agent> — List agent capabilities',
          '  /spending <agent> — Show spending info',
          '  /stats            — Network-wide statistics',
          '  /clear            — Clear chat',
        ].join('\n'))
        break

      case '/agents': {
        if (agents.length === 0) {
          addMsg('warning', 'No agents registered on-chain.')
        } else {
          const lines = agents.map(a =>
            `  ${a.status === 'ACTIVE' ? '🟢' : '🔴'} ${a.ensName || a.address.slice(0, 12) + '...'} [${a.status}] — ${a.capabilities.join(', ')}`
          )
          addMsg('success', `Registered agents (${agents.length}):\n${lines.join('\n')}`)
        }
        break
      }

      case '/status': {
        const agent = resolveAgent(arg)
        if (!agent) { addMsg('error', `Agent not found: ${arg}`); break }
        addMsg('success', [
          `Agent: ${agent.ensName || agent.address}`,
          `Address: ${agent.address}`,
          `Owner: ${agent.owner}`,
          `Status: ${agent.status}`,
          `Reputation: ${agent.reputationScore}`,
          `Capabilities: ${agent.capabilities.join(', ')}`,
          `Attestation: ${agent.attestationValid ? '✓ Valid' : '✗ Invalid'}`,
          `Registered: ${new Date(agent.registeredAt * 1000).toLocaleString()}`,
        ].join('\n'))
        break
      }

      case '/compliance': {
        const agent = resolveAgent(arg)
        if (!agent) { addMsg('error', `Agent not found: ${arg}`); break }
        try {
          setProcessing(true)
          const comp = await queryComplianceOnChain(web3.contracts, agent.address)
          addMsg('success', [
            `Compliance for ${agent.ensName || agent.address.slice(0, 12)}:`,
            `  Status: ${comp.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}`,
            `  Total proofs: ${comp.totalProofs}`,
            `  Verified: ${comp.verifiedProofs}`,
            `  Failed: ${comp.failedProofs}`,
          ].join('\n'))
        } catch (err) {
          addMsg('error', `Compliance query failed: ${err.message}`)
        } finally {
          setProcessing(false)
        }
        break
      }

      case '/capabilities': {
        const agent = resolveAgent(arg)
        if (!agent) { addMsg('error', `Agent not found: ${arg}`); break }
        if (agent.capabilities.length === 0) {
          addMsg('warning', `${agent.ensName || agent.address.slice(0, 12)} has no capabilities.`)
        } else {
          addMsg('success', `Capabilities for ${agent.ensName || agent.address.slice(0, 12)}:\n${agent.capabilities.map(c => `  ▸ ${c}`).join('\n')}`)
        }
        break
      }

      case '/spending': {
        const agent = resolveAgent(arg)
        if (!agent) { addMsg('error', `Agent not found: ${arg}`); break }
        addMsg('success', [
          `Spending info for ${agent.ensName || agent.address.slice(0, 12)}:`,
          `  Daily spent: ${agent.dailySpent} ETH`,
          `  Max per tx: ${agent.maxPerTx} ETH`,
          `  Max per day: ${agent.maxPerDay} ETH`,
          `  Alert threshold: ${agent.alertThreshold} ETH`,
        ].join('\n'))
        break
      }

      case '/stats': {
        try {
          setProcessing(true)
          const [totalAgents, totalCB] = await Promise.all([
            web3.contracts.darkAgent.totalAgents(),
            web3.contracts.darkAgent.totalCircuitBreakerEvents(),
          ])
          let vStats = null
          try { vStats = await web3.contracts.verifier.getStats() } catch {}
          let cStats = null
          try { cStats = await web3.contracts.capabilityCheck.getStats() } catch {}

          addMsg('success', [
            'Network Statistics (Base Sepolia):',
            `  Total agents: ${Number(totalAgents)}`,
            `  Active: ${agents.filter(a => a.status === 'ACTIVE').length}`,
            `  Frozen: ${agents.filter(a => a.status === 'FROZEN').length}`,
            `  CB events: ${Number(totalCB)}`,
            vStats ? `  Proofs verified: ${Number(vStats[0])}` : '',
            vStats ? `  Proofs failed: ${Number(vStats[1])}` : '',
            cStats ? `  Capability checks: ${Number(cStats[2])}` : '',
            cStats ? `  Violations: ${Number(cStats[1])}` : '',
          ].filter(Boolean).join('\n'))
        } catch (err) {
          addMsg('error', `Stats failed: ${err.message}`)
        } finally {
          setProcessing(false)
        }
        break
      }

      case '/clear':
        setMessages([{ role: 'system', text: 'Chat cleared. Type /help for commands.' }])
        break

      default:
        addMsg('warning', `Unknown command: ${command}. Type /help for available commands.`)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || processing) return
    const cmd = input.trim()
    addMsg('user', cmd)
    setInput('')
    handleCommand(cmd)
  }

  const msgColor = (role) => {
    switch (role) {
      case 'system': return 'var(--text-muted)'
      case 'user': return 'var(--brand-pink)'
      case 'success': return 'var(--accent-emerald)'
      case 'error': return 'var(--accent-red)'
      case 'warning': return 'var(--accent-amber)'
      default: return 'var(--text-secondary)'
    }
  }

  const msgPrefix = (role) => {
    switch (role) {
      case 'user': return '> '
      case 'system': return '$ '
      case 'success': return '✓ '
      case 'error': return '✗ '
      case 'warning': return '⚠ '
      default: return ''
    }
  }

  return (
    <div className="page-shell">
      <div className="page-content">
        <div className="page-header">
          <h2>Agent Chat</h2>
          <p>CLI interface to query on-chain agent data in real-time</p>
        </div>

        <div className="code-window" style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="code-window-bar">
            <span className="code-dot red" /><span className="code-dot yellow" /><span className="code-dot green" />
            <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>darkagent-cli</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: web3.isLive ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
              {web3.isLive ? '● Connected' : '○ Disconnected'}
            </span>
          </div>
          <div className="code-window-body" style={{ minHeight: 450, maxHeight: 550 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: 6, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: 1.7 }}>
                <span style={{ color: msgColor(msg.role) }}>
                  {msgPrefix(msg.role)}{msg.text}
                </span>
              </div>
            ))}
            {processing && <div className="loading-spinner" style={{ margin: '8px 0' }} />}
            <div ref={endRef} />
          </div>
          <form onSubmit={handleSubmit} style={{
            display: 'flex', borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(255,255,255,0.01)',
          }}>
            <span style={{ padding: '12px', color: 'var(--brand-pink)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>{'>'}</span>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="/help"
              disabled={processing}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
                padding: '12px 0',
              }}
            />
            <button type="submit" disabled={processing} style={{
              background: 'transparent', border: 'none', color: 'var(--brand-magenta)',
              padding: '12px 16px', fontSize: '0.875rem', cursor: 'pointer',
            }}>
              ↵
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}