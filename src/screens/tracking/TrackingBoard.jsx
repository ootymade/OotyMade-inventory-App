import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getTrackingBoard,
  listCouriers,
  setShipment,
  updateShipment,
  setShopifyOrderWorkflowStatus,
  buildTrackingUrl,
  buildWhatsAppShipmentMessage,
  TRACKING_STALE_DAYS,
} from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Badge, Button, Select, Input, EmptyState, Skeleton, SegmentedControl } from '../../components/ui.jsx'
import { TruckIcon, PackageCheckIcon, AlertIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['shipments', 'shopify_sync_ping', 'invoices']
const OTHER_COURIER = '__other__'
const DAY_MS = 24 * 60 * 60 * 1000

const TABS = [
  { value: 'needs_tracking', label: 'Needs tracking' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'fulfilled_no_tracking', label: 'Fulfilled, no tracking' },
  { value: 'delivered', label: 'Delivered' },
]

const SORT_OPTIONS = [
  { value: 'desc', label: 'Newest first' },
  { value: 'asc', label: 'Oldest first' },
]

// A courier only counts as "verified" for the Track button when its link
// actually embeds the tracking number (a deep link, or the opted-in
// universal tracker) — not just a generic homepage URL with nothing to
// click through to for this specific parcel.
function hasVerifiedLink(courierName, couriers) {
  const courier = couriers.find((c) => c.name.toLowerCase() === (courierName || '').toLowerCase())
  return Boolean(courier && (courier.isDeepLink || courier.useUniversalTracker))
}

function daysAgo(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
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

export default function TrackingBoard() {
  const { push } = useToast()
  const [entries, setEntries] = useState(null)
  const [couriers, setCouriers] = useState([])
  const [tab, setTab] = useState('needs_tracking')
  const [sortDir, setSortDir] = useState('desc')
  const [editingKey, setEditingKey] = useState(null)
  const [draft, setDraft] = useState({ courierChoice: '', courierOther: '', tracking: '' })
  const [busyKey, setBusyKey] = useState(null)

  const load = () => getTrackingBoard().then(setEntries)

  useEffect(() => {
    load()
    listCouriers().then(setCouriers)
  }, [])

  useRealtimeRefresh(REALTIME_TABLES, load)

  const keyOf = (e) => `${e.channel}:${e.id}`

  const startEdit = (entry) => {
    const match = couriers.find((c) => c.name.toLowerCase() === entry.courierName.toLowerCase())
    setDraft({
      courierChoice: match ? match.name : entry.courierName ? OTHER_COURIER : '',
      courierOther: match ? '' : entry.courierName,
      tracking: entry.trackingNumber || '',
    })
    setEditingKey(keyOf(entry))
  }

  const saveTracking = async (entry) => {
    const courierName = draft.courierChoice === OTHER_COURIER ? draft.courierOther.trim() : draft.courierChoice
    if (!courierName || !draft.tracking.trim()) {
      push('Pick a courier and enter the tracking number', { tone: 'error' })
      return
    }
    setBusyKey(keyOf(entry))
    try {
      await setShipment(
        entry.channel === 'shopify'
          ? { shopifyOrderId: entry.id, courierName, trackingNumber: draft.tracking.trim() }
          : { invoiceId: entry.id, courierName, trackingNumber: draft.tracking.trim() },
      )
      push('Tracking saved', { tone: 'success' })
      setEditingKey(null)
      await load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setBusyKey(null)
    }
  }

  const markDelivered = async (entry) => {
    setBusyKey(keyOf(entry))
    try {
      if (entry.channel === 'shopify') {
        await setShopifyOrderWorkflowStatus({ orderId: entry.id, newStatus: 'delivered', expectedStatus: 'shipped' })
      } else {
        await updateShipment(entry.id, { status: 'delivered' })
      }
      push('Marked as delivered', { tone: 'success' })
      await load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setBusyKey(null)
    }
  }

  const copyMessage = async (entry) => {
    const trackingUrl = buildTrackingUrl(entry.courierName, entry.trackingNumber, couriers)
    const message = buildWhatsAppShipmentMessage({
      customerName: entry.customerName,
      orderNumber: entry.orderLabel,
      courierName: entry.courierName,
      trackingNumber: entry.trackingNumber,
      trackingUrl,
    })
    try {
      await navigator.clipboard.writeText(message)
      push('WhatsApp message copied', { tone: 'success' })
    } catch {
      push('Could not copy — your browser may be blocking clipboard access', { tone: 'error' })
    }
  }

  if (entries === null) {
    return (
      <div>
        <PageHeader title="Tracking updates" />
        <div className="space-y-2 px-4 pt-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  const counts = {
    needs_tracking: entries.filter((e) => e.bucket === 'needs_tracking').length,
    in_transit: entries.filter((e) => e.bucket === 'in_transit').length,
    fulfilled_no_tracking: entries.filter((e) => e.bucket === 'fulfilled_no_tracking').length,
    delivered: entries.filter((e) => e.bucket === 'delivered').length,
  }

  // "Dispatch time" per entry — lastEventAt already is that (the
  // packed/shipped/delivered timestamp), falling back to orderDate when
  // an order has no workflow timestamp at all (e.g. a backfilled order
  // that never moved through our workflow).
  const sortKey = (e) => new Date(e.lastEventAt || e.orderDate).getTime()

  const shown = entries
    .filter((e) => e.bucket === tab)
    .sort((a, b) => (sortDir === 'desc' ? sortKey(b) - sortKey(a) : sortKey(a) - sortKey(b)))

  return (
    <div className="pb-6">
      <PageHeader title="Tracking updates" />

      <div className="px-4 pt-3">
        <SegmentedControl
          options={TABS.map((t) => ({ ...t, label: `${t.label} (${counts[t.value]})` }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="px-4 pt-2">
        <SegmentedControl
          options={SORT_OPTIONS}
          value={sortDir}
          onChange={setSortDir}
          className="!gap-1.5"
        />
      </div>

      <div className="mt-3 space-y-2 px-4">
        {shown.length === 0 ? (
          <EmptyState
            icon={<TruckIcon className="h-10 w-10" />}
            title={
              tab === 'needs_tracking'
                ? 'Nothing waiting on tracking'
                : tab === 'in_transit'
                  ? 'Nothing in transit'
                  : tab === 'fulfilled_no_tracking'
                    ? 'Nothing fulfilled without tracking'
                    : 'Nothing delivered recently'
            }
          />
        ) : (
          shown.map((entry) => {
            const key = keyOf(entry)
            const editing = editingKey === key
            const verified = hasVerifiedLink(entry.courierName, couriers)
            const trackingUrl = verified ? buildTrackingUrl(entry.courierName, entry.trackingNumber, couriers) : null
            const dispatchedDaysAgo = daysAgo(entry.lastEventAt)
            const stale = entry.bucket === 'in_transit' && dispatchedDaysAgo > TRACKING_STALE_DAYS

            return (
              <Card key={key} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={entry.channel === 'shopify' ? 'brand' : 'slate'}>
                      {entry.channel === 'shopify' ? 'Shopify' : 'Direct'}
                    </Badge>
                    <Link to={entry.href} className="text-sm font-semibold text-slate-800">
                      {entry.orderLabel}
                    </Link>
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(entry.lastEventAt)}</span>
                </div>

                <p className="text-sm text-slate-600">{entry.customerName}</p>

                {entry.notSentToShopify && <p className="text-xs text-slate-400">Not yet sent to Shopify</p>}

                {stale && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-warn-600">
                    <AlertIcon className="h-4 w-4" /> Dispatched {dispatchedDaysAgo} days ago, check status
                  </p>
                )}

                {entry.courierName && !editing && (
                  <p className="text-sm text-slate-700">
                    {entry.courierName} · {entry.trackingNumber}
                  </p>
                )}

                {editing ? (
                  <div className="space-y-2">
                    <Select value={draft.courierChoice} onChange={(e) => setDraft((d) => ({ ...d, courierChoice: e.target.value }))}>
                      <option value="">Pick a courier…</option>
                      {couriers.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                      <option value={OTHER_COURIER}>Other</option>
                    </Select>
                    {draft.courierChoice === OTHER_COURIER && (
                      <Input
                        value={draft.courierOther}
                        onChange={(e) => setDraft((d) => ({ ...d, courierOther: e.target.value }))}
                        placeholder="Courier name"
                      />
                    )}
                    <Input
                      value={draft.tracking}
                      onChange={(e) => setDraft((d) => ({ ...d, tracking: e.target.value }))}
                      placeholder="Tracking number"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => saveTracking(entry)} disabled={busyKey === key}>
                        Save tracking
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {trackingUrl && (
                      <Button as="a" href={trackingUrl} target="_blank" rel="noreferrer" size="sm" className="flex-1">
                        Track
                      </Button>
                    )}
                    {entry.courierName && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => copyMessage(entry)}>
                        Copy WhatsApp message
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => startEdit(entry)}>
                      {entry.courierName ? 'Edit tracking' : 'Add tracking'}
                    </Button>
                    {entry.bucket === 'in_transit' && (
                      <Button size="sm" className="flex-1" onClick={() => markDelivered(entry)} disabled={busyKey === key}>
                        <PackageCheckIcon className="h-4 w-4" /> Mark delivered
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
