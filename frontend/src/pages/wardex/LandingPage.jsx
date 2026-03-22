import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { AppShell, GlowButton, HeroMockCard, PageHeader, StatusBadge, ViewportFit } from '../../components/wardex/Ui'

export default function LandingPage() {
  return (
    <AppShell>
      <ViewportFit>
        <section className="mx-auto flex max-w-3xl flex-col items-center justify-center pt-8 md:pt-16 pb-12 gap-8 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Not every Blink deserves your wallet.
              </h1>
              <p className="max-w-xl text-base leading-6 text-slate-300">
                Set your rules. Review every Blink. Execute only the safe version.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <GlowButton as={Link} to="/create" className="bg-vault-green text-black hover:bg-vault-green/90">
                  Try Demo <ArrowRight className="h-4 w-4" />
                </GlowButton>
                <GlowButton as={Link} to="/dashboard" className="border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]">
                  Set Policy
                </GlowButton>
              </div>
            </div>

            <div className="mt-12 w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-vault-slate">Live policy</div>
                  <div className="mt-2 text-lg font-semibold text-white">Every shared Blink is checked first.</div>
                </div>
                <StatusBadge status="safe">Active</StatusBadge>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/8 bg-black/20 px-5 py-3.5">AI bot limit: $300</div>
                <div className="rounded-2xl border border-white/8 bg-black/20 px-5 py-3.5">Meme coins: Blocked</div>
                <div className="rounded-2xl border border-white/8 bg-black/20 px-5 py-3.5">Trusted protocols: On</div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Policy-first</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Real X share intent</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Execution preview</span>
            </div>
          </div>
        </section>
      </ViewportFit>
    </AppShell>
  )
}
