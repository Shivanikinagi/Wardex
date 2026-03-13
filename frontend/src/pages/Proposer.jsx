import React, { useState } from 'react';
import { useContracts } from '../hooks/useContracts';
import { ethers } from 'ethers';

const Proposer = () => {
    const { contracts, connected, account } = useContracts();
    const [actionData, setActionData] = useState('0xdeadbeef'); 
    const [status, setStatus] = useState('');
    const [proposalId, setProposalId] = useState(null);
    const [agentAddress, setAgentAddress] = useState('0x1111111111111111111111111111111111111111');

    const handlePropose = async () => {
        if (!connected || !contracts?.darkAgent || !account) {
            setStatus("Please connect wallet first.");
            return;
        }

        try {
            setStatus("Proposing execution on-chain...");
            const tx = await contracts.darkAgent.propose(
                agentAddress,
                account,
                ethers.getBytes(actionData)
            );
            setStatus(`Waiting for transaction: ${tx.hash}`);
            
            const receipt = await tx.wait();
            
            // Extract Proposal ID from event
            const event = receipt.logs.find(
                log => {
                    try {
                        const parsed = contracts.darkAgent.interface.parseLog(log);
                        return parsed && parsed.name === 'ActionProposed';
                    } catch (e) {
                        return false;
                    }
                }
            );

            if (event) {
                const parsedLog = contracts.darkAgent.interface.parseLog(event);
                const pid = parsedLog.args.proposalId;
                setProposalId(pid);
                setStatus(`Proposed successfully! Proposal ID: ${pid.toString()}`);
            } else {
                setStatus("Proposal successful, but couldn't find event ID.");
            }

        } catch (error) {
            console.error("Propose error:", error);
            setStatus(`Error: ${error.reason || error.message}`);
        }
    };

    const handleVerifyAndExecute = async () => {
        if (!connected || !contracts?.darkAgent || proposalId === null) {
            setStatus("Need a valid proposal ID first.");
            return;
        }

        try {
            setStatus(`Verifying proposal ${proposalId.toString()}...`);
            // In a real scenario, this would check TEE/ENS rules. 
            // The DarkAgent Protocol is set up for demo to pass verification 
            // simply if we call verify() (or you could pass an actual ZK proof if the protocol was configured).
            
            // Our rewritten DarkAgent.sol from previous step just takes verify(uint256 pid, bool isSafe)
            const verifyTx = await contracts.darkAgent.verify(proposalId, true);
            setStatus(`Waiting for verification tx: ${verifyTx.hash}`);
            await verifyTx.wait();

            setStatus(`Verification complete! Executing...`);
            const execTx = await contracts.darkAgent.execute(proposalId);
            setStatus(`Waiting for execution tx: ${execTx.hash}`);
            await execTx.wait();

            setStatus("Successfully verified and executed! See Dashboard for updates.");
            
        } catch (error) {
            console.error("Execute error:", error);
            setStatus(`Error: ${error.reason || error.message}`);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Simulate HeyElsa Integration
                    </h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500">
                        <p>This panel simulates what the HeyElsa SDK plugin does seamlessly in the background. It proposes an action bundle to the DarkAgent Verify Protocol on Base Sepolia.</p>
                    </div>

                    <div className="mt-5 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Mock Target Agent Address</label>
                            <input
                                type="text"
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm pt-2 pb-2 pl-3 border"
                                value={agentAddress}
                                onChange={(e) => setAgentAddress(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Action Calldata (Hex)</label>
                            <input
                                type="text"
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm pt-2 pb-2 pl-3 border"
                                value={actionData}
                                onChange={(e) => setActionData(e.target.value)}
                            />
                        </div>

                        <div className="flex space-x-3 pt-4">
                            <button
                                onClick={handlePropose}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                                1. Submit Proposal
                            </button>
                            <button
                                onClick={handleVerifyAndExecute}
                                disabled={proposalId === null}
                                className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${proposalId === null ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                            >
                                2. Verify & Execute
                            </button>
                        </div>
                    </div>

                    {status && (
                        <div className="mt-6 bg-gray-50 rounded-md p-4">
                            <h4 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">Status Output</h4>
                            <p className="mt-2 text-sm text-gray-600 font-mono break-all">
                                {status}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Proposer;
