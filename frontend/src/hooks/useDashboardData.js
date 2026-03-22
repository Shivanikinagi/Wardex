import { useState, useEffect, useCallback } from 'react'
import { useMockData, MOCK_DAILY_VOLUME } from './useMockData'

function buildActivityFeed(events) {
  return [...events]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100)
}

function computeStats(proposed, verified, executed, rejected, activityFeed) {
  const totalTransactions = executed.length
  const successRate = proposed.length > 0
    ? Math.round((executed.length / proposed.length) * 100)
    : 0
  const errorCount = rejected.length

  // avg verification time from mock (ms)
  const avgVerificationTimeMs = verified.length > 0
    ? Math.round(verified.reduce((s, e) => s + (e.verifyTimeMs || 120), 0) / verified.length)
    : 0

  // active agents: unique agent addresses in last 24h
  const cutoff = Math.floor(Date.now() / 1000) - 86400
  const recentAgents = new Set(
    activityFeed.filter((e) => e.timestamp > cutoff).map((e) => e.agentAddress)
  )
  const activeAgents = recentAgents.size

  return { totalTransactions, transactionsDelta: 12, activeAgents, avgVerificationTimeMs, successRate, errorCount }
}

export function useDashboardData({ contracts, connected } = {}) {
  const { mockActivityFeed, mockDailyVolume } = useMockData()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [activityFeed, setActivityFeed] = useState([])
  const [dailyVolume, setDailyVolume] = useState(MOCK_DAILY_VOLUME)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      if (connected && contracts?.wardex) {
        // Try on-chain events
        const filter = contracts.wardex.filters
        const [proposedEvts, verifiedEvts, executedEvts] = await Promise.all([
          contracts.wardex.queryFilter(filter.ActionProposed?.() || {}, -10000).catch(() => []),
          contracts.wardex.queryFilter(filter.ActionVerified?.() || {}, -10000).catch(() => []),
          contracts.wardex.queryFilter(filter.ActionExecuted?.() || {}, -10000).catch(() => []),
        ])

        if (proposedEvts.length + verifiedEvts.length + executedEvts.length > 0) {
          const feed = [...proposedEvts, ...verifiedEvts, ...executedEvts].map((e) => ({
            id: `${e.transactionHash}-${e.logIndex}`,
            type: e.event === 'ActionProposed' ? 'proposal' : e.event === 'ActionVerified' ? 'verification' : 'execution',
            agentAddress: e.args?.agent || '0x0000000000000000000000000000000000000000',
            userAddress: e.args?.owner || '0x0000000000000000000000000000000000000000',
            proposalId: e.args?.proposalId || '0x0',
            status: e.event === 'ActionProposed' ? 'proposed' : e.event === 'ActionVerified' ? 'verified' : 'executed',
            blockNumber: e.blockNumber,
            timestamp: Math.floor(Date.now() / 1000) - (12345678 - e.blockNumber) * 2,
            txHash: e.transactionHash,
          }))

          const rejected = verifiedEvts.filter((e) => e.args?.approved === false)
          const computed = computeStats(proposedEvts, verifiedEvts, executedEvts, rejected, feed)
          setStats({ ...computed, dailyVolume: mockDailyVolume })
          setActivityFeed(buildActivityFeed(feed))
          setLoading(false)
          return
        }
      }
    } catch (err) {
      setError(err.message)
    }

    // Fall back to mock data
    const feed = buildActivityFeed(mockActivityFeed)
    const proposed = feed.filter((e) => e.type === 'proposal')
    const verified = feed.filter((e) => e.type === 'verification')
    const executed = feed.filter((e) => e.type === 'execution')
    const rejected = feed.filter((e) => e.status === 'rejected')
    const computed = computeStats(proposed, verified, executed, rejected, feed)
    setStats({ ...computed, dailyVolume: mockDailyVolume })
    setActivityFeed(feed)
    setDailyVolume(mockDailyVolume)
    setLoading(false)
  }, [connected, contracts, mockActivityFeed, mockDailyVolume])

  useEffect(() => {
    loadData()
  }, [loadData])

  return { loading, error, stats, activityFeed, dailyVolume, refresh: loadData }
}
