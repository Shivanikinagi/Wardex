// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Verifier
 * @notice Minimal on-chain attestation anchor for DarkAgent execution receipts.
 */
contract Verifier {
    address public immutable darkAgent;

    event ProofAnchored(bytes32 indexed receiptHash, address indexed relayer, uint256 timestamp);

    constructor(address _darkAgent) {
        require(_darkAgent != address(0), "DarkAgent required");
        darkAgent = _darkAgent;
    }

    function anchorProof(bytes32 receiptHash) external {
        require(receiptHash != bytes32(0), "Invalid receipt hash");
        emit ProofAnchored(receiptHash, msg.sender, block.timestamp);
    }
}
