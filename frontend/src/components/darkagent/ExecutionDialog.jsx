import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Wallet, X } from 'lucide-react'
import { StatusBadge } from './Ui'

const verifierAddress = import.meta.env.VITE_VERIFIER_CONTRACT || ''

export function ExecutionDialog({ open, onOpenChange, blink, analysis, execution, onConfirm, confirming }) {
  const resolvedVerifierAddress = execution?.verifierContract || verifierAddress
  const verifierUrl = resolvedVerifierAddress
    ? `https://sepolia.basescan.org/address/${resolvedVerifierAddress}`
    : ''

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <AnimatePresence>
          <Dialog.Overlay asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
          </Dialog.Overlay>
          <Dialog.Content asChild>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 md:items-center"
            >
              <div className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0c1118]/95 p-4 shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:max-h-[calc(100vh-40px)] md:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-white">Execution Preview</Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-slate-400">Review before execution.</Dialog.Description>
                  </div>
                  <Dialog.Close className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:text-white">
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Trade</div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {blink?.tokenIn} to {blink?.tokenOut}
                    </div>
                    <div className="mt-1.5 text-sm text-slate-400">
                      {blink?.action} on {blink?.protocol} - {blink?.chain}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">DarkAgent Verdict</div>
                    <div className="mt-2 flex items-center gap-3">
                      <StatusBadge status={analysis?.status || 'safe'}>{analysis?.status || 'safe'}</StatusBadge>
                      <div className="text-sm text-slate-300">Score {analysis?.score || '--'}</div>
                    </div>
                  </div>
                </div>

                {!execution ? (
                  <div className="mt-4 rounded-[24px] border border-white/10 bg-[#0b1016] p-4">
                    <div className="flex items-center gap-3 text-white">
                      <Wallet className="h-4.5 w-4.5 text-vault-green" />
                      <div className="text-base font-semibold">Wallet confirmation</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {analysis?.status === 'downsized' ? 'Rewritten safe Blink.' : 'Approved Blink.'}
                    </div>
                    <div className="mt-4 flex justify-start">
                      <button
                        type="button"
                        onClick={onConfirm}
                        disabled={confirming}
                        className="inline-flex items-center gap-2 rounded-full bg-vault-green px-5 py-3 text-sm font-semibold text-black transition hover:bg-vault-green/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Wallet className="h-4 w-4" /> {confirming ? 'Confirming...' : 'Confirm Execution'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <div className="flex items-center gap-3 text-emerald-100">
                      <CheckCircle2 className="h-5 w-5" />
                      <div className="text-base font-semibold">Execution confirmed</div>
                    </div>
                    <div className="mt-2 text-sm text-emerald-50/90">
                      Blink executed through DarkAgent.
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-emerald-50/90 break-all">
                      <div><span className="font-semibold">Transaction ID:</span> {execution.txid}</div>
                      <div><span className="font-semibold">Stealth address:</span> {execution.stealthAddress}</div>
                      {execution.proof && (
                        <div>
                          <span className="font-semibold">ZK Proof:</span>{' '}
                          {verifierUrl ? (
                            <a 
                              href={verifierUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-emerald-300 hover:text-emerald-200 underline"
                            >
                              View Verifier Contract on Base
                            </a>
                          ) : (
                            <span>Verifier address not configured</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </Dialog.Content>
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
