import { NavLink } from 'react-router-dom'
import { HomeIcon, ClipboardIcon, BoxIcon, BellIcon, MoreIcon } from './icons.jsx'

// Stage 2b nav restructuring: Orders merges Shopify + Direct (see
// OrdersHub), Stock hosts Products/Stock In-Out/Purchase Orders/Suppliers
// (see StockHub), and More replaces the old footer link row (see More.jsx).
// Team Board stays a top-level tab — it already degrades gracefully when
// the Team Board tables don't exist yet (TeamNoticeBoard.jsx shows a
// friendly empty state, never a spinner or raw error).
const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/orders', label: 'Orders', icon: ClipboardIcon },
  { to: '/stock', label: 'Stock', icon: BoxIcon },
  { to: '/team-board', label: 'Team', icon: BellIcon },
  { to: '/more', label: 'More', icon: MoreIcon },
]

export default function BottomNav() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(10px+env(safe-area-inset-bottom))]">
      <nav className="mx-auto flex max-w-lg items-stretch justify-between gap-1 rounded-full bg-white p-1.5 shadow-[0_10px_28px_rgba(28,25,23,0.14)]">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `tap flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-bold ${
                isActive ? 'bg-brand-600 text-white' : 'text-slate-400'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
