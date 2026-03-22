/**
 * wardex Smart Wallet SDK
 *
 * Provides utilities to interact with Coinbase Smart Wallet through the
 * wardex verification protocol. Handles wallet creation, agent authorization,
 * and verified execution flows.
 *
 * @see https://github.com/coinbase/smart-wallet
 */

const { ethers } = require("ethers");

// Coinbase Smart Wallet Factory address on Base Sepolia
// This is the official Coinbase Smart Wallet Factory deployment
const SMART_WALLET_FACTORY_ADDRESS =
  "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";

// Coinbase Smart Wallet Factory ABI (key functions)
const FACTORY_ABI = [
  "function createAccount(bytes[] calldata owners, uint256 nonce) external payable returns (address)",
  "function getAddress(bytes[] calldata owners, uint256 nonce) external view returns (address)",
  "function implementation() external view returns (address)",
];

// Coinbase Smart Wallet ABI (key functions)
const SMART_WALLET_ABI = [
  "function execute(address target, uint256 value, bytes calldata data) external payable",
  "function executeBatch(tuple(address target, uint256 value, bytes data)[] calldata calls) external payable",
  "function isOwnerAddress(address account) external view returns (bool)",
  "function isOwnerPublicKey(bytes32 x, bytes32 y) external view returns (bool)",
  "function isOwnerBytes(bytes calldata account) external view returns (bool)",
  "function addOwnerAddress(address owner) external",
  "function addOwnerPublicKey(bytes32 x, bytes32 y) external",
  "function removeOwnerAtIndex(uint256 index, bytes calldata owner) external",
  "function ownerCount() external view returns (uint256)",
  "function ownerAtIndex(uint256 index) external view returns (bytes memory)",
  "function entryPoint() external view returns (address)",
  "function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)",
  "function implementation() external view returns (address)",
];

// CoinbaseSmartWalletAgent ABI (the wardex adapter)
const WALLET_AGENT_ABI = [
  "function registerWallet(address smartWallet) external",
  "function createAndRegisterWallet(uint256 nonce) external returns (address)",
  "function predictWalletAddress(address owner, uint256 nonce) external view returns (address)",
  "function authorizeAgent(address agent, uint256 spendLimit, uint256 dailyLimit, uint256 duration) external",
  "function revokeAgent(address agent) external",
  "function updateSpendingLimits(address agent, uint256 newSpendLimit, uint256 newDailyLimit) external",
  "function executeVerified(address owner, bytes32 proposalId, address target, uint256 value, bytes calldata data) external",
  "function executeBatchVerified(address owner, bytes32 proposalId, tuple(address target, uint256 value, bytes data)[] calldata calls) external",
  "function freezeWallet(string calldata reason) external",
  "function unfreezeWallet() external",
  "function createSessionKey(address key, uint256 duration, uint256 spendLimit) external",
  "function revokeSessionKey(uint256 index) external",
  "function getWalletInfo(address owner) external view returns (tuple(address smartWallet, address owner, bool frozen, uint256 registeredAt, uint256 totalExecutions, uint256 totalSpent))",
  "function getAgentAuth(address owner, address agent) external view returns (tuple(bool authorized, uint256 spendLimit, uint256 dailyLimit, uint256 dailySpent, uint256 lastResetDay, uint256 expiresAt, string[] allowedMethods))",
  "function isAgentAuthorized(address owner, address agent) external view returns (bool)",
  "function getRemainingDailyAllowance(address owner, address agent) external view returns (uint256)",
  "function getSessionKeys(address owner) external view returns (tuple(address key, uint256 expiresAt, uint256 spendLimit, uint256 spent, bool active)[])",
  "function getProtocolStats() external view returns (uint256 totalWallets, uint256 totalExecutions)",
  "function totalWallets() external view returns (uint256)",
  "function totalExecutions() external view returns (uint256)",
  "event WalletRegistered(address indexed owner, address indexed smartWallet, uint256 timestamp)",
  "event WalletFrozenEvent(address indexed owner, address indexed smartWallet, string reason)",
  "event WalletUnfrozen(address indexed owner, address indexed smartWallet)",
  "event AgentAuthorized(address indexed owner, address indexed agent, uint256 spendLimit, uint256 expiresAt)",
  "event AgentRevoked(address indexed owner, address indexed agent)",
  "event ExecutionCompleted(address indexed smartWallet, address indexed agent, bytes32 indexed proposalId, uint256 value)",
  "event BatchExecutionCompleted(address indexed smartWallet, address indexed agent, uint256 callCount)",
  "event SessionKeyCreated(address indexed owner, address indexed sessionKey, uint256 expiresAt)",
  "event SessionKeyRevoked(address indexed owner, address indexed sessionKey)",
];

/**
 * SmartWalletSDK - Main SDK class for Coinbase Smart Wallet + wardex integration
 */
class SmartWalletSDK {
  /**
   * @param {Object} config
   * @param {ethers.Signer} config.signer - The signer (wallet owner)
   * @param {string} config.walletAgentAddress - CoinbaseSmartWalletAgent contract address
   * @param {string} [config.factoryAddress] - Override factory address
   * @param {ethers.Provider} [config.provider] - Override provider
   */
  constructor(config) {
    this.signer = config.signer;
    this.provider = config.provider || config.signer.provider;
    this.walletAgentAddress = config.walletAgentAddress;
    this.factoryAddress = config.factoryAddress || SMART_WALLET_FACTORY_ADDRESS;

    // Initialize contracts
    this.walletAgentContract = new ethers.Contract(
      this.walletAgentAddress,
      WALLET_AGENT_ABI,
      this.signer,
    );

    this.factoryContract = new ethers.Contract(
      this.factoryAddress,
      FACTORY_ABI,
      this.signer,
    );
  }

  // ===============================================================
  //                WALLET MANAGEMENT
  // ===============================================================

  /**
   * Predict the smart wallet address before deployment
   * @param {string} ownerAddress - The owner's EOA address
   * @param {number} nonce - Deployment nonce
   * @returns {Promise<string>} The predicted wallet address
   */
  async predictAddress(ownerAddress, nonce = 0) {
    const owners = [
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [ownerAddress]),
    ];
    return await this.factoryContract.getAddress(owners, nonce);
  }

  /**
   * Create a new Coinbase Smart Wallet directly through the factory
   * @param {number} nonce - Deployment nonce
   * @returns {Promise<{address: string, tx: ethers.TransactionReceipt}>}
   */
  async createWallet(nonce = 0) {
    const ownerAddress = await this.signer.getAddress();
    const owners = [
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [ownerAddress]),
    ];

    const tx = await this.factoryContract.createAccount(owners, nonce);
    const receipt = await tx.wait();

    const predictedAddress = await this.predictAddress(ownerAddress, nonce);

    return {
      address: predictedAddress,
      tx: receipt,
    };
  }

  /**
   * Create a wallet and register it with wardex in one transaction
   * @param {number} nonce - Deployment nonce
   * @returns {Promise<{address: string, tx: ethers.TransactionReceipt}>}
   */
  async createAndRegister(nonce = 0) {
    const tx = await this.walletAgentContract.createAndRegisterWallet(nonce);
    const receipt = await tx.wait();

    // Extract wallet address from event
    const event = receipt.logs.find((log) => {
      try {
        const parsed = this.walletAgentContract.interface.parseLog(log);
        return parsed && parsed.name === "WalletRegistered";
      } catch {
        return false;
      }
    });

    let walletAddress = null;
    if (event) {
      const parsed = this.walletAgentContract.interface.parseLog(event);
      walletAddress = parsed.args.smartWallet;
    }

    return {
      address: walletAddress,
      tx: receipt,
    };
  }

  /**
   * Register an existing Coinbase Smart Wallet with wardex
   * @param {string} smartWalletAddress - The smart wallet address
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async registerWallet(smartWalletAddress) {
    const tx = await this.walletAgentContract.registerWallet(
      smartWalletAddress,
    );
    return await tx.wait();
  }

  /**
   * Get wallet registration info
   * @param {string} ownerAddress - The wallet owner
   * @returns {Promise<Object>} Wallet registration details
   */
  async getWalletInfo(ownerAddress) {
    const info = await this.walletAgentContract.getWalletInfo(ownerAddress);
    return {
      smartWallet: info.smartWallet,
      owner: info.owner,
      frozen: info.frozen,
      registeredAt: Number(info.registeredAt),
      totalExecutions: Number(info.totalExecutions),
      totalSpent: info.totalSpent,
    };
  }

  // ===============================================================
  //                AGENT AUTHORIZATION
  // ===============================================================

  /**
   * Authorize an AI agent to operate through the smart wallet
   * @param {string} agentAddress - The agent to authorize
   * @param {Object} limits - Spending limits
   * @param {string} limits.spendLimit - Max per-tx spend in ETH
   * @param {string} limits.dailyLimit - Max daily spend in ETH
   * @param {number} limits.durationDays - Authorization duration in days
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async authorizeAgent(agentAddress, limits = {}) {
    const spendLimit = ethers.parseEther(limits.spendLimit || "1");
    const dailyLimit = ethers.parseEther(limits.dailyLimit || "10");
    const duration = (limits.durationDays || 30) * 86400; // Convert days to seconds

    const tx = await this.walletAgentContract.authorizeAgent(
      agentAddress,
      spendLimit,
      dailyLimit,
      duration,
    );
    return await tx.wait();
  }

  /**
   * Revoke an agent's authorization
   * @param {string} agentAddress - The agent to revoke
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async revokeAgent(agentAddress) {
    const tx = await this.walletAgentContract.revokeAgent(agentAddress);
    return await tx.wait();
  }

  /**
   * Check if an agent is authorized
   * @param {string} ownerAddress - The wallet owner
   * @param {string} agentAddress - The agent to check
   * @returns {Promise<boolean>}
   */
  async isAgentAuthorized(ownerAddress, agentAddress) {
    return await this.walletAgentContract.isAgentAuthorized(
      ownerAddress,
      agentAddress,
    );
  }

  /**
   * Get agent authorization details
   * @param {string} ownerAddress - The wallet owner
   * @param {string} agentAddress - The agent address
   * @returns {Promise<Object>}
   */
  async getAgentAuth(ownerAddress, agentAddress) {
    const auth = await this.walletAgentContract.getAgentAuth(
      ownerAddress,
      agentAddress,
    );
    return {
      authorized: auth.authorized,
      spendLimit: auth.spendLimit,
      dailyLimit: auth.dailyLimit,
      dailySpent: auth.dailySpent,
      expiresAt: Number(auth.expiresAt),
      remainingDaily: auth.dailyLimit - auth.dailySpent,
    };
  }

  /**
   * Get remaining daily allowance for an agent
   * @param {string} ownerAddress
   * @param {string} agentAddress
   * @returns {Promise<bigint>} Remaining allowance in wei
   */
  async getRemainingAllowance(ownerAddress, agentAddress) {
    return await this.walletAgentContract.getRemainingDailyAllowance(
      ownerAddress,
      agentAddress,
    );
  }

  // ===============================================================
  //                EXECUTION
  // ===============================================================

  /**
   * Execute a verified action through the smart wallet
   * @param {string} ownerAddress - The wallet owner
   * @param {string} proposalId - The wardex proposal ID (bytes32)
   * @param {Object} call - The call to execute
   * @param {string} call.target - Target contract
   * @param {string} call.value - ETH value in wei
   * @param {string} call.data - Calldata hex
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async executeVerified(ownerAddress, proposalId, call) {
    const tx = await this.walletAgentContract.executeVerified(
      ownerAddress,
      proposalId,
      call.target,
      call.value || 0,
      call.data || "0x",
    );
    return await tx.wait();
  }

  /**
   * Execute a batch of verified actions
   * @param {string} ownerAddress - The wallet owner
   * @param {string} proposalId - The wardex proposal ID
   * @param {Array<Object>} calls - Array of calls
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async executeBatchVerified(ownerAddress, proposalId, calls) {
    const tx = await this.walletAgentContract.executeBatchVerified(
      ownerAddress,
      proposalId,
      calls.map((c) => ({
        target: c.target,
        value: c.value || 0,
        data: c.data || "0x",
      })),
    );
    return await tx.wait();
  }

  // ===============================================================
  //               EMERGENCY CONTROLS
  // ===============================================================

  /**
   * Freeze the wallet - immediately stops all agent executions
   * @param {string} reason - Reason for freezing
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async freezeWallet(reason = "Emergency freeze") {
    const tx = await this.walletAgentContract.freezeWallet(reason);
    return await tx.wait();
  }

  /**
   * Unfreeze the wallet
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async unfreezeWallet() {
    const tx = await this.walletAgentContract.unfreezeWallet();
    return await tx.wait();
  }

  // ===============================================================
  //               SESSION KEYS
  // ===============================================================

  /**
   * Create a session key for gasless transactions
   * @param {string} keyAddress - The session key address
   * @param {number} durationHours - Session duration in hours
   * @param {string} spendLimitEth - Max spend for session in ETH
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async createSessionKey(keyAddress, durationHours = 24, spendLimitEth = "1") {
    const tx = await this.walletAgentContract.createSessionKey(
      keyAddress,
      durationHours * 3600,
      ethers.parseEther(spendLimitEth),
    );
    return await tx.wait();
  }

  /**
   * Revoke a session key
   * @param {number} index - Index of the session key
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async revokeSessionKey(index) {
    const tx = await this.walletAgentContract.revokeSessionKey(index);
    return await tx.wait();
  }

  /**
   * Get all session keys
   * @param {string} ownerAddress
   * @returns {Promise<Array>}
   */
  async getSessionKeys(ownerAddress) {
    return await this.walletAgentContract.getSessionKeys(ownerAddress);
  }

  // ===============================================================
  //               PROTOCOL STATS
  // ===============================================================

  /**
   * Get overall protocol statistics
   * @returns {Promise<Object>}
   */
  async getProtocolStats() {
    const [totalWallets, totalExecs] =
      await this.walletAgentContract.getProtocolStats();
    return {
      totalWallets: Number(totalWallets),
      totalExecutions: Number(totalExecs),
    };
  }

  // ===============================================================
  //              SMART WALLET DIRECT INTERACTION
  // ===============================================================

  /**
   * Get a direct contract instance for a Coinbase Smart Wallet
   * @param {string} walletAddress - The smart wallet address
   * @returns {ethers.Contract} The smart wallet contract instance
   */
  getSmartWalletContract(walletAddress) {
    return new ethers.Contract(walletAddress, SMART_WALLET_ABI, this.signer);
  }

  /**
   * Check if an address is an owner of a smart wallet
   * @param {string} walletAddress - The smart wallet address
   * @param {string} accountAddress - The address to check
   * @returns {Promise<boolean>}
   */
  async isWalletOwner(walletAddress, accountAddress) {
    const wallet = this.getSmartWalletContract(walletAddress);
    return await wallet.isOwnerAddress(accountAddress);
  }

  /**
   * Get the owner count of a smart wallet
   * @param {string} walletAddress - The smart wallet address
   * @returns {Promise<number>}
   */
  async getOwnerCount(walletAddress) {
    const wallet = this.getSmartWalletContract(walletAddress);
    return Number(await wallet.ownerCount());
  }

  /**
   * Add a new owner to a smart wallet (must be called from wallet itself)
   * @param {string} walletAddress - The smart wallet address
   * @param {string} newOwner - The new owner address
   * @returns {Promise<ethers.TransactionReceipt>}
   */
  async addOwner(walletAddress, newOwner) {
    const wallet = this.getSmartWalletContract(walletAddress);
    const tx = await wallet.addOwnerAddress(newOwner);
    return await tx.wait();
  }
}

// Export for both CommonJS and ES modules
module.exports = {
  SmartWalletSDK,
  SMART_WALLET_ABI,
  WALLET_AGENT_ABI,
  FACTORY_ABI,
  SMART_WALLET_FACTORY_ADDRESS,
};
