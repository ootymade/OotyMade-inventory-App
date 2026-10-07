import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getDashboardStats, listProducts, getTodayOrderSummary } from '../db/storage.js'
import { useRealtimeRefresh } from '../db/useRealtimeRefresh.js'
import { useTeamMember } from '../context/TeamMemberContext.jsx'
import { Card, Badge, Button, EmptyState } from '../components/ui.jsx'
import {
  AlertIcon,
  ScanIcon,
  PlusIcon,
  ClipboardIcon,
  BoxIcon,
  TruckIcon,
  SyncIcon,
  ReceiptIcon,
  ShoppingBagIcon,
} from '../components/icons.jsx'

const REALTIME_TABLES = ['products', 'movements', 'purchase_orders', 'invoices', 'daily_order_counts']

function formatMoney(n) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)
}

function timeAgo(iso) {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const REASON_LABEL = {
  received: 'Received',
  sold: 'Sold',
  damaged: 'Damaged',
  adjustment: 'Adjusted',
}

const FEATURED_CATEGORIES = ['Chocolate', 'Varkey']

export default function Dashboard() {
  const { member, clearMember } = useTeamMember()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState(null)
  const [orderSummary, setOrderSummary] = useState(null)

  const load = useCallback(async () => {
    const [s, all, summary] = await Promise.all([getDashboardStats(), listProducts(), getTodayOrderSummary()])
    setStats(s)
    setProducts(all)
    setOrderSummary(summary)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  const productNames = {}
  products?.forEach((p) => (productNames[p.id] = p))

  const featuredProducts =
    products?.filter((p) => FEATURED_CATEGORIES.includes(p.category)).sort((a, b) => {
      const ci = FEATURED_CATEGORIES.indexOf(a.category) - FEATURED_CATEGORIES.indexOf(b.category)
      return ci !== 0 ? ci : a.name.localeCompare(b.name)
    }) ?? []

  if (!stats) {
    return (
      <div className="p-4">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <div className="safe-top bg-brand-900 px-4 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-brand-100">Hi, {member?.name}</p>
            <h1 className="text-xl font-bold">Inventory Overview</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/data-sync"
              className="tap flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
              aria-label="Export data / bulk import products"
            >
              <SyncIcon className="h-5 w-5" />
            </Link>
            <button
              onClick={() => {
                if (confirm('Switch user on this phone?')) clearMember()
              }}
              className="tap flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-bold"
              aria-label="Switch user"
            >
              {member?.name?.[0]?.toUpperCase()}
            </button>
          </div>
        </div>

        {stats.lowStockCount > 0 && (
          <Link
            to="/products?filter=low-stock"
            className="mt-4 flex items-center gap-2 rounded-xl bg-warn-500/20 px-3.5 py-3 text-sm font-medium text-warn-500"
          >
            <AlertIcon className="h-5 w-5 shrink-0" />
            <span className="text-white">
              {stats.lowStockCount} item{stats.lowStockCount === 1 ? '' : 's'} low on stock
            </span>
          </Link>
        )}
      </div>

      <div className="-mt-4 grid grid-cols-2 gap-3 px-4">
        <Card className="!p-4">
          <p className="text-xs font-medium text-slate-400">Total products</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalProducts}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium text-slate-400">Stock value</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(stats.totalStockValue)}</p>
        </Card>
        <Link to="/products?filter=low-stock">
          <Card className="!p-4">
            <p className="text-xs font-medium text-slate-400">Low stock</p>
            <p className={`mt-1 text-2xl font-bold ${stats.lowStockCount ? 'text-danger-600' : 'text-slate-900'}`}>
              {stats.lowStockCount}
            </p>
          </Card>
        </Link>
        <Card className="!p-4">
          <p className="text-xs font-medium text-slate-400">Last activity</p>
          <p className="mt-1 truncate text-sm font-bold text-slate-900">
            {timeAgo(stats.recentActivity[0]?.timestamp)}
          </p>
        </Card>
      </div>

      {featuredProducts.length > 0 && (
        <div className="mt-5 px-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">Chocolate &amp; Varkey stock</p>
            <Link to="/products" className="text-xs font-semibold text-brand-600">
              See all
            </Link>
          </div>
          <Card className="divide-y divide-slate-100 !p-0">
            {featuredProducts.map((p) => {
              const low = p.hasBeenCounted && p.quantity <= p.lowStockThreshold
              return (
                <Link key={p.id} to={`/products/${p.id}`} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.category}</p>
                  </div>
                  <Badge tone={low ? 'danger' : 'slate'}>
                    {p.quantity} {p.unit}
                  </Badge>
                </Link>
              )
            })}
          </Card>
        </div>
      )}

      <div className="mt-5 px-4">
        <p className="mb-2 text-sm font-semibold text-slate-500">Quick actions</p>
        <div className="grid grid-cols-4 gap-3">
          <Button variant="secondary" className="!flex-col !gap-1.5 !py-4" onClick={() => navigate('/scan')}>
            <ScanIcon className="h-6 w-6" />
            <span className="text-xs">Scan</span>
          </Button>
          <Button variant="secondary" className="!flex-col !gap-1.5 !py-4" onClick={() => navigate('/stock-move')}>
            <PlusIcon className="h-6 w-6" />
            <span className="text-xs">Add Stock</span>
          </Button>
          <Button
            variant="secondary"
            className="!flex-col !gap-1.5 !py-4"
            onClick={() => navigate('/purchase-orders/new')}
          >
            <ClipboardIcon className="h-6 w-6" />
            <span className="text-xs">New PO</span>
          </Button>
          <Button
            variant="secondary"
            className="!flex-col !gap-1.5 !py-4"
            onClick={() => navigate('/direct-orders/new')}
          >
            <ReceiptIcon className="h-6 w-6" />
            <span className="text-xs">New Order</span>
          </Button>
        </div>
      </div>

      {orderSummary && (
        <div className="mt-5 px-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">Today&apos;s orders shipped</p>
            <Link to="/daily-orders" className="text-xs font-semibold text-brand-600">
              See all
            </Link>
          </div>
          <Card>
            <p className="text-3xl font-bold text-slate-900">{orderSummary.total}</p>
            {Object.keys(orderSummary.byChannel).length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                {Object.entries(orderSummary.byChannel).map(([channel, count]) => (
                  <div key={channel} className="flex justify-between text-xs">
                    <span className="text-slate-500">{channel}</span>
                    <span className="font-semibold text-slate-700">{count}</span>
                  </div>
                ))}
              </div>
            )}
            <Link to="/daily-orders">
              <Button variant="outline" size="sm" className="mt-3 w-full">
                Update today&apos;s counts
              </Button>
            </Link>
          </Card>
        </div>
      )}

      <div className="mt-5 px-4">
        <p className="mb-2 text-sm font-semibold text-slate-500">Recent activity</p>
        {stats.recentActivity.length === 0 ? (
          <EmptyState
            icon={<BoxIcon className="h-10 w-10" />}
            title="No activity yet"
            subtitle="Stock movements will show up here"
          />
        ) : (
          <Card className="divide-y divide-slate-100 !p-0">
            {stats.recentActivity.map((m) => {
              const product = productNames[m.productId]
              return (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {product?.name || 'Unknown product'}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {REASON_LABEL[m.reason] || m.reason} · {m.memberName || 'Unknown'} · {timeAgo(m.timestamp)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${m.quantity < 0 ? 'text-danger-600' : 'text-ok-600'}`}>
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </span>
                </div>
              )
            })}
          </Card>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-xs text-slate-400">
        <Link to="/shopify-orders" className="flex items-center gap-1">
          <ShoppingBagIcon className="h-4 w-4" /> Shopify orders
        </Link>
        <span>·</span>
        <Link to="/direct-orders" className="flex items-center gap-1">
          <ReceiptIcon className="h-4 w-4" /> Direct orders
        </Link>
        <span>·</span>
        <Link to="/suppliers" className="flex items-center gap-1">
          <TruckIcon className="h-4 w-4" /> Suppliers
        </Link>
        <span>·</span>
        <Link to="/data-sync">Export data / bulk import</Link>
        <span>·</span>
        <Link to="/change-password">Change password</Link>
        {member?.isAdmin && (
          <>
            <span>·</span>
            <Link to="/courier-settings">Manage couriers</Link>
          </>
        )}
      </div>
    </div>
  )
}
