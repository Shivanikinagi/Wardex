import React, { useState, useEffect } from "react";
import { useSmartWallet } from "../hooks/useSmartWallet";
import { useContracts } from "../hooks/useContracts";
import { formatEther } from "viem";

const SmartWallet = () => {
  const { connectMetaMask } = useContracts();
  const {
    address,
    isConnected,
    isSmartWallet,
      walletInfo: realWalletInfo,
      protocolStats,
      loading: realLoading,
      error,
      connectSmartWallet,
      disconnectWallet,
      registerWallet,
      authorizeAgent,
      revokeAgent,
      freezeWallet,
      unfreezeWallet,
      getAgentAuth,
      setError,
    } = useSmartWallet();

    const [mockWalletInfo, setMockWalletInfo] = useState(null);
    const [mockLoading, setMockLoading] = useState(false);
    
    const walletInfo = realWalletInfo || mockWalletInfo;
    const loading = realLoading || mockLoading;

  const [agentAddress, setAgentAddress] = useState("0x1111111111111111111111111111111111111111");
  const [spendLimit, setSpendLimit] = useState("1");
  const [dailyLimit, setDailyLimit] = useState("10");
  const [duration, setDuration] = useState("30");
  const [freezeReason, setFreezeReason] = useState("");
  const [status, setStatus] = useState("");
  const [agentAuthInfo, setAgentAuthInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Check agent authorization when agent address changes
  useEffect(() => {
    if (isConnected && agentAddress && agentAddress.length === 42) {
      checkAgentAuth();
    }
  }, [isConnected, agentAddress]);

  const checkAgentAuth = async () => {
    try {
      const auth = await getAgentAuth(agentAddress);
      setAgentAuthInfo(auth);
    } catch {
      setAgentAuthInfo(null);
    }
  };

  const handleRegister = async () => {
    try {
      setMockLoading(true);
      setStatus("Registering smart wallet with wardex protocol...");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      setMockWalletInfo({
        smartWallet: address || "0xMockSmartWallet123",
        owner: address || "0xMockOwner123",
        frozen: false,
        registeredAt: Math.floor(Date.now() / 1000),
        totalExecutions: 0,
        totalSpent: 0n,
      });

      setStatus("Smart wallet registered successfully!");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setMockLoading(false);
    }
  };

  const handleAuthorize = async () => {
    try {
      setMockLoading(true);
      setStatus(`Authorizing agent ${agentAddress.slice(0, 8)}...`);
      // Mock interaction
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStatus("Agent authorized successfully! ENS rules synchronized.");

      // Mock state update
      setAgentAuthInfo({
        authorized: true,
        spendLimit: BigInt(parseFloat(spendLimit) * 10**18),
        dailyLimit: BigInt(parseFloat(dailyLimit) * 10**18),
        dailySpent: 0n,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + parseFloat(duration) * 86400)
      });
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || 'Transaction failed'}`);
    } finally {
      setMockLoading(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setMockLoading(true);
      setStatus(`Revoking agent ${agentAddress.slice(0, 8)}...`);
      // Mock interaction
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStatus("Agent revoked successfully!");

      // Mock state update
      setAgentAuthInfo(null);
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || 'Transaction failed'}`);
    } finally {
      setMockLoading(false);
    }
  };

  const handleFreeze = async () => {
    try {
      setStatus(`Stopping and revoking agent: ${agentAddress}...`);
      await revokeAgent(agentAddress);
      setStatus("Agent successfully stopped and revoked.");
      await checkAgentAuth();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleUnfreeze = async () => {
    try {
      setMockLoading(true);
      setStatus("Unfreezing wallet...");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setMockWalletInfo(prev => prev ? { ...prev, frozen: false } : prev);
      setStatus("Wallet unfrozen! Agent executions are now allowed.");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setMockLoading(false);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="relative min-h-screen py-8">
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Hero Section */}
        {!isConnected && (
          <div className="flex flex-col items-center justify-center text-center space-y-8 py-20 animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 mt-12 text-vault-text">
              Agentic Autonomy.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-vault-blue to-vault-green">Without the Hacks.</span>
            </h1>
            
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-4">
                <button className="px-6 py-3 rounded-xl bg-vault-blue hover:bg-vault-blue/90 text-white font-semibold transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)]" onClick={connectSmartWallet}>
                  Connect Smart Wallet
                </button>
                <button className="px-6 py-3 rounded-xl border border-vault-slate/20 bg-vault-bg/50 text-vault-text font-semibold hover:bg-vault-slate/10 transition-colors" onClick={connectMetaMask}>
                  Connect MetaMask
                </button>
              </div>
              {error && (
                <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm max-w-md">
                  {error}
                </div>
              )}
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-12 mb-8">
              <div className="p-8 rounded-2xl border border-vault-slate/20 bg-vault-bg/40 backdrop-blur-xl hover:border-vault-blue/40 shadow-lg hover:shadow-[0_0_30px_rgba(14,165,233,0.15)] transition-all duration-300 relative overflow-hidden group text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-vault-blue/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-vault-blue/10 transition-colors duration-500"></div>
                <div className="w-12 h-12 rounded-xl bg-vault-blue/10 flex items-center justify-center mb-6 border border-vault-blue/20 text-vault-blue group-hover:scale-110 transition-transform duration-300">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h3 className="text-xl font-bold mb-3 text-vault-text">Coinbase & Base</h3>
                <p className="text-vault-slate leading-relaxed text-sm">
                  Leveraging <strong>Coinbase Smart Wallets</strong> (ERC-4337) for passkey onboarding, allowing <strong>gas-sponsored</strong> agent transactions that execute flawlessly on the <strong>Base</strong> network.
                </p>
              </div>

              <div className="p-8 rounded-2xl border border-vault-slate/20 bg-vault-bg/40 backdrop-blur-xl hover:border-vault-green/40 shadow-lg hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300 relative overflow-hidden group text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-vault-green/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-vault-green/10 transition-colors duration-500"></div>
                <div className="w-12 h-12 rounded-xl bg-vault-green/10 flex items-center justify-center mb-6 border border-vault-green/20 text-vault-green group-hover:scale-110 transition-transform duration-300">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
                </div>
                <h3 className="text-xl font-bold mb-3 text-vault-text">ENS Subdomain Rulebook</h3>
                <p className="text-vault-slate leading-relaxed text-sm">
                  Users attach agent licenses as text records directly to <strong>ENS Subdomains</strong>. Setting limits, slippage, and whitelists directly to their identity (e.g., agent.alice.eth).
                </p>
              </div>

              <div className="p-8 rounded-2xl border border-vault-slate/20 bg-vault-bg/40 backdrop-blur-xl hover:border-red-500/40 shadow-lg hover:shadow-[0_0_30px_rgba(239,68,68,0.15)] transition-all duration-300 relative overflow-hidden group text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-red-500/10 transition-colors duration-500"></div>
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20 text-red-500 group-hover:scale-110 transition-transform duration-300">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <h3 className="text-xl font-bold mb-3 text-vault-text">Tenderly & Policy Enforcement</h3>
                <p className="text-vault-slate leading-relaxed text-sm">
                  Transactions are simulated via <strong>Tenderly</strong> to score risk before execution. Final circuit-breakers and stealth enforcement at the policy level are handled by the wardex execution layer.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connected State */}
        {isConnected && (
          <div className="animate-fade-in">
            {/* Page Header */}
            <div className="mb-12 space-y-2">
              <h2 className="text-3xl font-bold text-vault-text">Smart Wallet Dashboard</h2>
              <p>Manage your Coinbase Smart Wallet and AI agent permissions</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="p-6 rounded-2xl border border-vault-slate/20 bg-vault-bg/50 backdrop-blur transition-colors">
                <div className="text-sm font-medium text-vault-slate tracking-wider uppercase mb-2">Connected Wallet</div>
                <div
                  className="text-3xl font-bold mb-1"
                  style={{ fontSize: "1rem", fontFamily: "var(--font-mono)" }}
                >
                  {address
                    ? `${address.slice(0, 6)}...${address.slice(-4)}`
                    : "—"}
                </div>
                <div className="text-sm text-vault-slate flex items-center gap-2">
                  {isSmartWallet
                    ? <><span className="w-2 h-2 rounded-full bg-vault-blue"></span> Coinbase Smart Wallet</>
                    : <><span className="w-2 h-2 rounded-full bg-vault-slate"></span> External Wallet</>}
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-vault-slate/20 bg-vault-bg/50 backdrop-blur transition-colors">
                <div className="text-sm font-medium text-vault-slate tracking-wider uppercase mb-2">Wallet Status</div>
                <div
                  className={`stat-value flex items-center gap-2 ${
                    walletInfo?.frozen ? "text-red-500" : "text-vault-green"
                  }`}
                >
                  {walletInfo
                    ? walletInfo.frozen
                      ? <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> FROZEN</>
                      : <><span className="w-2 h-2 rounded-full bg-vault-green animate-pulse"></span> ACTIVE</>
                    : <><span className="w-2 h-2 rounded-full bg-vault-slate"></span> NOT REGISTERED</>}
                </div>
                <div className="text-sm text-vault-slate mt-1">
                  {walletInfo
                    ? `Registered ${new Date(
                        walletInfo.registeredAt * 1000,
                      ).toLocaleDateString()}`
                    : "Register to get started"}
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-vault-slate/20 bg-vault-bg/50 backdrop-blur transition-colors">
                <div className="text-sm font-medium text-vault-slate tracking-wider uppercase mb-2">Total Executions</div>
                <div className="text-3xl font-bold mb-1">
                  {walletInfo?.totalExecutions || 0}
                </div>
                <div className="text-sm text-vault-slate">
                  {walletInfo?.totalSpent
                    ? `${formatEther(walletInfo.totalSpent)} ETH spent`
                    : "No activity yet"}
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-vault-slate/20 bg-vault-bg/50 backdrop-blur transition-colors">
                <div className="text-sm font-medium text-vault-slate tracking-wider uppercase mb-2">Protocol Stats</div>
                <div className="text-3xl font-bold mb-1">
                  {protocolStats.totalWallets}
                </div>
                <div className="text-sm text-vault-slate">
                  {protocolStats.totalExecutions} total executions
                </div>
              </div>
            </div>

            {/* Main Sections */}
            <div className="space-y-12 animate-fade-in mt-8">
              {/* Overview Section */}
              <section>
                <h3 className="text-2xl font-bold text-vault-text mb-6 flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-slate"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  Overview Workspace
                </h3>
                {/* Registration Card */}
                {!walletInfo && (
                  <div
                    className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/50 backdrop-blur-xl hover:border-vault-green/30 transition-all duration-300"
                    style={{ marginBottom: "24px" }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-xl font-bold text-vault-text flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-blue"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        Register Your Smart Wallet
                      </div>
                    </div>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                        marginBottom: "16px",
                      }}
                    >
                      Register your Coinbase Smart Wallet with the wardex
                      protocol to enable AI agent verification, spending
                      controls, and emergency freeze capabilities.
                    </p>
                    <button
                      className="px-6 py-3 rounded-xl bg-vault-blue hover:bg-vault-blue/90 text-white font-semibold transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)]"
                      onClick={handleRegister}
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Registering...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                          Register Wallet
                        </div>
                      )}
                    </button>
                  </div>
                )}

                {/* Wallet Details */}
                {walletInfo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/50 backdrop-blur-xl hover:border-vault-green/30 transition-all duration-300">
                      <div className="flex items-center justify-between mb-6">
                      <div className="text-xl font-bold text-vault-text flex items-center gap-2">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-slate"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          Wallet Details
                        </div>
                        <span
                          className={`badge ${
                            walletInfo.frozen ? "badge-frozen" : "badge-active"
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                          {walletInfo.frozen ? "Frozen" : "Active"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            Execution Vault (Smart Wallet)
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.85rem",
                              color: "var(--brand-pink)",
                            }}
                          >
                            {walletInfo.smartWallet}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            Root Admin (EOA)
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.85rem",
                            }}
                          >
                            {walletInfo.owner}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ gap: "12px" }}>
                          <div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                textTransform: "uppercase",
                              }}
                            >
                              Total Executions
                            </div>
                            <div
                              style={{
                                fontSize: "1.5rem",
                                fontWeight: 800,
                                color: "var(--accent-cyan)",
                              }}
                            >
                              {walletInfo.totalExecutions}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                textTransform: "uppercase",
                              }}
                            >
                              Total Spent
                            </div>
                            <div
                              style={{
                                fontSize: "1.5rem",
                                fontWeight: 800,
                                color: "var(--accent-amber)",
                              }}
                            >
                              {formatEther(walletInfo.totalSpent || 0n)} ETH
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Architecture Diagram */}
                    <div className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/50 backdrop-blur-xl hover:border-vault-green/30 transition-all duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <div className="text-xl font-bold text-vault-text flex items-center gap-2">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-slate"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                          Integration Architecture
                        </div>
                      </div>
                      <div className="code-window">
                        <div className="code-window-bar">
                          <div className="code-dot red"></div>
                          <div className="code-dot yellow"></div>
                          <div className="code-dot green"></div>
                        </div>
                        <div className="code-window-body">
                          <div className="code-preview">
                            <div>
                              <span className="cmt">
                                {"// Coinbase Smart Wallet + wardex Flow"}
                              </span>
                            </div>
                            <div>&nbsp;</div>
                            <div>
                              <span className="kw">User</span> →{" "}
                              <span className="fn">Coinbase Smart Wallet</span>
                            </div>
                            <div>
                              {"  "}
                              <span className="cmt">
                                {"// Passkey or EOA ownership"}
                              </span>
                            </div>
                            <div>&nbsp;</div>
                            <div>
                              <span className="kw">Agent</span> →{" "}
                              <span className="fn">wardex.propose()</span>
                            </div>
                            <div>
                              {"  "}
                              <span className="cmt">
                                {"// Agent submits action"}
                              </span>
                            </div>
                            <div>&nbsp;</div>
                            <div>
                              <span className="kw">ENS</span> →{" "}
                              <span className="fn">wardex.verify()</span>
                            </div>
                            <div>
                              {"  "}
                              <span className="cmt">
                                {"// Check ENS permissions"}
                              </span>
                            </div>
                            <div>&nbsp;</div>
                            <div>
                              <span className="kw">Adapter</span> →{" "}
                              <span className="fn">SmartWallet.execute()</span>
                            </div>
                            <div>
                              {"  "}
                              <span className="cmt">
                                {"// Execute through wallet"}
                              </span>
                            </div>
                            <div>&nbsp;</div>
                            <div>
                              <span className="str">
                                {"✓ Verified + Executed on Base"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Agents Section */}
              <section>
                <h3 className="text-2xl font-bold text-vault-text mb-6 flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-blue"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  Agent Permissions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Authorize Agent */}
                  <div className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/50 backdrop-blur-xl hover:border-vault-green/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-xl font-bold text-vault-text flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-green"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
                        Authorize AI Agent (Session Key)
                      </div>
                      <span className="badge badge-active text-xs">
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                        ENS Rulebook Sync
                      </span>
                    </div>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.85rem",
                        marginBottom: "16px",
                      }}
                    >
                      Issue a Session Key to grant an AI agent permission. 
                      Limits and allowed protocols are resolved securely via your ENS text records.
                    </p>

                    <div className="space-y-2 mb-4">
                      <label className="block text-sm font-medium text-vault-slate">Agent Address</label>
                      <input
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-vault-slate/30 text-vault-text focus:border-vault-green/50 focus:outline-none focus:ring-1 focus:ring-vault-green/50 transition-all"
                        value={agentAddress}
                        onChange={(e) => setAgentAddress(e.target.value)}
                        placeholder="0x..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ gap: "12px" }}>
                      <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-vault-slate">Max Per Transaction (ETH)</label>
                        <input
                          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-vault-slate/30 text-vault-text focus:border-vault-green/50 focus:outline-none focus:ring-1 focus:ring-vault-green/50 transition-all"
                          type="number"
                          step="0.01"
                          value={spendLimit}
                          onChange={(e) => setSpendLimit(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 mb-4">
                        <label className="block text-sm font-medium text-vault-slate">Daily Limit (ETH)</label>
                        <input
                          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-vault-slate/30 text-vault-text focus:border-vault-green/50 focus:outline-none focus:ring-1 focus:ring-vault-green/50 transition-all"
                          type="number"
                          step="0.1"
                          value={dailyLimit}
                          onChange={(e) => setDailyLimit(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <label className="block text-sm font-medium text-vault-slate">Authorization Duration (Days)</label>
                      <input
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-vault-slate/30 text-vault-text focus:border-vault-green/50 focus:outline-none focus:ring-1 focus:ring-vault-green/50 transition-all"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                      />
                    </div>

                    <div
                      style={{ display: "flex", gap: "8px", marginTop: "8px" }}
                    >
                      <button
                        className="px-6 py-3 rounded-xl bg-vault-blue hover:bg-vault-blue/90 text-white font-semibold transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)] flex items-center justify-center gap-2"
                        onClick={handleAuthorize}
                        disabled={loading || !walletInfo}
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Authorize Agent
                          </>
                        )}
                      </button>
                      <button
                        className="px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-semibold transition-all flex items-center justify-center gap-2"
                        onClick={handleRevoke}
                        disabled={loading || !agentAuthInfo?.authorized}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        Revoke Agent
                      </button>
                    </div>
                  </div>

                  {/* Agent Status */}
                  <div className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/50 backdrop-blur-xl hover:border-vault-green/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-xl font-bold text-vault-text flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-slate"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        Agent Authorization Status
                      </div>
                    </div>

                    {agentAuthInfo ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            className={`badge ${
                              agentAuthInfo.authorized
                                ? "badge-active"
                                : "badge-frozen"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                            {agentAuthInfo.authorized
                              ? "Authorized"
                              : "Not Authorized"}
                          </span>
                        </div>

                        {agentAuthInfo.authorized && (
                          <>
                            <div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  marginBottom: "4px",
                                }}
                              >
                                Per-Transaction Limit
                              </div>
                              <div
                                style={{
                                  fontSize: "1.3rem",
                                  fontWeight: 700,
                                  color: "var(--accent-cyan)",
                                }}
                              >
                                {formatEther(agentAuthInfo.spendLimit)} ETH
                              </div>
                            </div>

                            <div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  marginBottom: "4px",
                                }}
                              >
                                Daily Limit
                              </div>
                              <div
                                style={{
                                  fontSize: "1.3rem",
                                  fontWeight: 700,
                                  color: "var(--accent-amber)",
                                }}
                              >
                                {formatEther(agentAuthInfo.dailyLimit)} ETH
                              </div>
                              <div
                                className="h-2 w-full bg-black/40 rounded-full overflow-hidden"
                                style={{ marginTop: "8px" }}
                              >
                                <div
                                  className="h-full bg-vault-green transition-all duration-500"
                                  style={{
                                    width: `${
                                      agentAuthInfo.dailyLimit > 0n
                                        ? Number(
                                            (agentAuthInfo.dailySpent * 100n) /
                                              agentAuthInfo.dailyLimit,
                                          )
                                        : 0
                                    }%`,
                                  }}
                                ></div>
                              </div>
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-muted)",
                                  marginTop: "4px",
                                }}
                              >
                                {formatEther(agentAuthInfo.dailySpent)} /{" "}
                                {formatEther(agentAuthInfo.dailyLimit)} ETH used
                                today
                              </div>
                            </div>

                            <div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  marginBottom: "4px",
                                }}
                              >
                                Expires
                              </div>
                              <div
                                style={{
                                  fontSize: "0.9rem",
                                  fontFamily: "var(--font-mono)",
                                }}
                              >
                                {new Date(
                                  Number(agentAuthInfo.expiresAt) * 1000
                                ).toLocaleString()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "32px 0",
                          color: "var(--text-muted)",
                        }}
                      >
                        <div style={{ marginBottom: "16px" }} className="flex justify-center text-vault-slate">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path></svg>
                        </div>
                        <p>
                          Enter an agent address to check its authorization
                          status
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Security Section */}
              <section>
                <h3 className="text-2xl font-bold text-vault-text mb-6 flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  Security Operations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Circuit Breaker */}
                  <div className="p-8 rounded-2xl border-2 border-red-500/30 bg-red-500/5 relative overflow-hidden" style={{ gridColumn: "span 2" }}>
                    <h3
                      className="text-xl font-bold flex items-center gap-2 mb-2 text-accent-red"
                      style={{
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      Emergency Circuit Breaker
                    </h3>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                        marginBottom: "16px",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      Instantly freeze your smart wallet to block ALL agent
                      executions. Enforced by the policy execution layer so even leaked keys cannot act maliciously.
                    </p>

                    {walletInfo?.frozen ? (
                      <div style={{ position: "relative", zIndex: 1 }}>
                        <div
                          className="flex items-center justify-center gap-3"
                          style={{
                            fontSize: "1.5rem",
                            fontWeight: 800,
                            color: "var(--accent-red)",
                            marginBottom: "16px",
                          }}
                        >
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                          WALLET IS FROZEN
                        </div>
                        <button
                          className="px-6 py-3 rounded-xl bg-vault-blue hover:bg-vault-blue/90 text-white font-semibold transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)]"
                          onClick={handleUnfreeze}
                          disabled={loading}
                          style={{ margin: "0 auto" }}
                        >
                          {loading ? "⏳ Processing..." : (
                            <div className="flex items-center gap-2">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                              Unfreeze Wallet
                            </div>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: "relative", zIndex: 1 }}>
                        <div
                          className="space-y-2 mb-4"
                          style={{ maxWidth: "400px", margin: "0 auto 16px" }}
                        >
                          <label className="block text-sm font-medium text-vault-slate">Freeze Reason (Optional)</label>
                          <input
                            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-vault-slate/30 text-vault-text focus:border-vault-green/50 focus:outline-none focus:ring-1 focus:ring-vault-green/50 transition-all"
                            value={freezeReason}
                            onChange={(e) => setFreezeReason(e.target.value)}
                            placeholder="Suspicious agent activity detected..."
                          />
                        </div>
                        <button
                          className="kill-btn"
                          onClick={handleFreeze}
                          disabled={loading || !walletInfo}
                        >
                          <span className="icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                          </span>
                          <span>{loading ? "STOPPING..." : "STOP ACTIVE AGENT"}</span>
                        </button>
                        <p
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.8rem",
                            marginTop: "12px",
                          }}
                        >
                          This will immediately prevent all authorized agents
                          from executing transactions.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* wardex Verification */}
                  <div className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/50 backdrop-blur-xl hover:border-vault-green/30 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-xl font-bold text-vault-text flex items-center gap-2">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-green"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        wardex Verification
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <span className="text-vault-blue">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></svg>
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                            ENS Permission Records
                          </div>
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: "0.82rem",
                            }}
                          >
                            Agent permissions defined through ENSIP-XX text
                            records (max_spend, slippage, protocols).
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <span className="text-vault-slate">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                            On-Chain Verification
                          </div>
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: "0.82rem",
                            }}
                          >
                            Every agent action is verified against ENS rules
                            before execution through the smart wallet.
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <span className="text-vault-green">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                            Spending Controls
                          </div>
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: "0.82rem",
                            }}
                          >
                            Per-transaction limits, daily caps, and automatic
                            reset — enforced at the smart contract level.
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <span className="text-vault-blue">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                            Session Keys
                          </div>
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: "0.82rem",
                            }}
                          >
                            Temporary session keys enable gas-sponsored agent
                            transactions with built-in expiry.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Status Bar */}
            {(status || error) && (
              <div
                className="p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/50 backdrop-blur-xl hover:border-vault-green/30 transition-all duration-300"
                style={{ marginTop: "24px" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="text-xl font-bold text-vault-text flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-vault-slate"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
                    Status
                  </div>
                  <button
                    className="px-6 py-3 rounded-xl bg-vault-slate/10 hover:bg-vault-slate/20 text-vault-text font-semibold transition-all"
                    onClick={() => {
                      setStatus("");
                      setError(null);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.85rem",
                    color: error
                      ? "var(--accent-red)"
                      : "var(--accent-emerald)",
                    wordBreak: "break-all",
                  }}
                >
                  {error || status}
                </div>
              </div>
            )}

            {/* Disconnect */}
            <div style={{ textAlign: "center", marginTop: "32px" }}>
              <button className="px-6 py-3 rounded-xl bg-vault-slate/10 hover:bg-vault-slate/20 text-vault-text font-semibold transition-all" onClick={disconnectWallet}>
                Disconnect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartWallet;
