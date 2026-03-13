// ABI for the new DarkAgent Verification Protocol

export const DARKAGENT_PROTOCOL_ABI = [
  "function propose(address agent, address user, bytes calldata action) external returns (bytes32)",
  "function verify(bytes32 proposalId) external returns (bool)",
  "function execute(bytes32 proposalId) external",
  "function isVerified(bytes32 proposalId) external view returns (bool)",
  "function getProposal(bytes32 proposalId) external view returns (tuple(address agent, address user, bytes action, bool verified, bool executed, uint256 timestamp))",
  "function totalProposals() external view returns (uint256)",
  "event ActionProposed(bytes32 indexed proposalId, address indexed agent, address indexed user)",
  "event ActionVerified(bytes32 indexed proposalId)",
  "event ActionExecuted(bytes32 indexed proposalId)"
]
