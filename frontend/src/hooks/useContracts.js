import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { DARKAGENT_ABI, CAPABILITY_CHECK_ABI, VERIFIER_ABI, SLIPPAGE_GUARD_ABI, SIGNATURE_VERIFIER_ABI } from '../contracts/abis'

// Dynamically load deployment config (may not exist if not deployed yet)
let deploymentConfig = null
async function loadDeploymentConfig() {
    if (deploymentConfig !== null) return deploymentConfig
    try {
        const mod = await import('../contracts/deployment.json')
        deploymentConfig = mod.default || mod
        return deploymentConfig
    } catch {
        return null
    }
}

const BASE_SEPOLIA_CHAIN_ID = 84532
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

async function switchToBaseSepolia() {
    if (!window.ethereum) return
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + BASE_SEPOLIA_CHAIN_ID.toString(16) }],
        })
    } catch (switchError) {
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x' + BASE_SEPOLIA_CHAIN_ID.toString(16),
                    chainName: 'Base Sepolia',
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: [BASE_SEPOLIA_RPC],
                    blockExplorerUrls: ['https://sepolia.basescan.org'],
                }],
            })
        }
    }
}

export function useContracts() {
    const [provider, setProvider] = useState(null)
    const [signer, setSigner] = useState(null)
    const [contracts, setContracts] = useState(null)
    const [account, setAccount] = useState(null)
    const [chainId, setChainId] = useState(null)
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState(null)
    const [config, setConfig] = useState(null)
    const [connecting, setConnecting] = useState(false)

    // Internal setup — takes an already-granted accounts array (no popup)
    const setupProvider = useCallback(async (cfg) => {
        const web3Provider = new ethers.BrowserProvider(window.ethereum)
        const network = await web3Provider.getNetwork()
        const currentChainId = Number(network.chainId)
        setChainId(currentChainId)

        if (currentChainId !== BASE_SEPOLIA_CHAIN_ID) {
            setError(`Please switch to Base Sepolia (chain ${BASE_SEPOLIA_CHAIN_ID}). Current: ${currentChainId}`)
            return false
        }

        const currentSigner = await web3Provider.getSigner()
        const address = await currentSigner.getAddress()
        setProvider(web3Provider)
        setSigner(currentSigner)
        setAccount(address)

        if (cfg?.contracts) {
            const contractInstances = {
                darkAgent: new ethers.Contract(cfg.contracts.DarkAgent, DARKAGENT_ABI, currentSigner),
                capabilityCheck: new ethers.Contract(cfg.contracts.CapabilityCheck, CAPABILITY_CHECK_ABI, currentSigner),
                verifier: new ethers.Contract(cfg.contracts.Verifier, VERIFIER_ABI, currentSigner),
            }
            if (cfg.contracts.SlippageGuard) {
                contractInstances.slippageGuard = new ethers.Contract(cfg.contracts.SlippageGuard, SLIPPAGE_GUARD_ABI, currentSigner)
            }
            if (cfg.contracts.SignatureVerifier) {
                contractInstances.signatureVerifier = new ethers.Contract(cfg.contracts.SignatureVerifier, SIGNATURE_VERIFIER_ABI, currentSigner)
            }
            setContracts(contractInstances)
        }

        setConnected(true)
        setError(null)
        return true
    }, [])

    // On mount: silently check if already connected (no popup)
    useEffect(() => {
        if (typeof window === 'undefined' || !window.ethereum) return
        let cancelled = false
        ;(async () => {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' })
                if (cancelled || accounts.length === 0) return
                const cfg = await loadDeploymentConfig()
                if (cancelled) return
                setConfig(cfg)
                await setupProvider(cfg)

                window.ethereum.on('chainChanged', () => window.location.reload())
                window.ethereum.on('accountsChanged', (accs) => {
                    if (accs.length === 0) window.location.reload()
                    else window.location.reload()
                })
            } catch {
                // Silent — user just hasn't connected yet
            }
        })()
        return () => { cancelled = true }
    }, [setupProvider])

    // Explicit connect — called by user clicking button
    const connect = useCallback(async () => {
        if (connecting) return false   // prevent double-click spam
        if (typeof window === 'undefined' || !window.ethereum) {
            setError('Please install MetaMask to use DarkAgent')
            return false
        }
        setConnecting(true)
        setError(null)
        try {
            const cfg = await loadDeploymentConfig()
            setConfig(cfg)

            await window.ethereum.request({ method: 'eth_requestAccounts' })
            await switchToBaseSepolia()
            const ok = await setupProvider(cfg)

            if (ok) {
                window.ethereum.on('chainChanged', () => window.location.reload())
                window.ethereum.on('accountsChanged', () => window.location.reload())
            }
            return ok
        } catch (err) {
            // code -32002 = request already pending (MetaMask popup already open)
            if (err.code === -32002) {
                setError('MetaMask is already waiting for your approval. Please open MetaMask.')
            } else {
                setError(err.message)
            }
            return false
        } finally {
            setConnecting(false)
        }
    }, [connecting, setupProvider])

    return {
        provider,
        signer,
        contracts,
        account,
        chainId,
        connected,
        connecting,
        error,
        connect,
        config,
        isLive: connected && contracts !== null,
    }
}

// Fetch all agents from the contract
export async function fetchAgents(contracts, config) {
    if (!contracts?.darkAgent) return null
    try {
        const addresses = await contracts.darkAgent.getAllAgents()
        const agents = []

        for (const addr of addresses) {
            const data = await contracts.darkAgent.getAgent(addr)
            const spending = await contracts.darkAgent.getSpendingInfo(addr)
            agents.push({
                address: addr,
                owner: data[0],
                ensName: data[1],
                capabilityHash: data[2],
                capabilities: [...data[3]],
                reputationScore: Number(data[4]),
                status: ['INACTIVE', 'ACTIVE', 'FROZEN', 'SUSPENDED'][Number(data[5])],
                attestationHash: data[6],
                attestationTime: Number(data[7]),
                registeredAt: Number(data[8]),
                attestationValid: data[6] !== ethers.ZeroHash,
                dailySpent: ethers.formatEther(spending[0]),
                maxPerTx: ethers.formatEther(spending[1]),
                maxPerDay: ethers.formatEther(spending[2]),
                alertThreshold: ethers.formatEther(spending[3]),
            })
        }
        return agents
    } catch (err) {
        console.error('fetchAgents error:', err)
        return null
    }
}

// Register a new agent
export async function registerAgent(contracts, { name, capabilities, maxPerTx, maxPerDay, alertThreshold }) {
    if (!contracts?.darkAgent) throw new Error('Not connected')

    const agentWallet = ethers.Wallet.createRandom()
    const ensName = `${name}.darkagent.eth`

    const tx = await contracts.darkAgent.registerAgent(
        agentWallet.address,
        ensName,
        capabilities,
        ethers.parseEther(maxPerTx),
        ethers.parseEther(maxPerDay),
        ethers.parseEther(alertThreshold)
    )
    const receipt = await tx.wait()

    // Grant capabilities
    if (contracts.capabilityCheck) {
        const capTx = await contracts.capabilityCheck.grantCapabilities(agentWallet.address, capabilities)
        await capTx.wait()
    }

    // Set initial attestation
    const attestationHash = ethers.keccak256(
        ethers.toUtf8Bytes(`darkagent-attestation-${name}-${Date.now()}`)
    )
    const attTx = await contracts.darkAgent.updateAttestation(agentWallet.address, attestationHash)
    await attTx.wait()

    return {
        address: agentWallet.address,
        ensName,
        capabilities,
        attestationHash,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
    }
}

// Fire circuit breaker
export async function fireCircuitBreakerOnChain(contracts, agentAddress, reason) {
    if (!contracts?.darkAgent) throw new Error('Not connected')
    const invalidHash = ethers.keccak256(ethers.toUtf8Bytes('TAMPERED-' + Date.now()))
    const tx = await contracts.darkAgent.fireCircuitBreaker(agentAddress, reason, invalidHash)
    const receipt = await tx.wait()
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber }
}

// Unfreeze agent
export async function unfreezeAgentOnChain(contracts, agentAddress) {
    if (!contracts?.darkAgent) throw new Error('Not connected')
    const newAttestation = ethers.keccak256(ethers.toUtf8Bytes('new-valid-attestation-' + Date.now()))
    const tx = await contracts.darkAgent.unfreezeAgent(agentAddress, newAttestation)
    const receipt = await tx.wait()
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber }
}

// Query compliance
export async function queryComplianceOnChain(contracts, agentAddress) {
    if (!contracts?.darkAgent) throw new Error('Not connected')
    const [compliant, totalProofs] = await contracts.darkAgent.queryCompliance(agentAddress)

    let verifierStatus = null
    if (contracts.verifier) {
        try {
            verifierStatus = await contracts.verifier.getComplianceStatus(agentAddress)
        } catch { /* verifier may not have data */ }
    }

    return {
        compliant,
        totalProofs: Number(totalProofs),
        verifiedProofs: verifierStatus ? Number(verifierStatus.verifiedProofs) : Number(totalProofs),
        failedProofs: verifierStatus ? Number(verifierStatus.failedProofs) : 0,
    }
}

// Submit compliance proof via Verifier
export async function submitProofOnChain(contracts, agentAddress, proofType, publicInputs) {
    if (!contracts?.verifier) throw new Error('Not connected')
    const proofData = ethers.toUtf8Bytes(`darkagent-proof-${proofType}-${Date.now()}`)
    const tx = await contracts.verifier.submitAndVerifyProof(agentAddress, proofData, proofType, publicInputs)
    const receipt = await tx.wait()
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber }
}
