const fs = require('fs');
const filePaths = [
  'f:/shivani/VSCode/projects/Oracle/WARDEX/frontend/src/pages/Dashboard.jsx',
  'f:/shivani/VSCode/projects/Oracle/WARDEX/frontend/src/pages/Proposer.jsx',
  'f:/shivani/VSCode/projects/Oracle/WARDEX/frontend/src/pages/SmartWallet.jsx'
];
for (const path of filePaths) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/className=\"page-shell\"/g, 'className=\"relative min-h-screen py-8\"');
  content = content.replace(/className=\"page-content\"/g, 'className=\"relative z-10 max-w-7xl mx-auto\"');
  content = content.replace(/className=\"hero\"/g, 'className=\"flex flex-col items-center justify-center text-center space-y-8 py-20 animate-fade-in\"');
  content = content.replace(/className=\"hero-badge\"/g, 'className=\"inline-flex items-center gap-2 px-4 py-2 rounded-full border border-vault-blue/30 bg-vault-blue/10 text-vault-blue text-sm font-medium\"');
  content = content.replace(/className=\"dot\"/g, 'className=\"w-2 h-2 rounded-full bg-current animate-pulse\"');
  content = content.replace(/className=\"gradient\"/g, 'className=\"text-transparent bg-clip-text bg-gradient-to-r from-vault-blue to-vault-green\"');
  content = content.replace(/className=\"subtitle\"/g, 'className=\"text-lg text-vault-slate max-w-2xl\"');
  content = content.replace(/className=\"hero-cta\"/g, 'className=\"flex gap-4\"');
  content = content.replace(/className=\"btn btn-brand([^\"]*)\"/g, 'className=\"px-6 py-3 rounded-xl bg-vault-blue hover:bg-vault-blue/90 text-white font-semibold transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)]\"');
  content = content.replace(/className=\"btn btn-danger([^\"]*)\"/g, 'className=\"px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-semibold transition-all\"');
  content = content.replace(/className=\"btn([^\"]*)\"/g, 'className=\"px-6 py-3 rounded-xl bg-vault-slate/10 hover:bg-vault-slate/20 text-vault-text font-semibold transition-all\"');
  content = content.replace(/className=\"grid-3\"/g, 'className=\"grid grid-cols-1 md:grid-cols-3 gap-6\"');
  content = content.replace(/className=\"grid-2\"/g, 'className=\"grid grid-cols-1 md:grid-cols-2 gap-6\"');
  content = content.replace(/className=\"glass-card([^\"]*)\"/g, 'className=\"p-6 rounded-2xl border border-vault-slate/20 bg-[#1a1d23]/50 backdrop-blur-xl hover:border-vault-green/30 transition-all duration-300\"');
  content = content.replace(/className=\"page-header\"/g, 'className=\"mb-12 space-y-2\"');
  content = content.replace(/<h2>/g, '<h2 className=\"text-3xl font-bold text-vault-text\">');
  content = content.replace(/className=\"stats-grid stagger\"/g, 'className=\"grid grid-cols-1 md:grid-cols-4 gap-6 mb-8\"');
  content = content.replace(/className=\"stat-card([^\"]*)\"/g, 'className=\"p-6 rounded-2xl border border-vault-slate/20 bg-vault-bg/50 backdrop-blur transition-colors\"');
  content = content.replace(/className=\"stat-label\"/g, 'className=\"text-sm font-medium text-vault-slate tracking-wider uppercase mb-2\"');
  content = content.replace(/className=\"stat-value([^\"]*)\"/g, 'className=\"text-3xl font-bold mb-1\"');
  content = content.replace(/className=\"stat-subtitle\"/g, 'className=\"text-sm text-vault-slate\"');
  content = content.replace(/className=\"nav-link active\"/g, 'className=\"px-4 py-2 rounded-lg bg-vault-green/10 text-vault-green border border-vault-green/20 font-medium transition-all\"');
  content = content.replace(/className=\"nav-link\"/g, 'className=\"px-4 py-2 rounded-lg text-vault-slate hover:bg-vault-slate/10 hover:text-vault-text font-medium transition-all\"');
  content = content.replace(/className=\"card-header\"/g, 'className=\"flex items-center justify-between mb-6\"');
  content = content.replace(/className=\"card-title\"/g, 'className=\"text-xl font-bold text-vault-text flex items-center gap-2\"');
  content = content.replace(/className=\"badge badge-frozen\"/g, 'className=\"inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-semibold uppercase tracking-wider\"');
  content = content.replace(/className=\"badge badge-active\"/g, 'className=\"inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-vault-green/10 text-vault-green border border-vault-green/20 text-xs font-semibold uppercase tracking-wider\"');
  content = content.replace(/className=\"badge([^\"]*)\"/g, 'className=\"inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-vault-slate/10 text-vault-slate border border-vault-slate/20 text-xs font-semibold uppercase tracking-wider\"');
  content = content.replace(/className=\"input-group\"/g, 'className=\"space-y-2 mb-4\"');
  content = content.replace(/<label>/g, '<label className=\"block text-sm font-medium text-vault-slate\">');
  content = content.replace(/className=\"input([^\"]*)\"/g, 'className=\"w-full px-4 py-3 rounded-xl bg-black/40 border border-vault-slate/30 text-vault-text focus:border-vault-green/50 focus:outline-none focus:ring-1 focus:ring-vault-green/50 transition-all\"');
  content = content.replace(/className=\"progress-bar\"/g, 'className=\"h-2 w-full bg-black/40 rounded-full overflow-hidden\"');
  content = content.replace(/className=\"progress-fill([^\"]*)\"/g, 'className=\"h-full bg-vault-green transition-all duration-500\"');
  content = content.replace(/className=\"cb-panel\"/g, 'className=\"p-8 rounded-2xl border-2 border-red-500/30 bg-red-500/5 relative overflow-hidden\"');
  content = content.replace(/className=\"tx-list\"/g, 'className=\"space-y-4\"');
  content = content.replace(/className=\"tx-item\"/g, 'className=\"p-4 rounded-xl border border-vault-slate/20 bg-vault-bg/50 hover:bg-vault-slate/10 transition-colors flex items-center justify-between\"');
  fs.writeFileSync(path, content);
}
