import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useContracts } from '../hooks/useContracts'
import { useDashboardData } from '../hooks/useDashboardData'

import ActivityFeed from '../components/ActivityFeed'
import Sparkline from '../components/Sparkline'
import IntegrationCard from '../components/IntegrationCard'
import { formatPercent } from '../utils/format'

const INTEGRATIONS = [
  {
    name: 'Coinbase Smart Wallet',
    logo: '🔵',
    status: 'connected',
    metric: { label: 'ERC-4337', value: 'Active' },
    description: 'Passkey-based smart wallet with gas sponsorship on Base.',
    learnMoreUrl: 'https://www.coinbase.com/wallet',
  },
  {
    name: 'ENS',
    logo: '🌐',
    status: 'connected',
    metric: { label: 'Records', value: 'Synced' },
    description: 'Agent permissions stored as ENS text records on-chain.',
    learnMoreUrl: 'https://app.ens.domains',
  },
  {
    name: 'Execution Policy',
    logo: '🛡️',
    status: 'pending',
    metric: { label: 'Policy', value: 'Enforcing' },
    description: 'Execution guardrails, stealth routing, and spend enforcement for agent actions.',
    learnMoreUrl: 'https://base.org',
  },
  {
    name: 'Base',
    logo: '🔷',
    status: 'connected',
    metric: { label: 'Network', value: 'Sepolia' },
    description: 'All agent transactions execute on Base via ERC-4337 UserOps.',
    learnMoreUrl: 'https://base.org',
  },
]

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Dashboard() {
  const { contracts, connected } = useContracts()
  const { stats, activityFeed, dailyVolume, loading } = useDashboardData({ contracts, connected })

  const [filterAddress, setFilterAddress] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const debouncedAddress = useDebounce(filterAddress, 300)

  const filteredFeed = useMemo(() => {
    return activityFeed.filter((item) => {
      if (debouncedAddress && !item.agentAddress.toLowerCase().includes(debouncedAddress.toLowerCase())) return false
      if (filterType !== 'all' && item.type !== filterType) return false
      if (filterDateFrom) {
        const from = new Date(filterDateFrom).getTime() / 1000
        if (item.timestamp < from) return false
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo).getTime() / 1000 + 86400
        if (item.timestamp > to) return false
      }
      return true
    })
  }, [activityFeed, debouncedAddress, filterType, filterDateFrom, filterDateTo])

  const sparkData = dailyVolume?.map((d) => d.count) || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-vault-text">Network Logs</h2>
          <p className="text-vault-slate mt-1">Real-time agent activity and protocol analytics</p>
        </div>
        {!connected }
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Transactions"
          value={loading ? '—' : stats?.totalTransactions ?? 0}
          delta={stats?.transactionsDelta}
          sparkData={sparkData}
          color="#00ff88"
        />
        <StatCard
          label="Active Agents"
          value={loading ? '—' : stats?.activeAgents ?? 0}
          sparkData={sparkData.map((v) => v * 0.3)}
          color="#0ea5e9"
        />
        <StatCard
          label="Avg Verify Time"
          value={loading ? '—' : `${stats?.avgVerificationTimeMs ?? 0}ms`}
          sparkData={sparkData.map((v) => v * 0.6)}
          color="#e879f9"
        />
        <StatCard
          label="Success Rate"
          value={loading ? '—' : formatPercent(stats?.successRate ?? 0)}
          sparkData={sparkData.map((v) => v * 0.9)}
          color="#10b981"
        />
      </div>

      {/* Volume Chart */}
      <div className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-vault-text">7-Day Transaction Volume</h3>
          <span className="text-xs text-vault-slate">Last 7 days</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dailyVolume || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,85,104,0.2)" />
            <XAxis dataKey="date" tick={{ fill: '#718096', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fill: '#718096', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1a1d23', border: '1px solid rgba(74,85,104,0.3)', borderRadius: 8 }}
              labelStyle={{ color: '#f7f3e9' }}
              itemStyle={{ color: '#00ff88' }}
            />
            <Line type="monotone" dataKey="count" stroke="#00ff88" strokeWidth={2} dot={{ fill: '#00ff88', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Activity Feed with Filters */}
      <div className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-vault-text">Activity Feed</h3>
          <span className="text-xs text-vault-slate">{filteredFeed.length} events</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Filter by agent address..."
            value={filterAddress}
            onChange={(e) => setFilterAddress(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-vault-slate/10 border border-vault-slate/20 text-sm text-vault-text placeholder-vault-slate focus:outline-none focus:border-vault-green/40"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-vault-slate/10 border border-vault-slate/20 text-sm text-vault-text focus:outline-none focus:border-vault-green/40"
          >
            <option value="all">All Types</option>
            <option value="proposal">Proposals</option>
            <option value="verification">Verifications</option>
            <option value="execution">Executions</option>
            <option value="freeze">Freezes</option>
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl bg-vault-slate/10 border border-vault-slate/20 text-sm text-vault-text focus:outline-none focus:border-vault-green/40"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl bg-vault-slate/10 border border-vault-slate/20 text-sm text-vault-text focus:outline-none focus:border-vault-green/40"
          />
        </div>

        <ActivityFeed items={filteredFeed} />
      </div>

      {/* Integration Status */}
      <div>
        <h3 className="font-semibold text-vault-text mb-4">Integration Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {INTEGRATIONS.map((card) => (
            <IntegrationCard key={card.name} {...card} />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, delta, sparkData, color }) {
  return (
    <div className="p-5 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/60 backdrop-blur-xl hover:border-vault-green/20 transition-all duration-300">
      <div className="text-xs text-vault-slate uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold text-vault-text mb-1">{value}</div>
      {delta !== undefined && (
        <div className="text-xs text-vault-green">↑ {delta}% vs last period</div>
      )}
      {sparkData?.length > 0 && (
        <div className="mt-2">
          <Sparkline data={sparkData} color={color} height={36} />
        </div>
      )}
    </div>
  )
}
