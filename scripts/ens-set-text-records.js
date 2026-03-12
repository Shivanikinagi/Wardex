/**
 * ens-set-text-records.js
 *
 * Sets ENS text records on dark26.eth subnames to advertise
 * agent capabilities, spending limits, and status on-chain.
 *
 * Text records set per agent:
 *   - capability      → comma-separated capabilities
 *   - max_spend       → daily spending limit in ETH
 *   - allowed_tokens  → ETH,USDC,WETH
 *   - status          → active | frozen
 *   - owner           → owner wallet address
 *   - project         → darkagent
 *   - url             → dashboard URL
 *   - description     → human-readable description
 *   - mev_protection  → true | false (route through Flashbots)
 *   - slippage        → max slippage in BPS (e.g., "50" = 0.5%)
 *   - delegation      → comma-separated delegate addresses for Permit2
 *
 * Runs on Ethereum Sepolia testnet (ENS lives on L1).
 *
 * Usage:
 *   node scripts/ens-set-text-records.js
 */

require('dotenv').config()
const { ethers } = require('ethers')

// ENS Public Resolver ABI — setText + text
const RESOLVER_ABI = [
  'function setText(bytes32 node, string key, string value) external',
  'function text(bytes32 node, string key) external view returns (string)',
  'function setAddr(bytes32 node, address addr) external',
  'function addr(bytes32 node) external view returns (address)',
]

const ENS_REGISTRY_ABI = [
  'function resolver(bytes32 node) external view returns (address)',
  'function owner(bytes32 node) external view returns (address)',
]

const PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD'
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'

const AGENTS = [
  {
    name: 'trading-agent.dark26.eth',
    address: '0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60',
    records: {
      capability: 'yield-farming,token-swap,payment',
      max_spend: '0.1',
      allowed_tokens: 'ETH,USDC,WETH',
      status: 'active',
      owner: process.env.OWNER_ADDRESS || '0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60',
      project: 'darkagent',
      url: 'https://darkagent.xyz/dashboard',
      description: 'DarkAgent trading agent — yield farming, swaps, and payments with on-chain spending controls',
      mev_protection: 'true',
      slippage: '50',
      delegation: process.env.OWNER_ADDRESS || '0x6B845996450ecf86cC2CBc4b92C69d37F87f42d4',
    },
  },
  {
    name: 'data-agent.dark26.eth',
    address: '0xA28FA8e3391f4454F8E555F5A1Ef5ECC7486dF4F',
    records: {
      capability: 'data-analysis,reporting,payment',
      max_spend: '0.05',
      allowed_tokens: 'ETH,USDC',
      status: 'active',
      owner: process.env.OWNER_ADDRESS || '0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60',
      project: 'darkagent',
      url: 'https://darkagent.xyz/dashboard',
      description: 'DarkAgent data agent — on-chain analytics, compliance reporting, and payment processing',
      mev_protection: 'false',
      slippage: '100',
      delegation: process.env.OWNER_ADDRESS || '0x6B845996450ecf86cC2CBc4b92C69d37F87f42d4',
    },
  },
]

async function main() {
  const rpc = process.env.ETH_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'
  const provider = new ethers.JsonRpcProvider(rpc)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  console.log('═══════════════════════════════════════════════════════════')
  console.log('     ENS Text Records — dark26.eth subnames (Sepolia)')
  console.log('═══════════════════════════════════════════════════════════\n')
  console.log('Signer: ', await signer.getAddress())
  const balance = await provider.getBalance(signer.address)
  console.log('Balance:', ethers.formatEther(balance), 'ETH (Sepolia)\n')

  const registry = new ethers.Contract(ENS_REGISTRY, ENS_REGISTRY_ABI, provider)

  for (const agent of AGENTS) {
    console.log(`─── ${agent.name} ───`)
    const node = ethers.namehash(agent.name)

    // Verify resolver is set
    const resolverAddr = await registry.resolver(node)
    if (resolverAddr === ethers.ZeroAddress) {
      console.log('  ⚠️ No resolver set. Run ens-set-addresses.js first.')
      continue
    }

    console.log('  Resolver:', resolverAddr)
    const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, signer)

    // Set each text record
    for (const [key, value] of Object.entries(agent.records)) {
      // Check current value
      const current = await resolver.text(node, key)
      if (current === value) {
        console.log(`  ✅ ${key} = "${value}" (already set)`)
        continue
      }

      console.log(`  📝 Setting ${key} = "${value}"`)
      const tx = await resolver.setText(node, key, value)
      console.log(`     TX: ${tx.hash}`)
      await tx.wait()
      console.log(`     ✅ Confirmed`)
    }

    console.log()
  }

  // Verify
  console.log('\n═══ Verification ═══\n')
  for (const agent of AGENTS) {
    const node = ethers.namehash(agent.name)
    const resolverAddr = await registry.resolver(node)
    const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, provider)

    console.log(`${agent.name}:`)
    for (const key of Object.keys(agent.records)) {
      const val = await resolver.text(node, key)
      console.log(`  ${key}: ${val || '(not set)'}`)
    }
    console.log()
  }

  console.log('✅ Done. View on ENS:')
  AGENTS.forEach(a => console.log(`  https://app.ens.domains/${a.name}`))
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
