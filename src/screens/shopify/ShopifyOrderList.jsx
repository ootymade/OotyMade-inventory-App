import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  listShopifyOrders,
  refreshShopifyOrders,
  getShopifySyncSettings,
  saveShopifyFirstOrderNumber,
  runShopifyPaymentDiagnostics,
} from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { PageHeader, Badge, Card, EmptyState, Button, Spinner, Input } from '../../components/ui.jsx'
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
  // Admin-only diagnostic — never shown to Staff. Holds the last sync
  // result ({ ok, partial, fetched, created, updated, skipped,
  // webhooksRegistered, error? }); never contains a token or secret.
  const [lastResult, setLastResult] = useState(null)
  const [settings, setSettings] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [firstOrderInput, setFirstOrderInput] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  // One-off investigation (read-only against Shopify, writes nothing) to
  // settle what payment_hold should actually check — remove this button
  // and state once that's decided.
  const [diagResult, setDiagResult] = useState(null)
  const [runningDiag, setRunningDiag] = useState(false)

  const load = useCallback(() => {
    listShopifyOrders({ workflowStatus: status }).then(setOrders)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  useEffect(() => {
    if (member?.isAdmin) getShopifySyncSettings().then(setSettings)
  }, [member?.isAdmin])

  const refresh = useCallback(
    async (silent = false) => {
      setRefreshing(true)
      try {
        const result = await refreshShopifyOrders()
        setLastResult(result)
        if (!result.ok && !silent) push(result.error, { tone: 'error' })
        load()
      } catch (err) {
        setLastResult({ ok: false, error: err.message })
        if (!silent) push(err.message, { tone: 'error' })
      } finally {
        setRefreshing(false)
      }
    },
    [load, push],
  )

  const runDiagnostics = async () => {
    setRunningDiag(true)
    try {
      const result = await runShopifyPaymentDiagnostics()
      setDiagResult(result)
      if (!result.ok) push(result.error, { tone: 'error' })
    } catch (err) {
      setDiagResult({ ok: false, error: err.message })
      push(err.message, { tone: 'error' })
    } finally {
      setRunningDiag(false)
    }
  }

  const saveSettings = async () => {
    const n = parseInt(firstOrderInput, 10)
    if (!n || n < 1) {
      push('Enter a valid order number', { tone: 'error' })
      return
    }
    setSavingSettings(true)
    try {
      await saveShopifyFirstOrderNumber(n)
      setSettings({ firstOrderNumber: n })
      push(`Future syncs will ignore orders before #${n}`, { tone: 'success' })
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSavingSettings(false)
    }
  }

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

      {member?.isAdmin && (
        <div className="px-4 pt-2">
          <button
            onClick={() => {
              setShowSettings((s) => !s)
              setFirstOrderInput(String(settings?.firstOrderNumber ?? ''))
            }}
            className="text-xs font-semibold text-brand-600"
          >
            {showSettings ? 'Hide sync settings' : 'Sync settings'}
          </button>
          {showSettings && (
            <Card className="mt-2 !py-3 text-sm">
              <p className="text-xs font-semibold text-slate-500">First order number to sync</p>
              <p className="mt-1 text-xs text-slate-400">
                Orders before this number are ignored by Refresh and the webhook. Format: #16600.
              </p>
              <div className="mt-2 flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={firstOrderInput}
                  onChange={(e) => setFirstOrderInput(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? <Spinner className="h-4 w-4" /> : 'Save'}
                </Button>
              </div>
              {settings && <p className="mt-2 text-xs text-slate-400">Currently: #{settings.firstOrderNumber}</p>}
            </Card>
          )}

          <div className="mt-2">
            <Button size="sm" variant="ghost" className="!px-0 text-xs" onClick={runDiagnostics} disabled={runningDiag}>
              {runningDiag ? <Spinner className="h-4 w-4" /> : 'Run payment diagnostics (read-only)'}
            </Button>
            {diagResult && (
              <Card className="mt-2 !py-3 text-xs">
                <div className="flex items-center justify-between">
                  <p className={`font-semibold ${diagResult.ok ? 'text-ok-600' : 'text-danger-600'}`}>
                    {diagResult.ok ? 'Diagnostics complete' : 'Diagnostics failed'}
                  </p>
                  <button onClick={() => setDiagResult(null)} className="text-slate-400">
                    Dismiss
                  </button>
                </div>
                {diagResult.ok ? (
                  <div className="mt-1 space-y-1 text-slate-500">
                    <p>
                      Checked {diagResult.checked} of {diagResult.totalOrders} orders ({diagResult.failed} failed to fetch)
                    </p>
                    <p>By financial status: {JSON.stringify(diagResult.byFinancialStatus)}</p>
                    <p>By gateway: {JSON.stringify(diagResult.byGateway)}</p>
                    <p>
                      AUTHORIZED: {diagResult.authorizedCount} total — {diagResult.authorizedCaptured} already captured,{' '}
                      {diagResult.authorizedNotCaptured} authorization-only
                    </p>
                    <p>
                      FULFILLED while still AUTHORIZED: {diagResult.fulfilledStillAuthorizedCount} total —{' '}
                      {diagResult.fulfilledStillAuthorizedCaptured} of those have a capture
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-slate-500">{diagResult.error}</p>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

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

      {member?.isAdmin && lastResult && (
        <div className="px-4 pt-3">
          <Card className="!py-3 text-sm">
            <div className="flex items-center justify-between">
              <p className={`font-semibold ${lastResult.ok ? (lastResult.partial ? 'text-warn-600' : 'text-ok-600') : 'text-danger-600'}`}>
                {lastResult.ok ? (lastResult.partial ? 'Sync partially completed' : 'Sync succeeded') : 'Sync failed'}
              </p>
              <button onClick={() => setLastResult(null)} className="text-xs text-slate-400">
                Dismiss
              </button>
            </div>
            {!lastResult.ok && <p className="mt-1 text-xs text-slate-500">{lastResult.error}</p>}
            {lastResult.fetched != null && (
              <p className="mt-1 text-xs text-slate-500">
                {lastResult.fetched} fetched · {lastResult.created} created · {lastResult.updated} updated
                {lastResult.skipped > 0 && ` · ${lastResult.skipped} skipped (before cutoff)`}
              </p>
            )}
            {lastResult.webhooksRegistered && (
              <p className="mt-1 text-xs text-slate-400">
                {lastResult.webhooksRegistered.length > 0
                  ? `Webhooks newly registered: ${lastResult.webhooksRegistered.join(', ')}`
                  : 'Webhooks already up to date'}
              </p>
            )}
            {lastResult.partial && (
              <p className="mt-1 text-xs text-warn-600">
                Stopped early to stay under the time limit — press Refresh again to continue.
              </p>
            )}
          </Card>
        </div>
      )}

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
                    {o.paymentHold && (
                      <p className="mt-1 text-[11px] font-semibold text-danger-600">Payment issue — do not ship</p>
                    )}
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
