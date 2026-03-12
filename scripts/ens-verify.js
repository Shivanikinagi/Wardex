/**
 * ens-verify.js
 *
 * Resolves dark26.eth subnames on Ethereum mainnet and confirms they
 * point to the correct Base Sepolia agent wallet addresses.
 *
 * Usage:
 *   node scripts/ens-verify.js
 */

require('dotenv').config()
const { ethers } = require('ethers')

const RESOLVER_ABI = [
    'function addr(bytes32 node) external view returns (address)',
    'function text(bytes32 node, string key) external view returns (string)',
]
const ENS_REGISTRY_ABI = [
    'function resolver(bytes32 node) external view returns (address)',
]

const AGENTS = [
    {
        name: 'trading-agent.dark26.eth',
        expected: '0x4B02abfffd2f4a0De9bdf0Ea3Eb73271014EFb60',
    },
    {
        name: 'data-agent.dark26.eth',
        expected: '0xA28FA8e3391f4454F8E555F5A1Ef5ECC7486dF4F',
    },
]

const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'

async function main() {
    const rpc = process.env.ETH_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'
    const provider = new ethers.JsonRpcProvider(rpc)
    const registry = new ethers.Contract(ENS_REGISTRY, ENS_REGISTRY_ABI, provider)

    console.log('═══════════════════════════════════════════════════════════')
    console.log('     ENS Verification — dark26.eth subnames (Sepolia)')
    console.log('═══════════════════════════════════════════════════════════\n')

    let allPass = true

    for (const agent of AGENTS) {
        console.log(`Checking: ${agent.name}`)
        const node = ethers.namehash(agent.name)

        // Resolver
        const resolverAddr = await registry.resolver(node)
        if (resolverAddr === ethers.ZeroAddress) {
            console.log('  ❌ FAIL — no resolver assigned\n')
            allPass = false
            continue
        }
        console.log('  Resolver:', resolverAddr)

        const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, provider)

        // ETH address
        let resolved
        try {
            resolved = await resolver.addr(node)
        } catch {
            console.log('  ❌ FAIL — addr() call reverted (record not set)\n')
            allPass = false
            continue
        }

        const match = resolved.toLowerCase() === agent.expected.toLowerCase()
        if (match) {
            console.log('  ✅ PASS — resolves to', resolved)
        } else {
            console.log('  ❌ FAIL — resolves to ', resolved)
            console.log('           expected     ', agent.expected)
            allPass = false
        }
        console.log()
    }

    console.log('══════════════════════════')
    if (allPass) {
        console.log('✅ All ENS records verified')
    } else {
        console.log('❌ Some records need attention')
        console.log('\nTo fix: run  node scripts/ens-set-addresses.js')
        console.log('Or manually: https://app.ens.domains')
        process.exit(1)
    }
}

main().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})
