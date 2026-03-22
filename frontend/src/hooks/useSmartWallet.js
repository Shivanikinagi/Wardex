/**
 * useSmartWallet Hook
 *
 * React hook for interacting with Coinbase Smart Wallet through the
 * wardex CoinbaseSmartWalletAgent contract. Provides wallet registration,
 * agent authorization, execution, and emergency controls.
 */

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { parseEther } from "viem";

// Contract ABIs
const WALLET_AGENT_ABI = [
  {
    name: "registerWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "smartWallet", type: "address" }],
    outputs: [],
  },
  {
    name: "createAndRegisterWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "nonce", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "predictWalletAddress",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "authorizeAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "spendLimit", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "revokeAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
  },
  {
    name: "freezeWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "reason", type: "string" }],
    outputs: [],
  },
  {
    name: "unfreezeWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "getWalletInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "smartWallet", type: "address" },
          { name: "owner", type: "address" },
          { name: "frozen", type: "bool" },
          { name: "registeredAt", type: "uint256" },
          { name: "totalExecutions", type: "uint256" },
          { name: "totalSpent", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getAgentAuth",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "agent", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "authorized", type: "bool" },
          { name: "spendLimit", type: "uint256" },
          { name: "dailyLimit", type: "uint256" },
          { name: "dailySpent", type: "uint256" },
          { name: "lastResetDay", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "allowedMethods", type: "string[]" },
        ],
      },
    ],
  },
  {
    name: "isAgentAuthorized",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "agent", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getRemainingDailyAllowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "agent", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getProtocolStats",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "totalWallets", type: "uint256" },
      { name: "totalExecutions", type: "uint256" },
    ],
  },
  {
    name: "createSessionKey",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "address" },
      { name: "duration", type: "uint256" },
      { name: "spendLimit", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getSessionKeys",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "key", type: "address" },
          { name: "expiresAt", type: "uint256" },
          { name: "spendLimit", type: "uint256" },
          { name: "spent", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "updateSpendingLimits",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "newSpendLimit", type: "uint256" },
      { name: "newDailyLimit", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "dispatchAction",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },
];

const SMART_WALLET_ABI = [
  {
    name: "isOwnerAddress",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "ownerCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "entryPoint",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "implementation",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
];

// Default contract address (updated after deployment)
const DEFAULT_WALLET_AGENT_ADDRESS =
  "0x0000000000000000000000000000000000000000";

export function useSmartWallet() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectAsync, connectors, error: connectError, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [walletInfo, setWalletInfo] = useState(null);
  const [isSmartWallet, setIsSmartWallet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletAgentAddress, setWalletAgentAddress] = useState(
    DEFAULT_WALLET_AGENT_ADDRESS,
  );
  const [protocolStats, setProtocolStats] = useState({
    totalWallets: 0,
    totalExecutions: 0,
  });

  // Propagate wagmi connect errors to local error state
  useEffect(() => {
    if (connectError) {
      console.error("Wagmi connect error:", connectError);
      setError(connectError.message || "Wallet connection failed");
    }
  }, [connectError]);

  // Load deployment config
  useEffect(() => {
    async function loadConfig() {
      try {
        const mod = await import("../contracts/deployment.json");
        const config = mod.default || mod;
        if (config.contracts?.CoinbaseSmartWalletAgent) {
          setWalletAgentAddress(config.contracts.CoinbaseSmartWalletAgent);
        }
      } catch {
        console.log("No deployment config found for smart wallet");
      }
    }
    loadConfig();
  }, []);

  // Detect if connected wallet is a Coinbase Smart Wallet
  useEffect(() => {
    if (isConnected && connector) {
      const isCoinbase =
        connector.id === "coinbaseWalletSDK" ||
        connector.id === "coinbaseWallet" ||
        connector.name?.toLowerCase().includes("coinbase");
      setIsSmartWallet(isCoinbase);
    }
  }, [isConnected, connector]);

  // Load wallet info when connected
  useEffect(() => {
    if (
      isConnected &&
      address &&
      publicClient &&
      walletAgentAddress !== DEFAULT_WALLET_AGENT_ADDRESS
    ) {
      loadWalletInfo();
      loadProtocolStats();
    }
  }, [isConnected, address, publicClient, walletAgentAddress]);

  /**
   * Connect using Coinbase Smart Wallet
   */
  const connectSmartWallet = useCallback(async () => {
    setError(null);
    try {
      // Find Coinbase connector for Smart Wallet
      let connector = connectors.find((c) => c.id === "coinbaseWalletSDK" || c.id === "coinbaseWallet" || c.name?.toLowerCase().includes("coinbase"));
      
      // Fallback
      if (!connector && connectors.length > 0) {
        connector = connectors[0];
      }

      if (connector) {
        console.log("[wardex] Connecting with connector:", connector.id, connector.name);
        await connectAsync({ connector });
        console.log("[wardex] Connection successful");
      } else {
        const msg = "No wallet connectors available. Please refresh the page.";
        console.error(msg, "Available connectors:", connectors);
        setError(msg);
      }
    } catch (err) {
      console.error("[wardex] Connect wallet error:", err);
      setError(err.shortMessage || err.message || "Wallet connection failed");
    }
  }, [connectAsync, connectors]);

  /**
   * Disconnect the wallet
   */
  const disconnectWallet = useCallback(() => {
    disconnect();
    setWalletInfo(null);
    setIsSmartWallet(false);
  }, [disconnect]);

  /**
   * Load wallet registration info from the contract
   */
  const loadWalletInfo = useCallback(async () => {
    if (
      !address ||
      !publicClient ||
      walletAgentAddress === DEFAULT_WALLET_AGENT_ADDRESS
    )
      return;

    try {
      const data = await publicClient.readContract({
        address: walletAgentAddress,
        abi: WALLET_AGENT_ABI,
        functionName: "getWalletInfo",
        args: [address],
      });

      if (data.smartWallet !== "0x0000000000000000000000000000000000000000") {
        setWalletInfo({
          smartWallet: data.smartWallet,
          owner: data.owner,
          frozen: data.frozen,
          registeredAt: Number(data.registeredAt),
          totalExecutions: Number(data.totalExecutions),
          totalSpent: data.totalSpent,
        });
      }
    } catch (err) {
      console.log("Wallet not registered yet:", err.message);
    }
  }, [address, publicClient, walletAgentAddress]);

  /**
   * Load protocol statistics
   */
  const loadProtocolStats = useCallback(async () => {
    if (!publicClient || walletAgentAddress === DEFAULT_WALLET_AGENT_ADDRESS)
      return;

    try {
      const data = await publicClient.readContract({
        address: walletAgentAddress,
        abi: WALLET_AGENT_ABI,
        functionName: "getProtocolStats",
      });
      setProtocolStats({
        totalWallets: Number(data[0]),
        totalExecutions: Number(data[1]),
      });
    } catch (err) {
      console.log("Could not load protocol stats:", err.message);
    }
  }, [publicClient, walletAgentAddress]);

  /**
   * Register the connected smart wallet with wardex
   */
  const registerWallet = useCallback(
    async (smartWalletAddress) => {
      if (!walletClient || !address) throw new Error("Not connected");
      setLoading(true);
      setError(null);

      try {
        const hash = await walletClient.writeContract({
          address: walletAgentAddress,
          abi: WALLET_AGENT_ABI,
          functionName: "registerWallet",
          args: [smartWalletAddress || address],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        await loadWalletInfo();
        setLoading(false);
        return receipt;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
    },
    [walletClient, address, publicClient, walletAgentAddress, loadWalletInfo],
  );

  /**
   * Authorize an AI agent
   */
  const authorizeAgent = useCallback(
    async (agentAddress, spendLimitEth, dailyLimitEth, durationDays) => {
      if (!walletClient || !address) throw new Error("Not connected");
      setLoading(true);
      setError(null);

      try {
        const hash = await walletClient.writeContract({
          address: walletAgentAddress,
          abi: WALLET_AGENT_ABI,
          functionName: "authorizeAgent",
          args: [
            agentAddress,
            parseEther(spendLimitEth || "1"),
            parseEther(dailyLimitEth || "10"),
            BigInt((durationDays || 30) * 86400),
          ],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setLoading(false);
        return receipt;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
    },
    [walletClient, address, publicClient, walletAgentAddress],
  );

  /**
   * Revoke an agent
   */
  const revokeAgent = useCallback(
    async (agentAddress) => {
      if (!walletClient) throw new Error("Not connected");
      setLoading(true);
      setError(null);

      try {
        const hash = await walletClient.writeContract({
          address: walletAgentAddress,
          abi: WALLET_AGENT_ABI,
          functionName: "revokeAgent",
          args: [agentAddress],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setLoading(false);
        return receipt;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
    },
    [walletClient, publicClient, walletAgentAddress],
  );

  /**
   * Freeze the wallet (emergency)
   */
  const freezeWallet = useCallback(
    async (reason = "Emergency freeze") => {
      if (!walletClient) throw new Error("Not connected");
      setLoading(true);
      setError(null);

      try {
        const hash = await walletClient.writeContract({
          address: walletAgentAddress,
          abi: WALLET_AGENT_ABI,
          functionName: "freezeWallet",
          args: [reason],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        await loadWalletInfo();
        setLoading(false);
        return receipt;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
    },
    [walletClient, publicClient, walletAgentAddress, loadWalletInfo],
  );

  /**
   * Unfreeze the wallet
   */
  const unfreezeWallet = useCallback(async () => {
    if (!walletClient) throw new Error("Not connected");
    setLoading(true);
    setError(null);

    try {
      const hash = await walletClient.writeContract({
        address: walletAgentAddress,
        abi: WALLET_AGENT_ABI,
        functionName: "unfreezeWallet",
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      await loadWalletInfo();
      setLoading(false);
      return receipt;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [walletClient, publicClient, walletAgentAddress, loadWalletInfo]);

  /**
   * Get agent authorization details
   */
  const getAgentAuth = useCallback(
    async (agentAddress) => {
      if (
        !publicClient ||
        !address ||
        walletAgentAddress === DEFAULT_WALLET_AGENT_ADDRESS
      )
        return null;

      try {
        const data = await publicClient.readContract({
          address: walletAgentAddress,
          abi: WALLET_AGENT_ABI,
          functionName: "getAgentAuth",
          args: [address, agentAddress],
        });

        return {
          authorized: data.authorized,
          spendLimit: data.spendLimit,
          dailyLimit: data.dailyLimit,
          dailySpent: data.dailySpent,
          expiresAt: Number(data.expiresAt),
        };
      } catch {
        return null;
      }
    },
    [publicClient, address, walletAgentAddress],
  );

  /**
   * Create a session key
   */
  const createSessionKey = useCallback(
    async (keyAddress, durationHours, spendLimitEth) => {
      if (!walletClient) throw new Error("Not connected");
      setLoading(true);
      setError(null);

      try {
        const hash = await walletClient.writeContract({
          address: walletAgentAddress,
          abi: WALLET_AGENT_ABI,
          functionName: "createSessionKey",
          args: [
            keyAddress,
            BigInt((durationHours || 24) * 3600),
            parseEther(spendLimitEth || "1"),
          ],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setLoading(false);
        return receipt;
      } catch (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
    },
    [walletClient, publicClient, walletAgentAddress],
  );

  return {
    // Connection state
    address,
    isConnected,
    isSmartWallet,
    connector,

    // Wallet info
    walletInfo,
    protocolStats,
    loading,
    error,

    // Actions
    connectSmartWallet,
    disconnectWallet,
    registerWallet,
    authorizeAgent,
    revokeAgent,
    freezeWallet,
    unfreezeWallet,
    getAgentAuth,
    createSessionKey,

    // Utilities
    loadWalletInfo,
    loadProtocolStats,
    setError,
  };
}

export { WALLET_AGENT_ABI, SMART_WALLET_ABI };
