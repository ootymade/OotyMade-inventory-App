import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats } from '../../db/storage.js'
import { PageHeader, Card, Button, Badge, AdminOnly } from '../../components/ui.jsx'
import {
  BoxIcon,
  PlusIcon,
  ClipboardIcon,
  TruckIcon,
  ScanIcon,
  AlertIcon,
  ReceiptIcon,
  SyncIcon,
  ChevronRightIcon,
} from '../../components/icons.jsx'

// Every inventory-related screen that existed before Stage 2b's nav
// rework, gathered under one tab. The one gap found while assembling
// this: there was no screen showing stock movements across every
// product, only a per-product history and a 5-row Home feed — added as
// src/screens/stock/MovementHistory.jsx (/movements), built entirely
// from the existing listMovements() read, nothing new in the database.
export default function InventoryHub() {
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
    },
    { to: '/stock-move', icon: PlusIcon, title: 'Stock in / out', subtitle: 'Record a stock movement' },
    { to: '/scan', icon: ScanIcon, title: 'Scan', subtitle: 'Look up a product by barcode/QR' },
    { to: '/purchase-orders', icon: ClipboardIcon, title: 'Purchase orders', subtitle: 'Order stock from a supplier' },
    {
      to: '/products?filter=low-stock',
      icon: AlertIcon,
      title: 'Low-stock items',
      subtitle: stats ? `${stats.lowStockCount} below threshold` : undefined,
      badge: stats?.lowStockCount > 0 ? String(stats.lowStockCount) : null,
    },
    { to: '/movements', icon: ReceiptIcon, title: 'Movement history', subtitle: 'Every stock in/out, all products' },
    { to: '/suppliers', icon: TruckIcon, title: 'Suppliers', subtitle: 'Manage supplier contacts' },
  ]

  return (
    <div className="pb-6">
      <PageHeader
        title="Inventory"
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

        <AdminOnly>
          <p className="mb-2 mt-5 px-1 text-sm font-semibold text-slate-500">Admin</p>
          <Card className="!p-0 divide-y divide-slate-100">
            <Link to="/data-sync" className="flex items-center gap-3 px-4 py-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <SyncIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">Export / import data</p>
                <p className="truncate text-xs text-slate-400">Backup or bulk-add products</p>
              </div>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          </Card>
        </AdminOnly>
      </div>
    </div>
  )
}
