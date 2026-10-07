import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats } from '../../db/storage.js'
import { PageHeader, Card, Button, Badge } from '../../components/ui.jsx'
import { BoxIcon, PlusIcon, ClipboardIcon, TruckIcon, ScanIcon, ChevronRightIcon } from '../../components/icons.jsx'

// Stage 2b: Purchase orders and suppliers move here from the old
// top-level nav; Scan gets a prominent header action (also on Home).
// Nothing here changes what data is readable by whom — this screen just
// links out to the existing Products / Stock In-Out / Purchase Orders /
// Suppliers screens, unchanged.
export default function StockHub() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getDashboardStats().then(setStats)
  }, [])

  const rows = [
    {
      to: '/products',
      icon: BoxIcon,
      title: 'Products',
      subtitle: stats ? `${stats.totalProducts} items` : undefined,
      badge: stats?.lowStockCount > 0 ? `${stats.lowStockCount} low` : null,
    },
    { to: '/stock-move', icon: PlusIcon, title: 'Stock in / out', subtitle: 'Record a stock movement' },
    { to: '/purchase-orders', icon: ClipboardIcon, title: 'Purchase orders', subtitle: 'Order stock from a supplier' },
    { to: '/suppliers', icon: TruckIcon, title: 'Suppliers', subtitle: 'Manage supplier contacts' },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        title="Stock"
        right={
          <Link to="/scan">
            <Button size="sm" className="!px-3" aria-label="Scan">
              <ScanIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </Link>
        }
      />

      <div className="px-4 pt-3">
        <Card className="!p-0 divide-y divide-slate-100">
          {rows.map(({ to, icon: Icon, title, subtitle, badge }) => (
            <Link key={to} to={to} className="flex items-center gap-3 px-4 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
              </div>
              {badge && <Badge tone="danger">{badge}</Badge>}
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          ))}
        </Card>
      </div>
    </div>
  )
}
