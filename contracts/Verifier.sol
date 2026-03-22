// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Verifier
 * @notice Minimal on-chain attestation anchor for WARDEX execution receipts.
 */
contract Verifier {
    address public immutable WARDEX;

    event ProofAnchored(bytes32 indexed receiptHash, address indexed relayer, uint256 timestamp);

    constructor(address _WARDEX) {
        require(_WARDEX != address(0), "WARDEX required");
        WARDEX = _WARDEX;
    }

    function anchorProof(bytes32 receiptHash) external {
        require(receiptHash != bytes32(0), "Invalid receipt hash");
        emit ProofAnchored(receiptHash, msg.sender, block.timestamp);
    }
}
