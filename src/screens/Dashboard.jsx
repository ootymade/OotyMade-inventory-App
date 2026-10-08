import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getHomeSummary, getUnseenNoticeCount } from '../db/storage.js'
import { useRealtimeRefresh } from '../db/useRealtimeRefresh.js'
import { useTeamMember } from '../context/TeamMemberContext.jsx'
import { Card, Button, EmptyState, AdminOnly, Skeleton, Badge } from '../components/ui.jsx'
import {
  ScanIcon,
  PlusIcon,
  ReceiptIcon,
  BoxIcon,
  BellIcon,
  PinIcon,
  ChevronRightIcon,
  ShoppingBagIcon,
  TruckIcon,
  PackageCheckIcon,
} from '../components/icons.jsx'

const REALTIME_TABLES = ['products', 'movements', 'purchase_orders', 'invoices', 'shopify_orders', 'team_notices', 'shipments']

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

const REASON_LABEL = { received: 'Received', sold: 'Sold', damaged: 'Damaged', adjustment: 'Adjusted' }

function Tile({ to, icon: Icon, label, value }) {
  return (
    <Link to={to} className="flex flex-col items-start gap-2 rounded-[var(--radius-lg)] bg-white p-4 shadow-[0_2px_8px_rgba(28,25,23,0.07)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
    </Link>
  )
}

// Team Board's own tile: an unseen-count badge instead of a plain number,
// plus a one-line pinned-announcement preview. pinnedNotice is null both
// when nothing is pinned and when the Team Board tables don't exist yet
// (getHomeSummary already swallows that failure) — either way "No pinned
// announcement" is the right, friendly thing to show, never an error.
function TeamTile({ unseen, pinnedNotice }) {
  return (
    <Link to="/team-board" className="flex flex-col items-start gap-2 rounded-[var(--radius-lg)] bg-white p-4 shadow-[0_2px_8px_rgba(28,25,23,0.07)]">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <BellIcon className="h-5 w-5" />
        {unseen > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger-600 text-[10px] font-bold text-white">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-slate-500">Team Board</p>
      <p className="line-clamp-1 text-xs text-slate-400">{pinnedNotice ? pinnedNotice.body : 'No pinned announcement'}</p>
    </Link>
  )
}

export default function Dashboard() {
  const { member, clearMember } = useTeamMember()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [unseenNotices, setUnseenNotices] = useState(0)

  const load = useCallback(async () => {
    setSummary(await getHomeSummary())
  }, [])

  useEffect(() => {
    if (member?.id) getUnseenNoticeCount(member.id).then(setUnseenNotices).catch(() => setUnseenNotices(0))
  }, [member?.id])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  if (!summary) {
    return (
      <div className="p-4">
        <Skeleton className="h-10 w-40" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  const tiles = [
    { to: '/orders?channel=shopify', icon: ShoppingBagIcon, label: 'Shopify Orders · to pack', value: summary.shopifyToPack },
    { to: '/orders?channel=direct', icon: ReceiptIcon, label: 'Direct Orders · open', value: summary.directOpenCount },
    { to: '/tracking', icon: PackageCheckIcon, label: 'Tracking Updates', value: summary.trackingNeedsCount + summary.trackingInTransitCount },
    { to: '/suppliers', icon: TruckIcon, label: 'Suppliers', value: summary.supplierCount },
    { to: '/inventory', icon: BoxIcon, label: 'Inventory · low stock', value: summary.lowStockCount },
  ]

  const workCards = [
    { label: 'To pack', value: summary.toPack, tone: summary.toPack > 0 ? 'warn' : 'slate' },
    { label: 'Dispatched today', value: summary.dispatchedToday, tone: 'ok' },
    { label: 'Waiting over 24h', value: summary.waitingOver24h, tone: summary.waitingOver24h > 0 ? 'danger' : 'slate' },
    { label: 'Payment hold', value: summary.paymentHoldCount, tone: summary.paymentHoldCount > 0 ? 'danger' : 'slate' },
  ]

  const toneText = { slate: 'text-slate-900', warn: 'text-warn-600', ok: 'text-ok-600', danger: 'text-danger-600' }

  return (
    <div className="pb-6">
      <div className="safe-top bg-brand-900 px-4 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-brand-100">Hi, {member?.name}</p>
            <h1 className="text-xl font-bold">Home</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/team-board"
              className="tap relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
              aria-label="Team board"
            >
              <BellIcon className="h-5 w-5" />
              {unseenNotices > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-600 text-[10px] font-bold text-white">
                  {unseenNotices > 9 ? '9+' : unseenNotices}
                </span>
              )}
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
      </div>

      <div className="-mt-4 px-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <Tile key={t.to} {...t} />
          ))}
          <TeamTile unseen={unseenNotices} pinnedNotice={summary.pinnedNotice} />
        </div>
      </div>

      {summary.pinnedNotice && (
        <div className="mt-4 px-4">
          <Link to="/team-board">
            <Card className="!p-3.5 flex items-start gap-2.5 ring-1 ring-brand-100">
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <p className="line-clamp-2 flex-1 text-sm text-slate-700">{summary.pinnedNotice.body}</p>
              <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
            </Card>
          </Link>
        </div>
      )}

      <div className="mt-5 px-4">
        <p className="mb-2 text-sm font-semibold text-slate-500">Today&apos;s work</p>
        <div className="grid grid-cols-2 gap-3">
          {workCards.map((c) => (
            <Card key={c.label} className="!p-4">
              <p className="text-xs font-medium text-slate-400">{c.label}</p>
              <p className={`mt-1 text-2xl font-bold ${toneText[c.tone]}`}>{c.value}</p>
            </Card>
          ))}
        </div>
      </div>

      <AdminOnly>
        <div className="mt-5 px-4">
          <p className="mb-2 text-sm font-semibold text-slate-500">Admin overview</p>
          <div className="grid grid-cols-3 gap-3">
            <Card className="!p-3.5">
              <p className="text-xs font-medium text-slate-400">Stock value</p>
              <p className="mt-1 truncate text-base font-bold text-slate-900">{formatMoney(summary.totalStockValue)}</p>
            </Card>
            <Card className="!p-3.5">
              <p className="text-xs font-medium text-slate-400">Revenue today</p>
              <p className="mt-1 truncate text-base font-bold text-slate-900">{formatMoney(summary.todayRevenue)}</p>
            </Card>
            <Link to="/purchase-orders">
              <Card className="!p-3.5">
                <p className="text-xs font-medium text-slate-400">Pending POs</p>
                <p className="mt-1 text-base font-bold text-slate-900">{summary.pendingPurchaseOrders}</p>
              </Card>
            </Link>
          </div>
        </div>
      </AdminOnly>

      <div className="mt-5 px-4">
        <p className="mb-2 text-sm font-semibold text-slate-500">Quick actions</p>
        <div className="grid grid-cols-3 gap-3">
          <Button variant="secondary" className="!flex-col !gap-1.5 !py-4 !px-1" onClick={() => navigate('/scan')}>
            <ScanIcon className="h-6 w-6" />
            <span className="text-xs">Scan</span>
          </Button>
          <Button variant="secondary" className="!flex-col !gap-1.5 !py-4 !px-1" onClick={() => navigate('/stock-move')}>
            <PlusIcon className="h-6 w-6" />
            <span className="text-xs">Add stock</span>
          </Button>
          <Button
            variant="secondary"
            className="!flex-col !gap-1.5 !py-4 !px-1"
            onClick={() => navigate('/direct-orders/new')}
          >
            <ReceiptIcon className="h-6 w-6" />
            <span className="text-xs">New direct order</span>
          </Button>
        </div>
      </div>

      {Object.keys(summary.todayByChannel).length > 0 && (
        <div className="mt-5 px-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">Today&apos;s orders by channel</p>
            <Link to="/daily-orders" className="text-xs font-semibold text-brand-600">
              See all
            </Link>
          </div>
          <Card>
            <p className="text-3xl font-bold text-slate-900">{summary.todayTotal}</p>
            <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {Object.entries(summary.todayByChannel).map(([channel, count]) => (
                <div key={channel} className="flex justify-between text-xs">
                  <span className="text-slate-500">{channel}</span>
                  <span className="font-semibold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-5 px-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-500">Recent activity</p>
          <Link to="/movements" className="text-xs font-semibold text-brand-600">
            View all
          </Link>
        </div>
        {summary.recentActivity.length === 0 ? (
          <EmptyState icon={<BoxIcon className="h-10 w-10" />} title="No activity yet" subtitle="Stock movements will show up here" />
        ) : (
          <Card className="divide-y divide-slate-100 !p-0">
            {summary.recentActivity.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{m.productName || 'Unknown product'}</p>
                  <p className="truncate text-xs text-slate-400">
                    {REASON_LABEL[m.reason] || m.reason} · {m.memberName || 'Unknown'} · {timeAgo(m.timestamp)}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-bold ${m.quantity < 0 ? 'text-danger-600' : 'text-ok-600'}`}>
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {summary.lowStockProducts.length > 0 && (
        <div className="mt-5 px-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">Low stock</p>
            <Link to="/products?filter=low-stock" className="text-xs font-semibold text-brand-600">
              View all
            </Link>
          </div>
          <Card className="divide-y divide-slate-100 !p-0">
            {summary.lowStockProducts.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
                <Badge tone="danger">
                  {p.quantity} {p.unit}
                </Badge>
              </Link>
            ))}
          </Card>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-xs text-slate-400">
        <Link to="/daily-orders">Daily orders</Link>
        <span>·</span>
        <Link to="/team-board">Team board</Link>
        <span>·</span>
        <Link to="/direct-orders">Invoices</Link>
        <span>·</span>
        <Link to="/more">Settings</Link>
      </div>
    </div>
  )
}
