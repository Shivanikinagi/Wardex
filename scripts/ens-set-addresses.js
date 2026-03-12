/**
 * ens-set-addresses.js
 *
 * Sets the ETH address records on the live ENS subnames:
 *   trading-agent.dark26.eth → 0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60
 *   data-agent.dark26.eth    → 0xA28FA8e3391f4454F8E555F5A1Ef5ECC7486dF4F
 *
 * This runs on Ethereum SEPOLIA testnet because dark26.eth was registered
 * on Sepolia ENS. You need Sepolia ETH (free from faucets) to pay gas.
 *
 * Usage:
 *   node scripts/ens-set-addresses.js
 */

require('dotenv').config()
const { ethers } = require('ethers')

// ENS Public Resolver ABI (only what we need)
const RESOLVER_ABI = [
    'function setAddr(bytes32 node, address addr) external',
    'function addr(bytes32 node) external view returns (address)',
]

const ENS_REGISTRY_ABI = [
    'function resolver(bytes32 node) external view returns (address)',
    'function setResolver(bytes32 node, address resolver) external',
    'function owner(bytes32 node) external view returns (address)',
]

// ENS Public Resolver on Ethereum Sepolia testnet
const PUBLIC_RESOLVER = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD'

const AGENTS = [
    {
        name: 'trading-agent.dark26.eth',
        address: '0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60',
    },
    {
        name: 'data-agent.dark26.eth',
        address: '0xA28FA8e3391f4454F8E555F5A1Ef5ECC7486dF4F',
    },
]

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'

async function main() {
    const rpc = process.env.ETH_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'
    const provider = new ethers.JsonRpcProvider(rpc)
    const signer   = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

    console.log('═══════════════════════════════════════════════════════════')
    console.log('     ENS Address Records — dark26.eth subnames (Sepolia)')
    console.log('═══════════════════════════════════════════════════════════\n')
    console.log('Signer:  ', await signer.getAddress())
    const balance = await provider.getBalance(signer.address)
    console.log('Balance: ', ethers.formatEther(balance), 'ETH (Sepolia)\n')

    const registry = new ethers.Contract(ENS_REGISTRY, ENS_REGISTRY_ABI, provider)

    for (const agent of AGENTS) {
        console.log(`─── ${agent.name} ───`)
        const node = ethers.namehash(agent.name)

        // Check owner (must be signer to call setResolver)
        const nodeOwner = await registry.owner(node)
        console.log('  Node owner:', nodeOwner)

        // Find the resolver for this name
        let resolverAddr = await registry.resolver(node)

        if (resolverAddr === ethers.ZeroAddress) {
            console.log('  No resolver set — assigning Public Resolver...')
            const tx = await registry.setResolver(node, PUBLIC_RESOLVER)
            console.log('  setResolver TX:', tx.hash)
            await tx.wait()
            resolverAddr = PUBLIC_RESOLVER
            console.log('  ✅ Resolver assigned:', resolverAddr)
        } else {
            console.log('  Resolver:', resolverAddr)
        }

        const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, signer)

        // Check current value
        const current = await resolver.addr(node)
        if (current.toLowerCase() === agent.address.toLowerCase()) {
            console.log('  ✅ Address already correct:', current)
            continue
        }

        console.log('  Current addr:', current || '(not set)')
        console.log('  Setting to: ', agent.address)

        const tx = await resolver.setAddr(node, agent.address)
        console.log('  TX sent:', tx.hash)
        const receipt = await tx.wait()
        console.log('  ✅ Confirmed in block', receipt.blockNumber)
        console.log()
    }

    console.log('\n✅ Done. Verify at:')
    AGENTS.forEach(a => console.log(`  https://app.ens.domains/${a.name}`))
}

main().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})
