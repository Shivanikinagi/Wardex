import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Bot, ShieldX, Sparkles, Wallet } from 'lucide-react'
import { ethers } from 'ethers'
import { useWardex } from '../../context/WardexContext'
import { buildBlinkUrl, evaluateBlink, parseBlinkFromSearchParams, parseBlinkFromUrl, titleizeSource } from '../../lib/policyEngine'
import { AppShell, GlowButton, MetricCard, PageHeader, SectionCard, StatusBadge, ViewportFit } from '../../components/wardex/Ui'
import { ExecutionDialog } from '../../components/wardex/ExecutionDialog'

const PROFILE = import.meta.env.VITE_DEFAULT_ENS || 'alice.eth'

async function resolveENS(address) {
  if (!address || !ethers.isAddress(address)) {
    return PROFILE
  }

  const provider = new ethers.JsonRpcProvider(
    import.meta.env.VITE_ENS_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo'
  )

  try {
    const name = await provider.lookupAddress(address)
    return name || address
  } catch {
    return address
  }
}

function mapDecision(decision) {
  if (decision === 'block') return 'blocked'
  if (decision === 'auto-downsize') return 'downsized'
  if (decision === 'allow-with-warning') return 'risky'
  return 'safe'
}

export default function AnalyzeBlinkPage() {
  const { shareId } = useParams()
  const [searchParams] = useSearchParams()
  const { analyzeBlinkUrl, executeBlinkUrl, getShareLink, state, busy } = usewardex()
  const [analysisPayload, setAnalysisPayload] = useState(null)
  const [executionPayload, setExecutionPayload] = useState(null)
  const [analysisError, setAnalysisError] = useState('')
  const [executionOpen, setExecutionOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [resolvedBlinkUrl, setResolvedBlinkUrl] = useState('')
  const [loadingSharedBlink, setLoadingSharedBlink] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [displayName, setDisplayName] = useState(PROFILE)

  const hasQueryBlink = Array.from(searchParams.keys()).length > 0
  const hasBlink = Boolean(shareId || hasQueryBlink)

  useEffect(() => {
    if (!shareId) {
      setResolvedBlinkUrl('')
      return
    }

    let cancelled = false
    setLoadingSharedBlink(true)

    getShareLink(shareId)
      .then((payload) => {
        if (!cancelled) {
          setResolvedBlinkUrl(payload.share?.blinkUrl || '')
          setAnalysisError('')
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setResolvedBlinkUrl('')
          setAnalysisError(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSharedBlink(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [getShareLink, shareId])

  const localBlink = useMemo(() => {
    if (resolvedBlinkUrl) {
      return parseBlinkFromUrl(resolvedBlinkUrl)
    }
    return parseBlinkFromSearchParams(searchParams)
  }, [resolvedBlinkUrl, searchParams])

  const localPolicy = useMemo(() => state?.policies?.find((entry) => entry.ensName === PROFILE)?.stored, [state])
  const localFallback = useMemo(() => evaluateBlink(localBlink, localPolicy), [localBlink, localPolicy])
  const analysisTargetUrl = resolvedBlinkUrl || (hasQueryBlink ? (typeof window !== 'undefined' ? window.location.href : buildBlinkUrl('https://wardex.app', localBlink)) : '')

  useEffect(() => {
    if (!hasBlink || !analysisTargetUrl || loadingSharedBlink) return
    let cancelled = false
    setAnalysisLoading(true)

    analyzeBlinkUrl({ url: analysisTargetUrl, ensName: PROFILE })
      .then((payload) => {
        if (!cancelled) {
          setAnalysisPayload(payload)
          setAnalysisError('')
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAnalysisPayload(null)
          setAnalysisError(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAnalysisLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [analyzeBlinkUrl, analysisTargetUrl, hasBlink, loadingSharedBlink])

  const blink = analysisPayload?.parsedBlink ? { ...localBlink, ...analysisPayload.parsedBlink } : localBlink

  const verdict = analysisPayload
    ? {
        status: mapDecision(analysisPayload.analysis.decision),
        score: Math.max(100 - analysisPayload.analysis.riskScore, 18),
        reasons: analysisPayload.analysis.explanation,
        originalAmount: blink.amountUsd || localBlink.amount,
        safeAmount:
          analysisPayload.analysis.decision === 'auto-downsize'
            ? analysisPayload.analysis.executionAmountUsd
            : undefined,
        mockedSlippageBps: blink.slippageBps || localFallback.mockedSlippageBps,
        mockedLiquidityUsd: blink.liquidityUsd || localFallback.mockedLiquidityUsd,
        tokenCategory: blink.tokenCategory || localFallback.tokenCategory,
        sourceLimit: analysisPayload.analysis.sourceLimitUsd,
        reason: analysisPayload.analysis.summary,
      }
    : localFallback

  useEffect(() => {
    const explicitName = import.meta.env.VITE_TEST_ENS_NAME
    if (explicitName) {
      setDisplayName(explicitName)
      return
    }

    const walletAddress = analysisPayload?.policy?.walletAddress || analysisPayload?.parsedBlink?.sourceName
    resolveENS(walletAddress).then(setDisplayName)
  }, [analysisPayload])

  async function confirmExecution() {
    try {
      setConfirming(true)
      const payload = await executeBlinkUrl({ url: analysisTargetUrl, ensName: PROFILE })
      setExecutionPayload(payload)
    } catch (err) {
      setAnalysisError(err?.message || 'Execution failed')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <AppShell>
      <ViewportFit>
        <>
          <PageHeader
            eyebrow="Analyze Blink"
            title="Analyze a Blink."
            description="Review the verdict and act."
            actions={hasBlink ? <StatusBadge status={verdict.status}>{verdict.status}</StatusBadge> : <StatusBadge status="downsized">Awaiting Blink</StatusBadge>}
          />

          {!hasBlink ? (
            <SectionCard className="mt-6">
              <div className="text-sm text-slate-300">Provide a Blink URL from the Create Blink flow to run a live analysis.</div>
            </SectionCard>
          ) : loadingSharedBlink && !analysisPayload ? (
            <SectionCard className="mt-6">
              <div className="text-sm text-slate-300">Resolving shared Blink...</div>
            </SectionCard>
          ) : (
            <div className="mt-6 grid gap-5 max-w-4xl mx-auto w-full">
              <SectionCard>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-vault-slate">Trade summary</div>
                    <h2 className="mt-3 text-2xl font-semibold text-white">{blink.title || localBlink.title}</h2>
                    <div className="mt-2 text-sm text-slate-400">
                      {titleizeSource(blink.sourceCategory || localBlink.source)} - {blink.tokenIn || localBlink.tokenIn} {'->'} {blink.tokenOut || localBlink.tokenOut}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Policy for: {displayName}</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300">Score {verdict.score}</div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#E1F5EE] px-3 py-2">
                  <span className="text-[11px] font-medium text-[#085041]">
                    Scored by Venice AI · No data retained · Private inference
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <MetricCard label="Source" value={titleizeSource(blink.sourceCategory || localBlink.source)} detail={blink.sourceName || localBlink.referralTag || '@sharedBlink'} />
                  <MetricCard label="Protocol" value={blink.protocol || localBlink.protocol} detail={blink.chain || localBlink.chain} />
                  <MetricCard label="Amount" value={`$${blink.amountUsd || localBlink.amount}`} detail={`Limit: $${verdict.sourceLimit}`} />
                  <MetricCard label="Token category" value={verdict.tokenCategory} detail={`${verdict.mockedSlippageBps} bps slippage`} />
                </div>

                {analysisLoading && (
                  <p className="mt-4 text-xs text-slate-400">
                    Venice is privately scoring this transaction...
                  </p>
                )}

                <p className="mt-4 text-sm text-slate-300">AI analysis: {verdict.reason || 'No reason returned yet.'}</p>
                <p className="mt-1 text-xs text-slate-500">Your trading strategy is never stored or seen by any third party.</p>

                

                {analysisPayload?.rewrittenBlinkUrl && analysisPayload.rewrittenBlinkUrl !== analysisTargetUrl && (
                  <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                    <div className="flex items-center gap-3 text-sky-100">
                      <Sparkles className="h-5 w-5" />
                      <div className="font-medium">Rewritten safe Blink available</div>
                    </div>
                    <div className="mt-3 break-all text-sm text-sky-50/90">{analysisPayload.rewrittenBlinkUrl}</div>
                  </div>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <GlowButton 
                    onClick={() => setExecutionOpen(true)}
                    className="bg-vault-green text-black hover:bg-vault-green/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wallet className="h-4 w-4" /> Continue
                  </GlowButton>
                  <GlowButton as={Link} to="/dashboard" className="border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]">
                    Edit policy
                  </GlowButton>
                </div>
              </SectionCard>


            </div>
          )}

          <ExecutionDialog
            open={executionOpen}
            onOpenChange={setExecutionOpen}
            blink={{
              tokenIn: blink.tokenIn || localBlink.tokenIn,
              tokenOut: blink.tokenOut || localBlink.tokenOut,
              action: blink.action || localBlink.action,
              protocol: blink.protocol || localBlink.protocol,
              chain: blink.chain || localBlink.chain,
            }}
            analysis={verdict}
            execution={executionPayload?.execution || null}
            onConfirm={confirmExecution}
            confirming={confirming || busy}
          />
        </>
      </ViewportFit>
    </AppShell>
  )
}
