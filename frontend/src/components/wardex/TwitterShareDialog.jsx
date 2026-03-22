import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, ExternalLink, Twitter, X } from 'lucide-react'
import { StatusBadge } from './Ui'

function DialogContent({ children }) {
  return (
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
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div className="flex max-h-full w-full max-w-[680px] flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#0c1118]/95 p-5 shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:p-6">
              {children}
            </div>
          </motion.div>
        </Dialog.Content>
      </AnimatePresence>
    </Dialog.Portal>
  )
}

export function TwitterShareDialog({
  open,
  onOpenChange,
  tweet,
  blinkUrl,
  displayUrl,
  posted,
  intentUrl,
  onCopy,
  onPost,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Dialog.Title className="text-2xl font-semibold text-white">Share to X</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-400">Open the X composer.</Dialog.Description>
          </div>
          <Dialog.Close className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:text-white">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </div>

        <div className="mt-5 min-h-0 overflow-y-auto pr-1">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vault-blue/20 text-sm font-semibold text-vault-blue">
                {tweet.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-white">{tweet.name}</div>
                  <div className="text-sm text-slate-500">{tweet.handle}</div>
                  <StatusBadge status={posted ? 'safe' : 'downsized'}>{posted ? 'Composer opened' : 'Ready to post'}</StatusBadge>
                </div>
                <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{tweet.copy}</div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b1016] p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Blink Link</div>
                  <div className="mt-2 text-sm font-medium text-white">{displayUrl}</div>
                  <div className="mt-2 break-all text-[11px] leading-5 text-slate-400">{blinkUrl}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <Copy className="h-4 w-4" /> Copy Blink
          </button>
          <button
            onClick={onPost}
            className="inline-flex items-center gap-2 rounded-full bg-[#1d9bf0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a8ad4]"
          >
            {posted ? <Check className="h-4 w-4" /> : <Twitter className="h-4 w-4" />}
            {posted ? 'Open X again' : 'Open X composer'}
          </button>
          <a
            href={intentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" /> Intent URL
          </a>
        </div>
      </DialogContent>
    </Dialog.Root>
  )
}
