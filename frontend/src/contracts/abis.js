// DarkAgent Contract ABIs — Minimal for frontend interaction
export const DARKAGENT_ABI = [
    "function registerAgent(address agentAddress, string ensName, string[] capabilities, uint256 maxPerTx, uint256 maxPerDay, uint256 alertThreshold) external",
    "function getAgent(address agentAddress) external view returns (address owner, string ensName, bytes32 capabilityHash, string[] capabilities, uint256 reputationScore, uint8 status, bytes32 attestationHash, uint256 attestationTime, uint256 registeredAt)",
    "function checkCapability(address agentAddress, string action) external view returns (bool)",
    "function executeWithCapabilityCheck(address agentAddress, string action) external",
    "function updateAttestation(address agentAddress, bytes32 newAttestationHash) external",
    "function verifyAttestation(address agentAddress, bytes32 expectedHash) external view returns (bool)",
    "function fireCircuitBreaker(address agentAddress, string reason, bytes32 invalidAttestationHash) external",
    "function unfreezeAgent(address agentAddress, bytes32 newAttestationHash) external",
    "function processTransaction(address agentAddress, uint256 amount, address recipient) external returns (bool)",
    "function getSpendingInfo(address agentAddress) external view returns (uint256 dailySpent, uint256 maxPerTransaction, uint256 maxPerDay, uint256 alertThreshold, bool onlyVerifiedRecipients)",
    "function postComplianceProof(address agentAddress, bytes32 proofHash, string proofType, bool verified) external",
    "function queryCompliance(address agentAddress) external view returns (bool compliant, uint256 totalProofs)",
    "function getAllAgents() external view returns (address[])",
    "function totalAgents() external view returns (uint256)",
    "function totalCircuitBreakerEvents() external view returns (uint256)",
    "function getAgentStatusString(address agentAddress) external view returns (string)",
    "function getCircuitBreakerHistory(address agentAddress) external view returns (tuple(uint256 timestamp, string reason, bytes32 oldAttestationHash, bytes32 newAttestationHash)[])",
    "event AgentRegistered(address indexed agentAddress, address indexed owner, string ensName, bytes32 capabilityHash)",
    "event CircuitBreakerFired(address indexed agentAddress, string reason, bytes32 attestationHash, uint256 timestamp)",
    "event WalletFrozen(address indexed agentAddress, string reason, uint256 timestamp)",
    "event CapabilityViolation(address indexed agentAddress, string attemptedAction, bytes32 capabilityHash)",
    "event ComplianceProofPosted(address indexed agentAddress, bytes32 proofHash, string proofType, bool verified)",
    "event SpendingAlert(address indexed agentAddress, uint256 amount, uint256 threshold)",
];

export const CAPABILITY_CHECK_ABI = [
    "function grantCapabilities(address agent, string[] capabilityNames) external",
    "function hasCapability(address agent, string capabilityName) external view returns (bool)",
    "function check(address agent, string action) external returns (bool)",
    "function enforce(address agent, string action) external",
    "function checkView(address agent, string action) external view returns (bool)",
    "function getStats() external view returns (uint256 registeredCapabilities, uint256 violations, uint256 successfulChecks)",
];

export const VERIFIER_ABI = [
    "function submitAndVerifyProof(address agent, bytes proofData, string proofType, uint256[2] publicInputs) external returns (bool)",
    "function queryCompliance(address agent) external returns (bool compliant, uint256 totalProofs)",
    "function getComplianceStatus(address agent) external view returns (tuple(bool isCompliant, uint256 totalProofs, uint256 verifiedProofs, uint256 failedProofs, uint256 lastProofTime, string lastProofType))",
    "function getAllProofs(address agent) external view returns (tuple(address agent, bytes32 proofHash, string proofType, uint256[2] publicInputs, bool verified, uint256 timestamp, uint256 blockNumber)[])",
    "function getProofsByType(address agent, string proofType) external view returns (tuple(address agent, bytes32 proofHash, string proofType, uint256[2] publicInputs, bool verified, uint256 timestamp, uint256 blockNumber)[])",
    "function getStats() external view returns (uint256 totalVerified, uint256 totalFailed, uint256 verificationRate)",
];

export const SLIPPAGE_GUARD_ABI = [
    "function registerSwap(address agent, address tokenIn, address tokenOut, uint256 amountIn, uint256 expectedAmountOut, uint256 slippageBps) external returns (bytes32)",
    "function settleSwap(bytes32 swapId, uint256 actualAmountOut) external returns (bool)",
    "function validateSlippage(address agent, uint256 expectedAmountOut, uint256 actualAmountOut, uint256 maxSlippageBps) external view",
    "function configureAgentSlippage(address agent, uint256 defaultSlippageBps) external",
    "function getSwapGuard(bytes32 swapId) external view returns (tuple(address agent, address tokenIn, address tokenOut, uint256 amountIn, uint256 expectedAmountOut, uint256 minAmountOut, uint256 maxSlippageBps, uint256 timestamp, bool settled, bool passed))",
    "function getAgentConfig(address agent) external view returns (tuple(uint256 defaultSlippageBps, uint256 totalSwaps, uint256 slippageViolations, bool customConfigSet))",
    "function getAgentSwapHistory(address agent) external view returns (bytes32[])",
    "function getStats() external view returns (uint256 totalSwaps, uint256 totalViolations, uint256 successRate)",
    "event SwapGuarded(bytes32 indexed swapId, address indexed agent, address tokenIn, address tokenOut, uint256 amountIn, uint256 expectedAmountOut, uint256 minAmountOut, uint256 maxSlippageBps)",
    "event SwapSettled(bytes32 indexed swapId, address indexed agent, uint256 actualAmountOut, bool passed)",
    "event SlippageViolationDetected(address indexed agent, bytes32 indexed swapId, uint256 expected, uint256 actual, uint256 maxSlippageBps)",
    "event AgentSlippageConfigured(address indexed agent, uint256 defaultSlippageBps)",
];

export const SIGNATURE_VERIFIER_ABI = [
    "function verifyAuthorization(address agent, string action, uint256 nonce, uint256 deadline, bytes signature) external returns (bool)",
    "function isAuthorized(address agent, string action, uint256 nonce) external view returns (bool)",
    "function getAuthorization(bytes32 authId) external view returns (tuple(address agent, string action, uint256 nonce, uint256 deadline, bytes signature, address recoveredSigner, bool verified, uint256 verifiedAt))",
    "function getAgentAuthorizations(address agent) external view returns (bytes32[])",
    "function getStats() external view returns (uint256 totalVerified, uint256 totalFailed, uint256 totalExpired)",
    "event AuthorizationVerified(address indexed agent, address indexed signer, string action, uint256 nonce, bytes32 authId)",
    "event AuthorizationFailed(address indexed agent, address recoveredSigner, address expectedOwner, string reason)",
];
