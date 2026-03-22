import { useState } from "react";
import { LayoutDashboard, Bot, ShieldCheck, Wallet } from "lucide-react";

const NAV_ITEMS = [
  { id: "smartwallet", label: "Overview", Icon: LayoutDashboard, description: "Manage Setup" },
  { id: "dashboard", label: "Agents", Icon: Bot, description: "Global Stats" },
  { id: "propose", label: "Security", Icon: ShieldCheck, description: "Execute Actions" },
];

export default function Navbar({ activePage, onNavigate, address, isConnected, isSmartWallet, connectSmartWallet, displayIsLive }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const shortAddr = address && typeof address === "string"
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <nav className="bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-brand-primary/30 shadow-2xl backdrop-blur-xl fixed top-0 w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onNavigate("smartwallet")}>
            <div className="w-11 h-11 bg-gradient-to-br from-brand-primary via-brand-accent to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/50 group-hover:shadow-brand-primary/70 transition-all group-hover:scale-105">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl leading-tight tracking-tight">wardex</h1>
              <p className="text-brand-accent text-xs font-medium">Smart UI</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const { Icon } = item;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={item.description}
                  className={`group relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activePage === item.id
                      ? "bg-brand-primary text-white border border-brand-accent/40 shadow-lg shadow-brand-primary/20"
                      : "text-gray-400 hover:text-gray-100 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 relative z-10">
                    <Icon className={`w-4 h-4 ${activePage === item.id ? "opacity-100" : "opacity-70 group-hover:opacity-100"} transition-opacity`} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Nav Toggle */}
          <button
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Connect / User Info */}
          <div className="hidden lg:flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-400">Connected</span>
                  <span className="text-sm font-mono font-medium text-brand-primary">
                    {shortAddr}
                  </span>
                </div>
                {isSmartWallet ? (
                  <div className="h-8 px-2.5 bg-brand-primary/20 border border-brand-primary/30 rounded-lg flex items-center justify-center">
                    <span className="text-brand-accent text-xs font-bold tracking-wide">SMART</span>
                  </div>
                ) : (
                  <div className="h-8 w-8 bg-gradient-to-br from-green-400 to-emerald-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">EOA</span>
                  </div>
                )}
              </div>
            ) : (
               <button onClick={connectSmartWallet} className="px-5 py-2.5 bg-brand-primary hover:bg-brand-accent text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-primary/25 hover:shadow-brand-accent/40 hover:-translate-y-0.5 border border-brand-primary/50 flex items-center gap-2">
                 <Wallet className="w-4 h-4" />
                 Connect Wallet
               </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const { Icon } = item;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activePage === item.id
                      ? "bg-brand-primary/20 text-white"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            {!isConnected && (
              <button
                onClick={connectSmartWallet}
                className="w-full mt-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-accent text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
