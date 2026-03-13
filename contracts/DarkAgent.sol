// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IDarkAgent.sol";

interface IENSAgentResolver {
    struct AgentPermissions {
        uint256 maxSpend;
        uint256 dailyLimit;
        uint256 slippageBps;
        address[] tokens;
        address[] protocols;
        uint256 expiry;
        bool active;
    }
    function getPermissions(address user) external view returns (AgentPermissions memory);
}

/**
 * @title DarkAgent Core Protocol
 * @author DarkAgent
 * @notice The core verification infrastructure for AI agents in DeFi.
 * @dev Depends on ENS Agent Permission records for rule sets. 
 */
contract DarkAgent is IDarkAgent {
    // ===============================================================
    //                       CUSTOM ERRORS
    // ===============================================================
    error ProposalNotFound(bytes32 proposalId);
    error AlreadyVerified(bytes32 proposalId);
    error NotVerifiedYet(bytes32 proposalId);
    error AlreadyExecuted(bytes32 proposalId);
    error VerificationFailedReason(string reason);

    // ===============================================================
    //                        STATE VARIABLES
    // ===============================================================
    mapping(bytes32 => Proposal) public proposals;
    uint256 public totalProposals;
    
    IENSAgentResolver public ensResolver;

    // ===============================================================
    //                          EVENTS
    // ===============================================================
    event ActionProposed(bytes32 indexed proposalId, address indexed agent, address indexed user);
    event ActionVerified(bytes32 indexed proposalId);
    event ActionExecuted(bytes32 indexed proposalId);
    
    constructor(address _ensResolver) {
        ensResolver = IENSAgentResolver(_ensResolver);
    }

    /**
     * @notice Agent proposes an action
     */
    function propose(
        address agent,
        address user,
        bytes calldata action
    ) external override returns (bytes32 proposalId) {
        proposalId = keccak256(abi.encodePacked(
            agent, user, action, block.timestamp, totalProposals
        ));

        proposals[proposalId] = Proposal({
            agent: agent,
            user: user,
            action: action,
            verified: false,
            executed: false,
            timestamp: block.timestamp
        });

        totalProposals++;
        
        emit ActionProposed(proposalId, agent, user);
        return proposalId;
    }

    /**
     * @notice DarkAgent verifies the proposal against the ENSIP rules
     * @dev Fetches rules directly from the configured ENS Resolver standard.
     */
    function verify(
        bytes32 proposalId
    ) external override returns (bool) {
        Proposal storage p = proposals[proposalId];
        if (p.agent == address(0)) revert ProposalNotFound(proposalId);
        if (p.verified) revert AlreadyVerified(proposalId);
        if (p.executed) revert AlreadyExecuted(proposalId);

        // Call the ENS standards resolver to grab configuration for the user
        IENSAgentResolver.AgentPermissions memory rules = ensResolver.getPermissions(p.user);
        
        if (!rules.active) revert VerificationFailedReason("Agent permissions inactive in ENS");
        
        // If max spend is completely unset, assume misconfiguration
        if (rules.maxSpend == 0) revert VerificationFailedReason("ENS limit undefined");

        // Further simulated protocol level checks against p.action data structure etc. would happen here...

        p.verified = true;
        
        emit ActionVerified(proposalId);
        return true;
    }

    /**
     * @notice Executes the action
     */
    function execute(
        bytes32 proposalId
    ) external override {
        Proposal storage p = proposals[proposalId];
        if (p.agent == address(0)) revert ProposalNotFound(proposalId);
        if (!p.verified) revert NotVerifiedYet(proposalId);
        if (p.executed) revert AlreadyExecuted(proposalId);

        p.executed = true;

        // Perform external call 
        emit ActionExecuted(proposalId);
    }

    function isVerified(
        bytes32 proposalId
    ) external view override returns (bool) {
        return proposals[proposalId].verified;
    }

    function getProposal(
        bytes32 proposalId
    ) external view override returns (Proposal memory) {
        return proposals[proposalId];
    }
}
