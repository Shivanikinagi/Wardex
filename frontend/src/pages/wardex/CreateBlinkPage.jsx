import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Sparkles, Twitter } from 'lucide-react'
import { buildMockTweet } from '../../data/demo'
import { useWardex } from '../../context/WardexContext'
import {
  ACTION_OPTIONS,
  buildBlinkUrl,
  buildTweetText,
  buildXIntentUrl,
  CHAIN_OPTIONS,
  resolveShareOrigin,
  SOURCE_OPTIONS,
} from '../../lib/policyEngine'
import { AppShell, GlowButton, Input, Label, PageHeader, SectionCard, Select, Textarea, StatusBadge, ViewportFit } from '../../components/wardex/Ui'
import { TwitterShareDialog } from '../../components/wardex/TwitterShareDialog'

const DEFAULT_ENS = 'alice.eth'
const INITIAL_DRAFT = {
  title: 'Live Blink request',
  source: 'twitter',
  action: 'swap',
  tokenIn: 'USDC',
  tokenOut: 'ETH',
  amount: 100,
  protocol: 'Uniswap',
  chain: 'Base',
  referralTag: '@signal_source',
  tweetCopy: 'Live signal shared for policy review.',
}

export default function CreateBlinkPage() {
  const navigate = useNavigate()
  const { createShareLink, busy } = usewardex()
  const [draft, setDraft] = useState(INITIAL_DRAFT)
  const [generatedRawUrl, setGeneratedRawUrl] = useState('')
  const [shareLink, setShareLink] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [posted, setPosted] = useState(false)
  const [localError, setLocalError] = useState('')

  const shareOrigin = useMemo(() => resolveShareOrigin(), [])
  const rawBlinkUrl = useMemo(() => generatedRawUrl || buildBlinkUrl(shareOrigin, draft), [shareOrigin, draft, generatedRawUrl])
  const cleanShareUrl = useMemo(() => (shareLink ? `${shareOrigin}/analyze/${shareLink.id}` : rawBlinkUrl), [shareLink, shareOrigin, rawBlinkUrl])
  const tweetText = useMemo(() => buildTweetText(draft), [draft])
  const tweet = useMemo(() => buildMockTweet(draft), [draft])
  const intentUrl = useMemo(() => buildXIntentUrl({ text: tweetText, url: cleanShareUrl }), [tweetText, cleanShareUrl])

  function resetShareState() {
    setShareLink(null)
    setPosted(false)
    setLocalError('')
  }

  async function ensureShareLink(nextDraft = draft) {
    const nextRawUrl = buildBlinkUrl(shareOrigin, nextDraft)
    setGeneratedRawUrl(nextRawUrl)
    setLocalError('')

    if (shareLink?.blinkUrl === nextRawUrl) {
      return {
        rawUrl: nextRawUrl,
        share: shareLink,
        shareUrl: `${shareOrigin}/analyze/${shareLink.id}`,
      }
    }

    try {
      const payload = await createShareLink({
        blinkUrl: nextRawUrl,
        ensName: DEFAULT_ENS,
        meta: {
          title: nextDraft.title,
          source: nextDraft.source,
          tokenOut: nextDraft.tokenOut,
        },
      })

      setShareLink(payload.share)
      return {
        rawUrl: nextRawUrl,
        share: payload.share,
        shareUrl: `${shareOrigin}/analyze/${payload.share.id}`,
      }
    } catch (_error) {
      setShareLink(null)
      setLocalError('Using direct Blink link.')
      return {
        rawUrl: nextRawUrl,
        share: null,
        shareUrl: nextRawUrl,
      }
    }
  }

  async function generateBlink() {
    const payload = await ensureShareLink()
    setPosted(false)
    if (payload?.share?.id) {
      navigate(`/analyze/${payload.share.id}`)
    }
  }

  async function openShareDialog() {
    await ensureShareLink()
    setShareOpen(true)
  }

  async function openXComposer() {
    const payload = await ensureShareLink()
    const nextIntentUrl = buildXIntentUrl({ text: tweetText, url: payload.shareUrl })
    const popup = window.open(nextIntentUrl, '_blank', 'noopener,noreferrer')
    if (!popup) {
      window.location.href = nextIntentUrl
      return
    }
    setPosted(true)
  }

  async function openAnalyze() {
    const payload = await ensureShareLink()
    navigate(`/analyze/${payload.share.id}`)
  }

  return (
    <AppShell>
      <ViewportFit>
        <>
          <PageHeader
            eyebrow="Create Blink"
            title="Create a Blink."
            description="Generate, share, or analyze."
            actions={<StatusBadge status="safe">Clean X share</StatusBadge>}
          />

          <SectionCard className="mt-5 mx-auto w-full max-w-5xl overflow-hidden">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Blink title"><Input value={draft.title} onChange={(event) => { setDraft((current) => ({ ...current, title: event.target.value })); resetShareState() }} /></Field>
              <Field label="Source type"><Select value={draft.source} onChange={(event) => { setDraft((current) => ({ ...current, source: event.target.value })); resetShareState() }}>{SOURCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>
              <Field label="Action type"><Select value={draft.action} onChange={(event) => { setDraft((current) => ({ ...current, action: event.target.value })); resetShareState() }}>{ACTION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>
              <Field label="Protocol"><Input value={draft.protocol} onChange={(event) => { setDraft((current) => ({ ...current, protocol: event.target.value })); resetShareState() }} /></Field>
              <Field label="Token in"><Input value={draft.tokenIn} onChange={(event) => { setDraft((current) => ({ ...current, tokenIn: event.target.value.toUpperCase() })); resetShareState() }} /></Field>
              <Field label="Token out"><Input value={draft.tokenOut} onChange={(event) => { setDraft((current) => ({ ...current, tokenOut: event.target.value.toUpperCase() })); resetShareState() }} /></Field>
              <Field label="Amount"><Input value={draft.amount} onChange={(event) => { setDraft((current) => ({ ...current, amount: Number(event.target.value || 0) })); resetShareState() }} /></Field>
              <Field label="Chain"><Select value={draft.chain} onChange={(event) => { setDraft((current) => ({ ...current, chain: event.target.value })); resetShareState() }}>{CHAIN_OPTIONS.map((chain) => <option key={chain} value={chain}>{chain}</option>)}</Select></Field>
              <Field label="Source tag"><Input value={draft.referralTag || ''} onChange={(event) => { setDraft((current) => ({ ...current, referralTag: event.target.value })); resetShareState() }} /></Field>
              <Field label="Tweet copy"><Textarea rows={4} value={draft.tweetCopy || ''} onChange={(event) => { setDraft((current) => ({ ...current, tweetCopy: event.target.value })); resetShareState() }} /></Field>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <GlowButton onClick={generateBlink} className="bg-vault-green text-black hover:bg-vault-green/90" disabled={busy}><Sparkles className="h-4 w-4" /> {busy ? 'Generating...' : 'Generate Blink'}</GlowButton>
              <GlowButton onClick={openShareDialog} className="bg-[#1d9bf0] text-white hover:bg-[#1a8ad4]" disabled={busy}><Twitter className="h-4 w-4" /> Share to X</GlowButton>
              <GlowButton as="button" onClick={openAnalyze} className="border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]" disabled={busy}>Analyze Blink</GlowButton>
            </div>
            {localError && <div className="mt-3 text-xs text-amber-200">{localError}</div>}
          </SectionCard>
        </>
      </ViewportFit>

      <TwitterShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        tweet={tweet}
        blinkUrl={cleanShareUrl}
        displayUrl={cleanShareUrl}
        posted={posted}
        intentUrl={intentUrl}
        onCopy={async () => {
          await navigator.clipboard.writeText(cleanShareUrl)
        }}
        onPost={openXComposer}
      />
    </AppShell>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
