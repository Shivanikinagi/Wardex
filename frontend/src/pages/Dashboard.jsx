import React, { useState, useEffect } from 'react';
import { useContracts } from '../hooks/useContracts';
import { ethers } from 'ethers';

const Dashboard = () => {
    const { contracts, connected, account } = useContracts();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!connected || !contracts?.darkAgent) return;

        const loadProposals = async () => {
            try {
                // Fetch events
                const proposeFilter = contracts.darkAgent.filters.ActionProposed();
                const verifyFilter = contracts.darkAgent.filters.ActionVerified();
                const executeFilter = contracts.darkAgent.filters.ActionExecuted();

                const [proposedEvents, verifiedEvents, executedEvents] = await Promise.all([
                    contracts.darkAgent.queryFilter(proposeFilter, -10000),
                    contracts.darkAgent.queryFilter(verifyFilter, -10000),
                    contracts.darkAgent.queryFilter(executeFilter, -10000)
                ]);

                // Map events into a unified timeline
                const eventMap = new Map();

                proposedEvents.forEach(e => {
                    eventMap.set(e.args.proposalId.toString(), {
                        id: e.args.proposalId.toString(),
                        agent: e.args.agent,
                        user: e.args.user,
                        callData: e.args.actionData,
                        status: 'proposed',
                        timestamp: e.blockNumber, // Use block number as a rough timestamp if needed, or fetch block
                    });
                });

                verifiedEvents.forEach(e => {
                    const mapped = eventMap.get(e.args.proposalId.toString());
                    if (mapped) mapped.status = e.args.isSafe ? 'verified' : 'rejected';
                });

                executedEvents.forEach(e => {
                    const mapped = eventMap.get(e.args.proposalId.toString());
                    if (mapped) mapped.status = 'executed';
                });

                setProposals(Array.from(eventMap.values()).reverse());
                setLoading(false);
            } catch (err) {
                console.error("Error loading proposals:", err);
                setLoading(false);
            }
        };

        loadProposals();
        
        // Listeners for live updates
        contracts.darkAgent.on("ActionProposed", loadProposals);
        contracts.darkAgent.on("ActionVerified", loadProposals);
        contracts.darkAgent.on("ActionExecuted", loadProposals);

        return () => {
            contracts.darkAgent.removeAllListeners();
        };
    }, [connected, contracts]);

    if (!connected) return <div className="p-8 text-center text-gray-500">Please connect your wallet to view the dashboard.</div>;

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold mb-6">Agent Verification Timeline</h1>
            {loading ? (
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">ID</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Agent</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">User</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {proposals.map((proposal) => (
                                <tr key={proposal.id}>
                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                        {proposal.id}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                                        {proposal.agent.substring(0,6)}...{proposal.agent.substring(proposal.agent.length-4)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                                        {proposal.user.substring(0,6)}...{proposal.user.substring(proposal.user.length-4)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize 
                                            ${proposal.status === 'executed' ? 'bg-green-100 text-green-800' : 
                                              proposal.status === 'verified' ? 'bg-blue-100 text-blue-800' :
                                              proposal.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                              'bg-yellow-100 text-yellow-800'}`}>
                                            {proposal.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
