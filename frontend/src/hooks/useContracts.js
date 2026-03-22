import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { wardex_PROTOCOL_ABI, PERMISSIONS_ABI } from '../contracts/abis'

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

function getAddressFromEnv(key) {
    const value = import.meta.env[key]
    return getUsableAddress(value)
}

function getUsableAddress(address) {
    if (!address || !ethers.isAddress(address)) return null
    if (address === ethers.ZeroAddress) return null
    return address
}

function getInjectedProvider() {
    if (typeof window === 'undefined') return null
    const eth = window.ethereum
    if (!eth) return null

    if (Array.isArray(eth.providers) && eth.providers.length > 0) {
        const metamaskProvider = eth.providers.find((p) => p?.isMetaMask)
        return metamaskProvider || eth.providers[0]
    }

    return eth
}

async function switchToBaseSepolia(injectedProvider) {
    const provider = injectedProvider || getInjectedProvider()
    if (!provider) return
    try {
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + BASE_SEPOLIA_CHAIN_ID.toString(16) }],
        })
    } catch (switchError) {
        if (switchError.code === 4902) {
            await provider.request({
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

    const setupProvider = useCallback(async (injectedProvider = null) => {
        const selectedProvider = injectedProvider || getInjectedProvider()
        if (!selectedProvider) return
        try {
            const browserProvider = new ethers.BrowserProvider(selectedProvider)
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
                const wardexAddress =
                    getAddressFromEnv('VITE_wardex_CONTRACT') ||
                    getUsableAddress(config?.contracts?.wardex)
                const permissionsAddress =
                    getAddressFromEnv('VITE_CAPABILITY_CONTRACT') ||
                    getUsableAddress(config?.contracts?.CapabilityCheck) ||
                    getUsableAddress(config?.contracts?.Permissions)

                if (wardexAddress) {
                    const wardex = new ethers.Contract(
                        wardexAddress,
                        wardex_PROTOCOL_ABI,
                        s
                    )

                    const permissionsContract = permissionsAddress
                        ? new ethers.Contract(
                            permissionsAddress,
                            PERMISSIONS_ABI,
                            s
                        )
                        : null
                    
                    setContracts({ wardex, permissionsContract })
                    setIsLive(true)
                    setError(
                        permissionsAddress
                            ? null
                            : 'Permissions contract is not deployed in deployment.json; permissions features are disabled.'
                    )
                } else {
                    setContracts(null)
                    setIsLive(false)
                    setError('wardex contract is missing or invalid in deployment.json.')
                }
            } else {
                setConnected(false)
                setIsLive(false)
                setContracts(null)
            }
        } catch (err) {
            console.error("Setup error:", err)
            setError(err.message)
        }
    }, [])

    const connectMetaMask = useCallback(async () => {
        const selectedProvider = getInjectedProvider()
        if (!selectedProvider) {
            setError('No injected wallet found. Please install MetaMask.')
            return
        }
        try {
            await selectedProvider.request({ method: 'eth_requestAccounts' })
            await switchToBaseSepolia(selectedProvider)
            await setupProvider(selectedProvider)
        } catch (err) {
            console.error(err)
            if (err?.message?.includes('already pending')) {
                setError('Connection request already pending. Please open MetaMask.')
            } else {
                setError(err.message)
            }
        }
    }, [setupProvider])

    useEffect(() => {
        setupProvider()

        const selectedProvider = getInjectedProvider()
        if (selectedProvider) {
            const syncProviderState = () => setupProvider(selectedProvider)
            selectedProvider.on('accountsChanged', syncProviderState)
            selectedProvider.on('chainChanged', syncProviderState)
            return () => {
                selectedProvider.removeListener('accountsChanged', syncProviderState)
                selectedProvider.removeListener('chainChanged', syncProviderState)
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
