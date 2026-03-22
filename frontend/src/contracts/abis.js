// wardex Protocol ABI
export const wardex_PROTOCOL_ABI = [
  "function propose(address agent, address user, bytes calldata action) external returns (bytes32)",
  "function verify(bytes32 proposalId) external returns (bool)",
  "function execute(bytes32 proposalId) external",
  "function isVerified(bytes32 proposalId) external view returns (bool)",
  "function getProposal(bytes32 proposalId) external view returns (tuple(address agent, address user, bytes action, bool verified, bool executed, uint256 timestamp))",
  "function totalProposals() external view returns (uint256)",
  "event ActionProposed(bytes32 indexed proposalId, address indexed agent, address indexed user)",
  "event ActionVerified(bytes32 indexed proposalId)",
  "event ActionExecuted(bytes32 indexed proposalId)",
];

// ENS Agent Permissions ABI
export const PERMISSIONS_ABI = [
  "function setPermissions(address user, uint256 maxSpend, uint256 slippageBps, address[] calldata allowedProtocols, address[] calldata allowedTokens, bool active) external",
  "function getPermissions(address user) external view returns (tuple(uint256 maxSpend, uint256 slippageBps, address[] allowedProtocols, address[] allowedTokens, bool active))",
  "function setTextRecord(address user, string memory key, string memory value) external",
  "function readENSRecord(address user, string memory key) public view returns (string memory)",
];

// Coinbase Smart Wallet ABI (ERC-4337)
export const SMART_WALLET_ABI = [
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
  "function implementation() external view returns (address)",
  "function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)",
  "function canSkipChainIdValidation(bytes4 functionSelector) external pure returns (bool)",
];

// Coinbase Smart Wallet Factory ABI
export const SMART_WALLET_FACTORY_ABI = [
  "function createAccount(bytes[] calldata owners, uint256 nonce) external payable returns (address)",
  "function getAddress(bytes[] calldata owners, uint256 nonce) external view returns (address)",
  "function implementation() external view returns (address)",
];

// CoinbaseSmartWalletAgent (wardex adapter) ABI
export const WALLET_AGENT_ABI = [
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
