import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Shield, ShieldAlert, ShieldCheck, ShieldX, Sparkles } from 'lucide-react'

const verdictStyles = {
  safe: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  risky: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  blocked: 'border-red-400/20 bg-red-400/10 text-red-200',
  downsized: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
}

const verdictIcons = {
  safe: ShieldCheck,
  risky: ShieldAlert,
  blocked: ShieldX,
  downsized: Sparkles,
}

export function AppShell({ children }) {
  const navItems = [
    ['/', 'Home'],
    ['/dashboard', 'Policy'],
    ['/create', 'Create'],
    ['/analyze', 'Analyze'],
    ['/activity', 'Activity'],
  ]

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto bg-[#0a0f14] text-vault-text">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_left,rgba(0,255,136,0.08),transparent_30%)]" />
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0a0f14]/86 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-vault-green/20 bg-vault-green/10 text-vault-green">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight text-white">wardex</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-vault-slate">Blink trading firewall</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex">
            {navItems.map(([href, label]) => (
              <NavLink
                key={href}
                to={href}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-2 text-sm transition ${
                    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <Link
            to="/create"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          >
            Try Demo
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto min-h-[calc(100vh-65px)] max-w-6xl px-5 py-4 lg:px-8 lg:py-5">{children}</main>
    </div>
  )
}

export function ViewportFit({ children, className = '' }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      if (!outerRef.current || !innerRef.current) return
      const availableHeight = outerRef.current.clientHeight
      const contentHeight = innerRef.current.scrollHeight
      if (!availableHeight || !contentHeight) return

      const nextScale = Math.min(1, availableHeight / contentHeight)
      setScale((current) => (Math.abs(current - nextScale) < 0.01 ? current : nextScale))
    }

    updateScale()

    const observer = new ResizeObserver(updateScale)
    if (outerRef.current) observer.observe(outerRef.current)
    if (innerRef.current) observer.observe(innerRef.current)

    window.addEventListener('resize', updateScale)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [children])

  return (
    <div ref={outerRef} className={`h-full overflow-hidden ${className}`}>
      <div className="flex h-full justify-center overflow-hidden">
        <div
          ref={innerRef}
          className="w-full"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <div className="text-xs uppercase tracking-[0.24em] text-vault-slate">{eyebrow}</div>}
        <h1 className="mt-1.5 text-[1.9rem] font-semibold tracking-tight text-white md:text-[2rem]">{title}</h1>
        {description && <p className="mt-1 max-w-xl text-sm leading-5 text-slate-300">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}

export function SectionCard({ className = '', children }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)] ${className}`}>
      {children}
    </div>
  )
}

export function MetricCard({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3.5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-vault-slate">{label}</div>
      <div className="mt-1.5 text-lg font-semibold text-white">{value}</div>
      {detail && <div className="mt-1 text-sm text-slate-400">{detail}</div>}
    </div>
  )
}

export function StatusBadge({ status, children }) {
  const Icon = verdictIcons[status] || ShieldAlert
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${verdictStyles[status] || verdictStyles.risky}`}>
      <Icon className="h-3.5 w-3.5" />
      {children || status}
    </span>
  )
}

export function GlowButton({ as: Comp = 'button', className = '', children, ...props }) {
  return (
    <Comp
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${className}`}
      {...props}
    >
      {children}
    </Comp>
  )
}

export function Label({ children }) {
  return <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-vault-slate">{children}</div>
}

export function Input(props) {
  return <input {...props} className={`input-shell ${props.className || ''}`} />
}

export function Textarea(props) {
  return <textarea {...props} className={`input-shell resize-none ${props.className || ''}`} />
}

export function Select(props) {
  return <select {...props} className={`input-shell ${props.className || ''}`} />
}

export function HeroMockCard({ title, subtitle, status, lines }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
        </div>
        <StatusBadge status={status}>{status}</StatusBadge>
      </div>
      <div className="mt-4 space-y-2.5">
        {lines.map((line) => (
          <div key={line.label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
            <span className="text-slate-400">{line.label}</span>
            <span className="font-medium text-white">{line.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
