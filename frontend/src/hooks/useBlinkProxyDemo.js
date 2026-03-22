import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_DARKAGENT_API_URL || 'http://localhost:8787'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || 'Request failed')
    error.payload = payload
    throw error
  }

  return payload
}

async function requestOptional(path, options = {}) {
  try {
    return await request(path, options)
  } catch (error) {
    const message = String(error?.message || '')
    if (message.toLowerCase().includes('not found')) {
      return null
    }
    throw error
  }
}

export function useBlinkProxyDemo() {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [streamStatus, setStreamStatus] = useState('connecting')
  const [lastEvent, setLastEvent] = useState(null)

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
    }

    try {
      const [policies, activity, proofs, watcher, integrations] = await Promise.all([
        request('/api/policies'),
        request('/api/activity'),
        request('/api/proofs'),
        request('/api/watcher/status'),
        requestOptional('/api/integrations'),
      ])

      const data = {
        policies: policies.policies || [],
        activity: activity.events || [],
        proofs: proofs.proofs || [],
        proofSigner: proofs.signer || null,
        watcher,
        integrations,
      }
      setState(data)
      setError(null)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/api/events`)

    source.onopen = () => {
      setStreamStatus('live')
    }

    source.onerror = () => {
      setStreamStatus('offline')
      source.close()
    }

    const handleRefresh = (eventName) => {
      setLastEvent({
        type: eventName,
        at: new Date().toISOString(),
      })
      refresh({ silent: true }).catch(() => {})
    }

    source.addEventListener('activity', () => handleRefresh('activity'))
    source.addEventListener('proof', () => handleRefresh('proof'))
    source.addEventListener('watcher', () => handleRefresh('watcher'))

    return () => {
      setStreamStatus('offline')
      source.close()
    }
  }, [refresh])

  const runMutation = useCallback(
    async (executor) => {
      setBusy(true)
      try {
        const result = await executor()
        await refresh({ silent: true })
        setError(null)
        return result
      } catch (err) {
        setError(err.message)
        throw err
      } finally {
        setBusy(false)
      }
    },
    [refresh]
  )

  const analyzeBlinkUrl = useCallback(
    ({ url, ensName }) =>
      runMutation(() =>
        request('/api/blinks/analyze', {
          method: 'POST',
          body: JSON.stringify({ url, ensName }),
        })
      ),
    [runMutation]
  )

  const executeBlinkUrl = useCallback(
    ({ url, ensName }) =>
      runMutation(() =>
        request('/api/blinks/execute', {
          method: 'POST',
          body: JSON.stringify({ url, ensName }),
        })
      ),
    [runMutation]
  )

  const createShareLink = useCallback(
    ({ blinkUrl, ensName, meta }) =>
      runMutation(() =>
        request('/api/share-links', {
          method: 'POST',
          body: JSON.stringify({ blinkUrl, ensName, meta }),
        })
      ),
    [runMutation]
  )

  const getShareLink = useCallback(
    async (shareId) => request(`/api/share-links/${shareId}`),
    []
  )

  const updatePolicy = useCallback(
    (ensName, patch) =>
      runMutation(() =>
        request(`/api/policies/${ensName}`, {
          method: 'PUT',
          body: JSON.stringify(patch),
        })
      ),
    [runMutation]
  )

  const syncWatcher = useCallback(
    () =>
      runMutation(() =>
        request('/api/watcher/sync', {
          method: 'POST',
        })
      ),
    [runMutation]
  )

  const resetDemo = useCallback(
    () =>
      runMutation(() =>
        request('/api/demo/reset', {
          method: 'POST',
        })
      ),
    [runMutation]
  )

  const policiesByEns = useMemo(() => {
    const entries = state?.policies || []
    return Object.fromEntries(entries.map((entry) => [entry.ensName, entry]))
  }, [state])

  return {
    apiBase: API_BASE,
    state,
    loading,
    error,
    busy,
    streamStatus,
    lastEvent,
    refresh,
    analyzeBlinkUrl,
    executeBlinkUrl,
    createShareLink,
    getShareLink,
    updatePolicy,
    syncWatcher,
    resetDemo,
    policiesByEns,
  }
}
