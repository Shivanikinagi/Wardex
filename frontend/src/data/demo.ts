import { buildTweetText, type BlinkDraft } from '../lib/policyEngine'

export const demoBlinks: BlinkDraft[] = [
  {
    title: 'AI ETH rebalance',
    source: 'twitter',
    action: 'swap',
    tokenIn: 'USDC',
    tokenOut: 'ETH',
    amount: 100,
    protocol: 'Uniswap',
    chain: 'Base',
    referralTag: '@DeepTrendBot',
    tweetCopy: 'Base rotation alert: moving into ETH strength.',
  },
  {
    title: 'Influencer meme call',
    source: 'twitter',
    action: 'buy',
    tokenIn: 'USDC',
    tokenOut: 'MEME',
    amount: 1000,
    protocol: 'Uniswap',
    chain: 'Base',
    referralTag: '@MoonAlphaX',
    tweetCopy: 'Base meme call is live. Size in if you dare.',
  },
  {
    title: 'AI size too large on Base',
    source: 'twitter',
    action: 'swap',
    tokenIn: 'USDC',
    tokenOut: 'ETH',
    amount: 800,
    protocol: 'Uniswap',
    chain: 'Base',
    referralTag: '@DeepTrendBot',
    tweetCopy: 'Momentum confirmed on Base, scaling the position.',
  },
]

export const featureHighlights = [
  {
    title: 'Source-aware firewall',
    body: 'DarkAgent scores every Blink differently depending on whether it came from Twitter.',
  },
  {
    title: 'Auto-downsize oversized trades',
    body: 'When a Blink is acceptable in principle but too large for the user, DarkAgent rewrites it to a safe size instead of forcing a hard reject.',
  },
  {
    title: 'Explain every decision',
    body: 'Safe, Risky, Blocked, and Downsized verdicts all come with human-readable reasons so users know exactly what happened.',
  },
]

export const productPrinciples = [
  'Built for social trading and AI trading, not generic wallet monitoring.',
  'Designed to make Blink risk obvious in under 15 seconds.',
  'Optimized for a crisp 2-minute hackathon demo with strong visuals and policy changes live.',
]

export function buildMockTweet(blink: BlinkDraft) {
  return {
    avatar: blink.source === 'twitter' ? 'DA' : 'MX',
    handle: blink.referralTag || '@darkagent_demo',
    name: blink.source === 'twitter' ? 'DarkAgent Signals' : 'Social Trading Feed',
    copy: buildTweetText(blink),
  }
}
