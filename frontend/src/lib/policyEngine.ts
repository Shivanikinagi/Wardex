export type SourceType = 'twitter'

export type ActionType = 'swap' | 'buy' | 'bridge'
export type Verdict = 'safe' | 'risky' | 'blocked' | 'downsized'

export interface BlinkDraft {
  title: string
  source: SourceType
  action: ActionType
  tokenIn: string
  tokenOut: string
  amount: number
  protocol: string
  chain: string
  referralTag?: string
  tweetCopy?: string
}

export interface TradingPolicy {
  persona: 'conservative' | 'balanced' | 'aggressive'
  maxTradeUsd: number
  maxSlippageBps: number
  trustedProtocolsOnly: boolean
  blockMemeCoins: boolean
  blockUnknownTokens: boolean
  allowLowLiquidityAssets: boolean
  trustedProtocols: string[]
  sourceLimits: Record<string, number>
}

export interface PolicyAnalysis {
  status: Verdict
  score: number
  reasons: string[]
  originalAmount?: number
  safeAmount?: number
  mockedSlippageBps: number
  mockedLiquidityUsd: number
  tokenCategory: string
  sourceLimit: number
}

export const TOKEN_CATEGORIES: Record<string, string> = {
  ETH: 'blue-chip',
  BTC: 'blue-chip',
  SOL: 'blue-chip',
  USDC: 'stable',
  USDT: 'stable',
  APE: 'medium-risk',
  MEME: 'meme',
  DOGEAI: 'meme',
  RANDOMX: 'unknown',
}

export const TRUSTED_PROTOCOLS = ['Uniswap', '1inch', 'Aave']
export const CHAIN_OPTIONS = ['Base', 'Ethereum', 'Arbitrum']
export const ACTION_OPTIONS: ActionType[] = ['swap', 'buy', 'bridge']
export const SOURCE_OPTIONS: SourceType[] = ['twitter']

export const PERSONA_PRESETS: Record<TradingPolicy['persona'], TradingPolicy> = {
  conservative: {
    persona: 'conservative',
    maxTradeUsd: 300,
    maxSlippageBps: 75,
    trustedProtocolsOnly: true,
    blockMemeCoins: true,
    blockUnknownTokens: true,
    allowLowLiquidityAssets: false,
    trustedProtocols: TRUSTED_PROTOCOLS,
    sourceLimits: {
      twitter: 300,
    },
  },
  balanced: {
    persona: 'balanced',
    maxTradeUsd: 800,
    maxSlippageBps: 125,
    trustedProtocolsOnly: true,
    blockMemeCoins: true,
    blockUnknownTokens: true,
    allowLowLiquidityAssets: false,
    trustedProtocols: TRUSTED_PROTOCOLS,
    sourceLimits: {
      twitter: 300,
    },
  },
  aggressive: {
    persona: 'aggressive',
    maxTradeUsd: 2000,
    maxSlippageBps: 250,
    trustedProtocolsOnly: false,
    blockMemeCoins: false,
    blockUnknownTokens: false,
    allowLowLiquidityAssets: true,
    trustedProtocols: TRUSTED_PROTOCOLS,
    sourceLimits: {
      twitter: 900,
    },
  },
}

const SOURCE_WEIGHT: Record<string, number> = {
  twitter: 10,
}

export function getTokenCategory(symbol: string) {
  return TOKEN_CATEGORIES[String(symbol || '').toUpperCase()] || 'unknown'
}

export function titleizeSource(source: string) {
  return String(source || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function normalizePolicy(policy?: Partial<TradingPolicy>): TradingPolicy {
  const preset = PERSONA_PRESETS[(policy?.persona as TradingPolicy['persona']) || 'balanced']
  return {
    ...preset,
    ...policy,
    maxTradeUsd: Number(policy?.maxTradeUsd ?? preset.maxTradeUsd),
    maxSlippageBps: Number(policy?.maxSlippageBps ?? preset.maxSlippageBps),
    sourceLimits: {
      ...preset.sourceLimits,
      ...(policy?.sourceLimits || {}),
    },
    trustedProtocols: Array.isArray(policy?.trustedProtocols)
      ? policy!.trustedProtocols.map((item) => String(item))
      : preset.trustedProtocols,
  }
}

export function buildMockedMetrics(blink: BlinkDraft) {
  const tokenCategory = getTokenCategory(blink.tokenOut)
  let mockedSlippageBps = blink.action === 'bridge' ? 80 : 45
  let mockedLiquidityUsd = 2400000

  if (tokenCategory === 'meme') {
    mockedSlippageBps += 140
    mockedLiquidityUsd = 95000
  } else if (tokenCategory === 'unknown') {
    mockedSlippageBps += 110
    mockedLiquidityUsd = 120000
  } else if (tokenCategory === 'medium-risk') {
    mockedSlippageBps += 55
    mockedLiquidityUsd = 420000
  }

  if (blink.source === 'influencer') mockedSlippageBps += 25
  if (blink.source === 'unknown') mockedSlippageBps += 35
  if (blink.amount >= 1000) mockedSlippageBps += 18
  if (blink.protocol.toLowerCase() === 'uniswap' && blink.chain.toLowerCase() === 'base') mockedLiquidityUsd += 300000

  return {
    mockedSlippageBps,
    mockedLiquidityUsd,
    tokenCategory,
  }
}

export function evaluateBlink(blink: BlinkDraft, inputPolicy?: Partial<TradingPolicy>): PolicyAnalysis {
  const policy = normalizePolicy(inputPolicy)
  const reasons: string[] = []
  const { mockedSlippageBps, mockedLiquidityUsd, tokenCategory } = buildMockedMetrics(blink)
  const protocolTrusted = policy.trustedProtocols.some(
    (protocol) => protocol.toLowerCase() === blink.protocol.toLowerCase()
  )
  const sourceLimit = Math.min(policy.maxTradeUsd, policy.sourceLimits[blink.source] ?? policy.maxTradeUsd)
  let safeAmount = blink.amount
  let status: Verdict = 'safe'
  let score = 92 - (SOURCE_WEIGHT[blink.source] || 12)

  if (policy.blockMemeCoins && tokenCategory === 'meme') {
    reasons.push('Blocked because meme coins are disabled in your policy.')
    status = 'blocked'
    score -= 45
  }

  if (policy.blockUnknownTokens && tokenCategory === 'unknown') {
    reasons.push('Blocked because unknown tokens are disabled in your policy.')
    status = 'blocked'
    score -= 38
  }

  if (!protocolTrusted && policy.trustedProtocolsOnly) {
    reasons.push('Blocked because this protocol is not in your trusted protocol list.')
    status = 'blocked'
    score -= 30
  } else if (!protocolTrusted) {
    reasons.push('Risky because the protocol is outside your preferred trusted list.')
    status = status === 'blocked' ? status : 'risky'
    score -= 15
  }

  if ((policy.sourceLimits[blink.source] ?? policy.maxTradeUsd) <= 0) {
    reasons.push(`Blocked because ${titleizeSource(blink.source)} sources are disabled in your policy.`)
    status = 'blocked'
    score -= 40
  }

  if (mockedLiquidityUsd < 150000 && !policy.allowLowLiquidityAssets) {
    reasons.push('Blocked because the asset shows low liquidity for your current policy.')
    status = 'blocked'
    score -= 28
  } else if (mockedLiquidityUsd < 300000) {
    reasons.push('Risky because liquidity is below your preferred threshold.')
    if (status === 'safe') status = 'risky'
    score -= 12
  }

  if (mockedSlippageBps > policy.maxSlippageBps * 1.8) {
    reasons.push('Blocked because projected slippage is far above your allowed threshold.')
    status = 'blocked'
    score -= 30
  } else if (mockedSlippageBps > policy.maxSlippageBps) {
    reasons.push('Risky because projected slippage is above your preferred limit.')
    if (status === 'safe') status = 'risky'
    score -= 15
  }

  if (blink.amount > sourceLimit) {
    if (sourceLimit > 0 && status !== 'blocked') {
      safeAmount = sourceLimit
      reasons.unshift(
        `Trade downsized from $${blink.amount} to $${sourceLimit} based on your ${titleizeSource(blink.source)} max trade policy.`
      )
      status = 'downsized'
      score -= 10
    } else if (status !== 'blocked') {
      reasons.push('Blocked because amount exceeds your maximum trade size.')
      status = 'blocked'
      score -= 25
    }
  }

  if (status === 'safe' && reasons.length === 0) {
    reasons.push('This Blink matches your policy and can proceed.')
  }

  score = Math.max(8, Math.min(score, 99))
  if (status === 'blocked') score = Math.min(score, 42)
  if (status === 'downsized') score = Math.max(60, Math.min(score, 78))
  if (status === 'risky') score = Math.max(50, Math.min(score, 79))
  if (status === 'safe') score = Math.max(80, score)

  return {
    status,
    score,
    reasons,
    originalAmount: blink.amount,
    safeAmount: status === 'downsized' ? safeAmount : undefined,
    mockedSlippageBps,
    mockedLiquidityUsd,
    tokenCategory,
    sourceLimit,
  }
}

export function buildBlinkUrl(baseOrigin: string, blink: BlinkDraft) {
  const url = new URL('/analyze', baseOrigin)
  url.searchParams.set('title', blink.title)
  url.searchParams.set('source', blink.source)
  url.searchParams.set('action', blink.action)
  url.searchParams.set('tokenIn', blink.tokenIn.toUpperCase())
  url.searchParams.set('tokenOut', blink.tokenOut.toUpperCase())
  url.searchParams.set('amountUsd', String(blink.amount))
  url.searchParams.set('protocol', blink.protocol)
  url.searchParams.set('chain', blink.chain)
  if (blink.referralTag) url.searchParams.set('sender', blink.referralTag)
  if (blink.tweetCopy) url.searchParams.set('tweetCopy', blink.tweetCopy)
  return url.toString()
}

export function resolveShareOrigin() {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_SHARE_BASE_URL
  if (configuredOrigin) {
    return String(configuredOrigin).replace(/\/$/, '')
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    if (!/localhost|127\.0\.0\.1/i.test(origin)) {
      return origin
    }
  }

  return 'https://darkagent.app'
}

export function buildTweetText(blink: BlinkDraft) {
  const baseCopy =
    blink.tweetCopy?.trim() ||
    `New ${blink.action} Blink: ${blink.tokenIn.toUpperCase()} -> ${blink.tokenOut.toUpperCase()} on ${blink.protocol}`

  return `${baseCopy}

Source: ${titleizeSource(blink.source)}
Size: $${blink.amount}`
}

export function buildXIntentUrl({ text, url }: { text: string; url: string }) {
  const intent = new URL('https://x.com/intent/tweet')
  intent.searchParams.set('text', text)
  intent.searchParams.set('url', url)
  return intent.toString()
}

export function getBlinkDisplayUrl(blinkUrl: string) {
  try {
    const url = new URL(blinkUrl)
    return `${url.host}${url.pathname}`
  } catch (_error) {
    return blinkUrl
  }
}

export function parseBlinkFromUrl(blinkUrl: string): BlinkDraft {
  try {
    const url = new URL(blinkUrl)
    return parseBlinkFromSearchParams(url.searchParams)
  } catch (_error) {
    return parseBlinkFromSearchParams(new URLSearchParams())
  }
}

export function parseBlinkFromSearchParams(searchParams: URLSearchParams): BlinkDraft {
  return {
    title: searchParams.get('title') || 'Shared trading Blink',
    source: (searchParams.get('source') as SourceType) || 'twitter',
    action: (searchParams.get('action') as ActionType) || 'swap',
    tokenIn: (searchParams.get('tokenIn') || 'USDC').toUpperCase(),
    tokenOut: (searchParams.get('tokenOut') || 'ETH').toUpperCase(),
    amount: Number(searchParams.get('amountUsd') || searchParams.get('amount') || 100),
    protocol: searchParams.get('protocol') || 'Uniswap',
    chain: searchParams.get('chain') || 'Base',
    referralTag: searchParams.get('sender') || '',
    tweetCopy: searchParams.get('tweetCopy') || '',
  }
}
