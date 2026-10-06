import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listShopifyOrders, refreshShopifyOrders } from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { PageHeader, Badge, Card, EmptyState, Button, Spinner } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ShoppingBagIcon, SyncIcon, EditIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['shopify_sync_ping']
const POLL_INTERVAL_MS = 2 * 60 * 1000

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'packing', label: 'Packing' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
]

const FULFILLMENT_TONE = {
  FULFILLED: 'ok',
  UNFULFILLED: 'danger',
  PARTIALLY_FULFILLED: 'warn',
  RESTOCKED: 'slate',
}

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function ShopifyOrderList() {
  const { push } = useToast()
  const { member } = useTeamMember()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const [orders, setOrders] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    listShopifyOrders({ workflowStatus: status }).then(setOrders)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  const refresh = useCallback(
    async (silent = false) => {
      setRefreshing(true)
      try {
        await refreshShopifyOrders()
        load()
      } catch (err) {
        if (!silent) push(err.message, { tone: 'error' })
      } finally {
        setRefreshing(false)
      }
    },
    [load, push],
  )

  // Manual refresh once on open, then a background poll as a fallback for
  // any missed webhook — both call the same read-only sync function.
  const didInitialRefresh = useRef(false)
  useEffect(() => {
    if (!didInitialRefresh.current) {
      didInitialRefresh.current = true
      refresh(true)
    }
    const interval = setInterval(() => refresh(true), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <PageHeader
        title="Shopify Orders"
        subtitle={orders ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : undefined}
        right={
          <div className="flex items-center gap-1">
            {member?.isAdmin && (
              <Link to="/shopify-sku-mapping">
                <Button size="sm" className="!px-3" variant="ghost" aria-label="Map SKUs">
                  <EditIcon className="h-5 w-5" />
                </Button>
              </Link>
            )}
            <Button size="sm" className="!px-3" variant="ghost" onClick={() => refresh(false)} disabled={refreshing}>
              {refreshing ? <Spinner className="h-4 w-4" /> : <SyncIcon className="h-5 w-5" />}
            </Button>
          </div>
        }
      />

      <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              const next = new URLSearchParams(params)
              if (tab.value) next.set('status', tab.value)
              else next.delete('status')
              setParams(next, { replace: true })
            }}
            className={`tap shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              status === tab.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-2 px-4 pb-4">
        {orders === null ? (
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBagIcon className="h-10 w-10" />}
            title="No orders found"
            subtitle={status ? 'Try a different status' : 'Shopify orders will show up here once synced'}
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            {orders.map((o) => (
              <li key={o.id}>
                <Link to={`/shopify-orders/${o.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {o.orderNumber} · {o.customerName || 'No name'}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {timeAgo(o.createdAt)} · {o.workflowStatus}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={FULFILLMENT_TONE[o.fulfillmentStatus] || 'slate'}>
                      {(o.fulfillmentStatus || '').replace(/_/g, ' ').toLowerCase() || 'unknown'}
                    </Badge>
                    {o.totalPrice != null && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency: o.currency || 'INR', maximumFractionDigits: 0 }).format(o.totalPrice)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
