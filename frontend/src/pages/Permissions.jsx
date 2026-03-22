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
            setStatus(`Permissions successfully saved and synced to the execution policy layer.`);

        } catch (error) {
            console.error("Permissions save error:", error);
            setStatus(`Error: ${error.reason || error.message}`);
        }
    };

    return (
        <div className="theme-page theme-stack">
            <section className="theme-hero">
                <span className="theme-kicker">Permissions</span>
                <h1 className="theme-title">Set clear limits for what your agent is allowed to do.</h1>
                <p className="theme-copy">Define spending and slippage limits, then sync them so execution stays inside your rules.</p>
            </section>

            <div className="theme-panel">
                <p className="theme-note" style={{ marginBottom: '18px' }}>This simulates setting an ENS text record that the DarkAgent protocol can enforce across downstream actions.</p>

                <div className="theme-grid">
                    <div className="input-group">
                        <label>ENS Name / Target Account</label>
                        <input
                            type="text"
                            value={ensName}
                            onChange={e => setEnsName(e.target.value)}
                            className="input input-mono"
                            disabled
                        />
                    </div>
                    <div className="input-group">
                        <label>Max Spend (ETH)</label>
                        <input
                            type="number"
                            value={maxSpend}
                            onChange={e => setMaxSpend(e.target.value)}
                            className="input"
                        />
                    </div>
                    <div className="input-group">
                        <label>Max Slippage (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={slippage}
                            onChange={e => setSlippage(e.target.value)}
                            className="input"
                        />
                    </div>
                </div>

                <div className="theme-actions" style={{ marginTop: '8px' }}>
                    <button onClick={handleSave} className="btn btn-brand">
                        Save to ENS and Sync Policy
                    </button>
                </div>

                {status && (
                    <div className="theme-status" style={{ marginTop: '20px' }}>
                        <p>{status}</p>
                    </div>
                )}
                </div>
            
        </div>
    );
};

export default Permissions;
