// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IENS - Interface for ENS integration
 * @notice Minimal ENS interface for DarkAgent identity resolution
 */
interface IENS {
    /// @notice Resolve an ENS name to an address
    function addr(bytes32 node) external view returns (address);

    /// @notice Get text record for an ENS node
    function text(bytes32 node, string calldata key) external view returns (string memory);

    /// @notice Set text record for an ENS node
    function setText(bytes32 node, string calldata key, string calldata value) external;

    /// @notice Check if a name is registered
    function recordExists(bytes32 node) external view returns (bool);

    /// @notice Get the owner of a node
    function owner(bytes32 node) external view returns (address);
}
