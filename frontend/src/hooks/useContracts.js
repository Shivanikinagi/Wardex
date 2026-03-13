import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { DARKAGENT_PROTOCOL_ABI } from '../contracts/abis'

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
    const [isLive, setIsLive] = useState(false)

    const connectMetaMask = useCallback(async () => {
        if (!window.ethereum) {
            setError("MetaMask is not installed.")
            return
        }
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' })
            await switchToBaseSepolia()
            setupProvider()
        } catch (err) {
            console.error(err)
            setError(err.message)
        }
    }, [])

    const setupProvider = useCallback(async () => {
        if (!window.ethereum) return
        try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum)
            const network = await browserProvider.getNetwork()
            const accs = await browserProvider.listAccounts()

            setProvider(browserProvider)
            setChainId(Number(network.chainId))

            if (accs.length > 0) {
                const s = await browserProvider.getSigner()
                setSigner(s)
                setAccount(accs[0].address)
                setConnected(true)

                const config = await loadDeploymentConfig()
                if (config && config.contracts?.DarkAgent) {
                    const darkAgent = new ethers.Contract(
                        config.contracts.DarkAgent,
                        DARKAGENT_PROTOCOL_ABI,
                        s
                    )
                    
                    setContracts({ darkAgent })
                    setIsLive(true)
                }
            } else {
                setConnected(false)
                setIsLive(false)
            }
        } catch (err) {
            console.error("Setup error:", err)
        }
    }, [])

    useEffect(() => {
        setupProvider()
        
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', setupProvider)
            window.ethereum.on('chainChanged', setupProvider)
            return () => {
                window.ethereum.removeListener('accountsChanged', setupProvider)
                window.ethereum.removeListener('chainChanged', setupProvider)
            }
        }
    }, [setupProvider])

    return {
        provider,
        signer,
        contracts,
        account,
        chainId,
        connected,
        error,
        isLive,
        connectMetaMask,
        deploymentConfig,
    }
}
