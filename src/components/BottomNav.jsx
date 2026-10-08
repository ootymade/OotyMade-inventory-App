import { NavLink } from 'react-router-dom'
import { HomeIcon, ClipboardIcon, PackageCheckIcon, BoxIcon, MoreIcon } from './icons.jsx'

// Stage 2b, revised: Home / Orders / Tracking / Inventory / More. Orders
// merges Shopify + Direct (see OrdersHub). Tracking is the new combined
// Shopify+Direct shipment board (see tracking/TrackingBoard.jsx).
// Inventory hosts Products/Stock In-Out/Scan/Purchase Orders/Low-stock/
// Movement history/Suppliers (see stock/InventoryHub.jsx). Team Board and
// Daily Orders/Invoices/Settings move to Home shortcuts + More — purchase
// orders and suppliers no longer live under a generic "Orders" tab.
const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/orders', label: 'Orders', icon: ClipboardIcon },
  { to: '/tracking', label: 'Tracking', icon: PackageCheckIcon },
  { to: '/inventory', label: 'Inventory', icon: BoxIcon },
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
