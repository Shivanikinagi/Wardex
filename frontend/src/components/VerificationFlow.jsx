import { useEffect, useState } from 'react'
import VerificationStep from './VerificationStep'

const STEP_TOOLTIPS = {
  ens: 'Reads agent permissions from ENS text records (max_spend, slippage, protocols)',
  wardex: 'wardex contract verifies the action against ENS rules and spending limits',
  smartwallet: 'Coinbase Smart Wallet validates the ERC-4337 UserOperation',
  base: 'Transaction executes on Base network via the smart wallet',
}

const DEFAULT_STEPS = [
  { id: 'ens', label: 'ENS Lookup', icon: '🌐' },
  { id: 'wardex', label: 'wardex Verify', icon: '⚡' },
  { id: 'smartwallet', label: 'Smart Wallet', icon: '🔵' },
  { id: 'base', label: 'Base Execution', icon: '🔷' },
]

export default function VerificationFlow({ steps, animated = false }) {
  const [localSteps, setLocalSteps] = useState(
    DEFAULT_STEPS.map((s) => ({ ...s, status: 'pending', tooltip: STEP_TOOLTIPS[s.id] }))
  )

  // Merge incoming step states
  useEffect(() => {
    if (!steps) return
    setLocalSteps(
      DEFAULT_STEPS.map((s) => {
        const incoming = steps.find((x) => x.id === s.id)
        return {
          ...s,
          ...(incoming || {}),
          tooltip: STEP_TOOLTIPS[s.id],
        }
      })
    )
  }, [steps])

  // Animate through steps when animated=true and all start pending
  useEffect(() => {
    if (!animated) return
    let cancelled = false
    const run = async () => {
      for (let i = 0; i < DEFAULT_STEPS.length; i++) {
        if (cancelled) return
        setLocalSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status: idx < i ? 'complete' : idx === i ? 'active' : 'pending',
            timeMs: idx < i ? Math.floor(Math.random() * 150 + 30) : undefined,
          }))
        )
        await new Promise((r) => setTimeout(r, 600))
      }
      if (!cancelled) {
        setLocalSteps((prev) =>
          prev.map((s) => ({ ...s, status: 'complete', timeMs: s.timeMs || Math.floor(Math.random() * 150 + 30) }))
        )
      }
    }
    run()
    return () => { cancelled = true }
  }, [animated])

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 w-full">
      {localSteps.map((step, idx) => (
        <div key={step.id} className="flex flex-col sm:flex-row items-center flex-1">
          <VerificationStep {...step} />
          {idx < localSteps.length - 1 && (
            <div className="hidden sm:block flex-1 h-px bg-gradient-to-r from-vault-slate/30 to-vault-slate/10 mx-2" />
          )}
        </div>
      ))}
    </div>
  )
}
