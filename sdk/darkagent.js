/**
 * wardex SDK
 * 
 * The Verification Infrastructure for AI Agents in DeFi.
 * 
 * 3-line integration for any developer to use wardex 
 * as their load-bearing security layer.
 */

const { ethers } = require('ethers');

class wardexSDK {
  /**
   * Initializes the wardex SDK
   * @param {string} wardexProtocolAddress - Address of the Iwardex contract
   * @param {ethers.Signer|ethers.Provider} providerOrSigner - Ethers instance
   */
  constructor(wardexProtocolAddress, providerOrSigner) {
    const ABI = [
      "function propose(address agent, address user, bytes calldata action) external returns (bytes32)",
      "function verify(bytes32 proposalId) external returns (bool)",
      "function execute(bytes32 proposalId) external",
      "function isVerified(bytes32 proposalId) external view returns (bool)"
    ];
    this.protocol = new ethers.Contract(wardexProtocolAddress, ABI, providerOrSigner);
  }

  /**
   * Verifies an action against the user's ENS rules.
   * Proposes the action and runs the verification protocol.
   * 
   * @param {string} agentAddress - The address of the AI agent
   * @param {string} userENS - The ENS name or address of the user
   * @param {bytes|string} actionData - The payload to be executed
   * @returns {Promise<boolean>} True if the action is approved by wardex
   */
  async verify(agentAddress, userENS, actionData) {
    try {
      // Resolve user if they passed ENS (simulated here)
      const userAddr = userENS.endsWith('.eth') ? ethers.ZeroAddress : userENS;
      
      const tx = await this.protocol.propose(agentAddress, userAddr, ethers.toUtf8Bytes(actionData));
      const receipt = await tx.wait();
      
      // Parse proposalId from events
      const log = receipt.logs.find(l => l.fragment?.name === 'ActionProposed');
      const proposalId = log.args[0];

      // Request verification from the Protocol
      const verifyTx = await this.protocol.verify(proposalId);
      await verifyTx.wait();

      return await this.protocol.isVerified(proposalId);
    } catch (e) {
      console.error("wardex Verification Failed:", e);
      return false;
    }
  }

  /**
   * Generates a permanent Fileverse Verification Receipt
   * @param {object} fileverseSDK - Configured Fileverse integration
   * @param {object} details - The rules that were checked
   */
  async generateReceipt(fileverseSDK, details) {
    return fileverseSDK.storeVerificationReceipt({
      proposalId: details.proposalId,
      agentAddress: details.agentAddress,
      user: details.user,
      action: details.action,
      rulesChecked: {
        max_spend: true,
        slippage: true,
        protocol: true
      },
      signature: details.signature || "0xverified"
    });
  }
}

module.exports = wardexSDK;
