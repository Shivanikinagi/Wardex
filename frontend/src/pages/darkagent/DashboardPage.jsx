import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useDarkAgent } from '../../context/DarkAgentContext'
import { normalizePolicy, PERSONA_PRESETS, TRUSTED_PROTOCOLS } from '../../lib/policyEngine'
import { AppShell, GlowButton, Input, Label, MetricCard, PageHeader, SectionCard, StatusBadge, ViewportFit } from '../../components/darkagent/Ui'

const DEFAULT_PROFILE = 'alice.eth'
const DEFAULT_FORM = {
  persona: 'balanced',
  maxTradeUsd: 800,
  maxSlippageBps: 125,
  trustedProtocolsOnly: true,
  blockMemeCoins: true,
  blockUnknownTokens: true,
  allowLowLiquidityAssets: false,
  trustedProtocols: 'Uniswap, 1inch, Aave',
  twitter: 300,
}

function formatDateTime(value) {
  if (!value) return 'No sync yet'
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DashboardPage() {
  const { state, updatePolicy, busy, streamStatus } = useDarkAgent()
  const profile = state?.policies?.find((entry) => entry.ensName === DEFAULT_PROFILE)
  const watcherStatus = state?.watcher
  const watcherLiveLabel =
    streamStatus === 'live' ? 'Live' : streamStatus === 'reconnecting' ? 'Reconnecting' : 'Offline'
  const personaCatalog = state?.personas || PERSONA_PRESETS
  const normalizedProfile = useMemo(() => normalizePolicy(profile?.stored), [profile])

  const [form, setForm] = useState(DEFAULT_FORM)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile?.stored) {
      setForm(DEFAULT_FORM)
      return
    }

    const stored = normalizePolicy(profile.stored)
    setForm({
      persona: stored.persona,
      maxTradeUsd: stored.maxTradeUsd ?? stored.maxSpendUsd ?? PERSONA_PRESETS.balanced.maxTradeUsd,
      maxSlippageBps: stored.maxSlippageBps ?? stored.slippageBps ?? PERSONA_PRESETS.balanced.maxSlippageBps,
      trustedProtocolsOnly: stored.trustedProtocolsOnly !== false,
      blockMemeCoins: stored.blockMemeCoins,
      blockUnknownTokens: stored.blockUnknownTokens !== false,
      allowLowLiquidityAssets: stored.allowLowLiquidityAssets === true,
      trustedProtocols: (stored.trustedProtocols || TRUSTED_PROTOCOLS).join(', '),
      twitter: stored.sourceLimits?.twitter ?? 300,
    })
  }, [profile])

  const summary = useMemo(
    () => [
      `Max trade size: $${form.maxTradeUsd}`,
        `Twitter limit: $${form.twitter}`,
      `Max slippage: ${form.maxSlippageBps} bps`,
      form.blockMemeCoins ? 'Meme coins blocked' : 'Meme coins allowed',
      form.trustedProtocolsOnly ? 'Trusted protocols only' : 'Open protocol access',
    ],
    [form]
  )

  function applyPersona(persona) {
    const preset = normalizePolicy(personaCatalog[persona] || PERSONA_PRESETS[persona])
    setForm({
      persona,
      maxTradeUsd: preset.maxTradeUsd,
      maxSlippageBps: preset.maxSlippageBps,
      trustedProtocolsOnly: preset.trustedProtocolsOnly,
      blockMemeCoins: preset.blockMemeCoins,
      blockUnknownTokens: preset.blockUnknownTokens,
      allowLowLiquidityAssets: preset.allowLowLiquidityAssets,
      trustedProtocols: preset.trustedProtocols.join(', '),
      twitter: preset.sourceLimits.twitter,
    })
    setSaved(false)
  }

  async function handleSave() {
    await updatePolicy(DEFAULT_PROFILE, {
      persona: form.persona,
      maxTradeUsd: Number(form.maxTradeUsd),
      maxSlippageBps: Number(form.maxSlippageBps),
      trustedProtocolsOnly: form.trustedProtocolsOnly,
      blockMemeCoins: form.blockMemeCoins,
      blockUnknownTokens: form.blockUnknownTokens,
      allowLowLiquidityAssets: form.allowLowLiquidityAssets,
      minLiquidityUsd: form.allowLowLiquidityAssets ? 75000 : 250000,
      trustedProtocols: form.trustedProtocols
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      sourceLimits: {
        twitter: Number(form.twitter),
      },
    })
    setSaved(true)
  }

  return (
    <AppShell>
      <ViewportFit>
        <div className="mx-auto w-full max-w-5xl">
          <PageHeader
            eyebrow="Policy"
            title="Set your policy."
            description="Limits, source controls, and trusted protocols."
            actions={<StatusBadge status={saved ? 'safe' : 'downsized'}>{saved ? 'Saved' : 'Active profile'}</StatusBadge>}
          />

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            <SectionCard className="overflow-hidden">
              <div className="grid gap-3 md:grid-cols-3">
                {Object.values(personaCatalog).map((preset) => (
                  <button
                    key={preset.persona}
                    onClick={() => applyPersona(preset.persona)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      form.persona === preset.persona
                        ? 'border-vault-green/25 bg-vault-green/10'
                        : 'border-white/8 bg-black/20 hover:border-white/15'
                    }`}
                  >
                    <div className="text-base font-semibold capitalize text-white">{preset.persona}</div>
                    <div className="mt-1 text-sm text-slate-400">Max trade ${preset.maxTradeUsd}</div>
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Max trade size</Label>
                  <Input value={form.maxTradeUsd} onChange={(event) => setForm((current) => ({ ...current, maxTradeUsd: event.target.value }))} />
                </div>
                <div>
                  <Label>Max slippage (bps)</Label>
                  <Input value={form.maxSlippageBps} onChange={(event) => setForm((current) => ({ ...current, maxSlippageBps: event.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Trusted protocols</Label>
                  <Input value={form.trustedProtocols} onChange={(event) => setForm((current) => ({ ...current, trustedProtocols: event.target.value }))} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <ToggleRow label="Trusted protocols only" active={form.trustedProtocolsOnly} onClick={() => setForm((current) => ({ ...current, trustedProtocolsOnly: !current.trustedProtocolsOnly }))} />
                <ToggleRow label="Block meme coins" active={form.blockMemeCoins} onClick={() => setForm((current) => ({ ...current, blockMemeCoins: !current.blockMemeCoins }))} />
                <ToggleRow label="Block unknown tokens" active={form.blockUnknownTokens} onClick={() => setForm((current) => ({ ...current, blockUnknownTokens: !current.blockUnknownTokens }))} />
                <ToggleRow label="Allow low liquidity assets" active={form.allowLowLiquidityAssets} onClick={() => setForm((current) => ({ ...current, allowLowLiquidityAssets: !current.allowLowLiquidityAssets }))} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Twitter limit</Label>
                  <Input value={form.twitter} onChange={(event) => setForm((current) => ({ ...current, twitter: event.target.value }))} />
                </div>
              </div>

              <div className="mt-6">
                <GlowButton onClick={handleSave} className="bg-vault-green text-black hover:bg-vault-green/90 disabled:opacity-60" disabled={busy}>
                  <CheckCircle2 className="h-4 w-4" /> {busy ? 'Saving...' : 'Save policy'}
                </GlowButton>
              </div>
            </SectionCard>

            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricCard
                  label="Profile"
                  value={normalizedProfile.persona}
                  detail={`${DEFAULT_PROFILE} - updated ${formatDateTime(profile?.stored?.updatedAt)}`}
                />
                <MetricCard
                  label="Watcher"
                  value={profile?.pendingSync ? 'Pending sync' : watcherLiveLabel}
                  detail={watcherStatus?.lastSyncAt ? `Last sync ${formatDateTime(watcherStatus.lastSyncAt)}` : 'Waiting for first sync'}
                />
              </div>

              <SectionCard className="h-full">
                <div className="text-xs uppercase tracking-[0.24em] text-vault-slate">Policy summary</div>
                <div className="mt-4 space-y-3">
                  {summary.map((item) => (
                    <div key={item} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </ViewportFit>
    </AppShell>
  )
}

function ToggleRow({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
        active ? 'border-vault-green/20 bg-vault-green/10 text-vault-green' : 'border-white/8 bg-black/20 text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}
