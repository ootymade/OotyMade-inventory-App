import { ChevronLeftIcon, SearchIcon } from './icons.jsx'
import { useNavigate } from 'react-router-dom'
import { useTeamMember } from '../context/TeamMemberContext.jsx'

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  as: As = 'button',
  ...props
}) {
  const base =
    'tap inline-flex items-center justify-center gap-2 rounded-full font-bold transition active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100'
  const sizes = {
    md: 'px-5 text-base',
    lg: 'px-6 text-base',
    sm: 'px-4 text-sm min-h-10',
    icon: 'p-0',
  }
  const variants = {
    primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    danger: 'bg-danger-600 text-white hover:bg-danger-700',
    ghost: 'bg-transparent text-brand-700 rounded-xl px-3',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  }
  return <As className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
}

export function Card({ className = '', ...props }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] bg-white p-4 shadow-[0_2px_8px_rgba(28,25,23,0.07)] ${className}`}
      {...props}
    />
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger-600">{error}</span>}
    </label>
  )
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`tap w-full rounded-[var(--radius-md)] border-none bg-slate-100 px-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`tap w-full rounded-[var(--radius-md)] border-none bg-slate-100 px-4 text-base text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-[var(--radius-md)] border-none bg-slate-100 px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    />
  )
}

// Outline + colored dot — generic-purpose badge. Pass `dot` to show the
// status dot; informational badges (a quantity, a "Hidden" marker) stay
// dot-less by default so they don't read as a status.
export function Badge({ tone = 'slate', dot = false, children, className = '' }) {
  const tones = {
    slate: 'border-slate-200 text-slate-600 bg-white',
    brand: 'border-brand-100 text-brand-700 bg-white',
    danger: 'border-danger-50 text-danger-700 bg-danger-50',
    warn: 'border-warn-50 text-warn-700 bg-white',
    ok: 'border-ok-50 text-ok-700 bg-white',
  }
  const dotTones = {
    slate: 'bg-slate-400',
    brand: 'bg-brand-500',
    danger: 'bg-danger-600',
    warn: 'bg-warn-600',
    ok: 'bg-ok-600',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-bold ${tones[tone]} ${className}`}
    >
      {dot && <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${dotTones[tone]}`} />}
      {children}
    </span>
  )
}

// One shared status badge for Shopify orders, Direct orders and Purchase
// orders — see src/lib/orderStatus.js for the label/tone mapping. Database
// values are never changed; this only decides how each value is drawn.
export function StatusBadge({ kind, value, className = '' }) {
  // Imported lazily inline to avoid a circular import (orderStatus.js has
  // no UI dependency of its own, so this is just keeping the import local
  // to where it's used).
  // eslint-disable-next-line no-use-before-define
  const { label, tone } = getStatusMeta(kind, value)
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  )
}

export function PageHeader({ title, subtitle, back, right }) {
  const navigate = useNavigate()
  return (
    <div className="safe-top sticky top-0 z-20 border-b border-slate-100 bg-white/90 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-center gap-2">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="tap -ml-2 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Back"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  )
}

// Same component as PageHeader — "AppBar" is the design-system name for it.
export const AppBar = PageHeader

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// Loading placeholder — a single shared shape instead of every screen
// hand-rolling its own `animate-pulse` div. Respects prefers-reduced-motion
// globally (see index.css), no extra work needed here.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[var(--radius-md)] bg-slate-200 ${className}`} />
}

// Role-aware wrapper around the existing `member.isAdmin` flag — a drop-in
// replacement for inline `{member?.isAdmin && (...)}` checks, so the
// condition lives in one place. Same semantics: renders `children` only
// for an admin, otherwise `fallback` (default: nothing). Does not change
// who can see what — it reads the exact same flag the inline checks did.
export function AdminOnly({ children, fallback = null }) {
  const { member } = useTeamMember()
  return member?.isAdmin ? children : fallback
}

// Replaces the app's four hand-rolled pill/tab row implementations
// (Purchase Orders status tabs, Shopify status tabs, Daily Orders'
// 30d/90d toggle, Stock In/Out toggle). Controlled: pass the current
// `value` and an `onChange(nextValue)`.
export function SegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-0.5 ${className}`} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`tap shrink-0 rounded-full px-4 text-sm font-bold transition ${
            value === opt.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// Replaces the app's four duplicated "search input with a left icon"
// blocks. Same props as a plain <input>.
export function SearchBox({ className = '', ...props }) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        className="tap w-full rounded-[var(--radius-md)] border-none bg-slate-100 py-0 pl-11 pr-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
        {...props}
      />
    </div>
  )
}

// A bottom sheet modal. Not wired into any real screen yet — new, shown
// only in the component gallery per Stage 2a's scope — but ready for 2b+
// to use for things like filter pickers or confirmations.
export function Sheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-lg)] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(28,25,23,0.16)]">
        <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-slate-200" />
        {title && <h2 className="mb-3 text-lg font-bold text-slate-900">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

// ---- shared order-status vocabulary ----
// One label/tone table shared by Shopify orders, Direct orders and
// Purchase orders. The stored database values are never touched — this
// only maps an existing value to how it's drawn. `kind` picks which of
// the three independent status columns `value` came from, since the same
// word can mean different things in each (e.g. Shopify has no "draft").
const STATUS_META = {
  shopify: {
    new: { label: 'New', tone: 'slate' },
    packing: { label: 'Packing', tone: 'brand' },
    packed: { label: 'Packed', tone: 'warn' },
    shipped: { label: 'Dispatched', tone: 'brand' },
    delivered: { label: 'Delivered', tone: 'ok' },
  },
  direct: {
    draft: { label: 'Draft', tone: 'slate' },
    confirmed: { label: 'Confirmed', tone: 'brand' },
    shipped: { label: 'Dispatched', tone: 'brand' },
    delivered: { label: 'Delivered', tone: 'ok' },
    cancelled: { label: 'Cancelled', tone: 'danger' },
  },
  po: {
    draft: { label: 'Draft', tone: 'slate' },
    ordered: { label: 'Ordered', tone: 'brand' },
    partially_received: { label: 'Partially received', tone: 'warn' },
    received: { label: 'Received', tone: 'ok' },
  },
}

export function getStatusMeta(kind, value) {
  return STATUS_META[kind]?.[value] || { label: value, tone: 'slate' }
}
