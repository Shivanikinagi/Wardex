// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ENSAgentResolver 
 * @notice Reference implementation of the proposed ENSIP for Agent Permission Records.
 * @dev Resolves agent.* text records into structured protocol rules. Any protocol can call this.
 */
contract ENSAgentResolver {
    
    struct AgentPermissions {
        uint256 maxSpend;
        uint256 dailyLimit;
        uint256 slippageBps; // e.g. 50 = 0.5%
        address[] tokens;
        address[] protocols;
        uint256 expiry;
        bool active;
    }

    // Standard ENS Text record storage mockup
    mapping(address => mapping(string => string)) private textRecords;
    
    // Parsed representation of ENS Text records to be used by DarkAgent Validation Protocol
    mapping(address => AgentPermissions) private userPermissions;

    event PermissionsSynced(address indexed user);

    /**
     * @dev Write raw "text records" for a user. In mainnet, this is ENS PublicResolver.setText
     */
    function setTextRecord(address user, string calldata key, string calldata value) external {
        textRecords[user][key] = value;
    }

    /**
     * @dev Read a text record. Mimics ENS PublicResolver.text(bytes32 node, string key)
     */
    function readENSRecord(address user, string calldata key) public view returns (string memory) {
        return textRecords[user][key];
    }

    /**
     * @dev Syncs and converts string ENS records into the strict struct map. 
     * In a production cross-chain setup, this would use CCIP-read to pull the strings and parse automatically.
     */
    function syncPermissions(
        address user,
        uint256 maxSpend,
        uint256 dailyLimit,
        uint256 slippageBps,
        address[] calldata tokens,
        address[] calldata protocols,
        uint256 expiry,
        bool active
    ) external {
        userPermissions[user] = AgentPermissions({
            maxSpend: maxSpend,
            dailyLimit: dailyLimit,
            slippageBps: slippageBps,
            tokens: tokens,
            protocols: protocols,
            expiry: expiry,
            active: active
        });
        emit PermissionsSynced(user);
    }

    /**
     * @notice Any protocol can query this resolver to check agent permissions associated with an ENS name/identity.
     */
    function getPermissions(address user) external view returns (AgentPermissions memory) {
        return userPermissions[user];
    }
}
