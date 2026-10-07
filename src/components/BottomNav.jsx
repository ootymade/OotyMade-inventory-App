import { NavLink } from 'react-router-dom'
import { HomeIcon, BoxIcon, ScanIcon, ClipboardIcon, TruckIcon } from './icons.jsx'

// Same 5 items as before Stage 2a — navigation content/structure is a
// Stage 2b decision, not a design-system one. Only the visual treatment
// (floating pill, per the approved Direction B) changes here.
const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/products', label: 'Products', icon: BoxIcon },
  { to: '/scan', label: 'Scan', icon: ScanIcon },
  { to: '/purchase-orders', label: 'Orders', icon: ClipboardIcon },
  { to: '/suppliers', label: 'Suppliers', icon: TruckIcon },
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
