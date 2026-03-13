/**
 * HeyElsa x DarkAgent
 * Safety Plugin for HeyElsa Execution Engine
 * 
 * Problem: HeyElsa executes DeFi beautifully but has no safety layer. Agents can go rogue,
 *          and users don't fully trust autonomous execution.
 * 
 * Solution: This SDK plugs into HeyElsa's execution engine. Before HeyElsa executes
 *           anything, it calls `DarkAgent.verify()`. We make HeyElsa trustworthy and
 *           solve their biggest weakness.
 */

const DarkAgentSDK = require('./darkagent');

class HeyElsaSafetyModule {
  /**
   * Initialize the HeyElsa Safety Plugin
   * @param {string} darkAgentProtocolAddress - Deployed Verification Protocol on Base
   * @param {object} providerOrSigner - Ethers provider
   */
  constructor(darkAgentProtocolAddress, providerOrSigner) {
    this.darkAgent = new DarkAgentSDK(darkAgentProtocolAddress, providerOrSigner);
  }

  /**
   * Wrapper for HeyElsa's execution pipeline.
   * Proposes and verifies the transaction before allowing HeyElsa to broadcast.
   * 
   * @param {string} agentAddress - The HeyElsa agent's address
   * @param {string} userENS - The user's ENS identity containing their rules
   * @param {object} transactionPayload - The raw transaction HeyElsa wants to execute
   * @param {function} executeCallback - HeyElsa's actual execution function
   * @returns {Promise<object>} The execution result or a rejection
   */
  async safeExecute(agentAddress, userENS, transactionPayload, executeCallback) {
    console.log(`🛡️ [HeyElsa Safety] Verifying execution for ${userENS}...`);
    
    // 1. Propose and Verify via DarkAgent Protocol on Base
    const isApproved = await this.darkAgent.verify(
      agentAddress, 
      userENS, 
      JSON.stringify(transactionPayload)
    );

    // 2. Gatekeeper Logic
    if (!isApproved) {
      console.error('❌ [HeyElsa Safety] Execution BLOCKED by user ENS rules.');
      throw new Error("DarkAgent Verification Failed: Action violates user's ENS permissions.");
    }

    console.log('✅ [HeyElsa Safety] Verification PASSED. Executing securely.');
    
    // 3. Hand back to HeyElsa to execute
    const result = await executeCallback(transactionPayload);
    
    // 4. (Optional) Generate a Fileverse Audit Receipt here
    
    return result;
  }
}

module.exports = HeyElsaSafetyModule;
