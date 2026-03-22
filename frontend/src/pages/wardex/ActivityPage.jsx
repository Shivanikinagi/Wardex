import { Clock3 } from 'lucide-react'
import { useWardex } from '../../context/WardexContext'
import { AppShell, PageHeader, SectionCard, StatusBadge, ViewportFit } from '../../components/wardex/Ui'

const fallbackActivity = [
  {
    id: 'blocked-demo',
    createdAt: new Date().toISOString(),
    sourceName: '@MoonAlphaX',
    protocol: 'Uniswap',
    amountUsd: 1000,
    status: 'blocked',
    reason: 'Blocked because meme coins are disabled and the amount exceeds the influencer limit.',
  },
  {
    id: 'downsized-demo',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    sourceName: '@DeepTrendBot',
    protocol: 'Uniswap',
    amountUsd: 800,
    status: 'auto-downsize',
    reason: 'Trade downsized from 800 USD to 300 USD for twitter.',
  },
  {
    id: 'safe-demo',
    createdAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    sourceName: 'Riya',
    protocol: 'Uniswap',
    amountUsd: 120,
    status: 'executed',
    reason: 'Blink fits your current trading policy.',
  },
]

function formatTime(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusForBadge(status) {
  if (status === 'blocked') return 'blocked'
  if (status === 'auto-downsize') return 'downsized'
  if (status === 'executed') return 'safe'
  return 'risky'
}

export default function ActivityPage() {
  const { state } = usewardex()
  const events = state?.activity?.length ? state.activity : fallbackActivity

  return (
    <AppShell>
      <ViewportFit>
        <>
          <PageHeader
            eyebrow="Activity"
            title="Activity."
            description="Recent decisions."
            actions={<StatusBadge status="safe">{events.length} events</StatusBadge>}
          />

          <SectionCard className="mt-6 overflow-hidden">
            <div className="grid gap-3">
              {events.slice(0, 4).map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-white">{event.sourceName || event.ensName || 'wardex system'}</div>
                        <StatusBadge status={statusForBadge(event.status)}>{event.status}</StatusBadge>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                        <Clock3 className="h-4 w-4" /> {formatTime(event.createdAt)}
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">{event.protocol || 'system'}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{event.amountUsd ? `$${event.amountUsd}` : 'System event'}</div>
                  <div className="mt-1.5 text-sm text-white">{event.reason || 'No reason captured.'}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      </ViewportFit>
    </AppShell>
  )
}
