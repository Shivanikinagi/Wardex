import React, { useState } from 'react';
import { useContracts } from '../hooks/useContracts';
import { ethers } from 'ethers';

const Permissions = () => {
    const { contracts, connected, account } = useContracts();
    const [ensName, setEnsName] = useState('alice.eth');
    const [maxSpend, setMaxSpend] = useState('100');
    const [slippage, setSlippage] = useState('0.5');
    const [status, setStatus] = useState('');

    const handleSave = async () => {
        if (!connected || !contracts?.permissionsContract || !account) {
            setStatus("Please connect wallet first.");
            return;
        }

        try {
            setStatus("Saving permissions to on-chain registry (simulating ENS text records)...");
            
            const slippageBps = parseFloat(slippage) * 100;
            const amountWei = ethers.parseEther(maxSpend);
            
            // For demo: allowedProtocols and allowedTokens as empty array, active = true
            const tx = await contracts.permissionsContract.setPermissions(
                account,
                amountWei,
                slippageBps,
                [],
                [],
                true
            );
            
            setStatus(`Waiting for transaction: ${tx.hash}`);
            await tx.wait();
            setStatus(`Permissions successfully saved and synced to BitGo!`);

        } catch (error) {
            console.error("Permissions save error:", error);
            setStatus(`Error: ${error.reason || error.message}`);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-6">1. Set ENS Agent Permissions</h2>
            <div className="bg-white shadow sm:rounded-lg mb-8">
                <div className="px-4 py-5 sm:p-6 space-y-4">
                    <p className="text-gray-600">This simulates setting an ENS Text Record (agent.permissions) which the DarkAgent protocol will strictly enforce across DeFi.</p>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">ENS Name / Target Account</label>
                        <input
                            type="text"
                            value={ensName}
                            onChange={e => setEnsName(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Max Spend (ETH)</label>
                        <input
                            type="number"
                            value={maxSpend}
                            onChange={e => setMaxSpend(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Max Slippage (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={slippage}
                            onChange={e => setSlippage(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                    <button
                        onClick={handleSave}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 w-full"
                    >
                        Save to ENS & Sync to BitGo
                    </button>
                    {status && <div className="mt-4 p-3 bg-gray-100 font-mono text-sm break-all">{status}</div>}
                </div>
            </div>
        </div>
    );
};

export default Permissions;