import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getShopifyOrderWithItems,
  setShopifyOrderWorkflowStatus,
  listTeamMemberNames,
  listCouriers,
  getShipment,
  setShipment,
  buildTrackingUrl,
  buildWhatsAppShipmentMessage,
  WORKFLOW_STEPS,
  WORKFLOW_LABELS,
  HOLD_BLOCKED_STEPS,
} from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Badge, StatusBadge, AdminOnly, Button, Input, Select, Spinner, EmptyState } from '../../components/ui.jsx'
import { ShoppingBagIcon } from '../../components/icons.jsx'
import OrderNotes from '../../components/OrderNotes.jsx'

const OTHER_COURIER = '__other__'

const REALTIME_TABLES = ['shopify_sync_ping']

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function money(amount, currency) {
  if (amount == null) return null
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR' }).format(amount)
}

export default function ShopifyOrderDetail() {
  const { id } = useParams()
  const { member } = useTeamMember()
  const { push } = useToast()
  const [data, setData] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [teamNames, setTeamNames] = useState({})
  const [updating, setUpdating] = useState(false)
  const [overrideReasons, setOverrideReasons] = useState({})
  const [couriers, setCouriers] = useState([])
  const [shipment, setShipmentState] = useState(null)
  const [courierChoice, setCourierChoice] = useState('')
  const [courierOther, setCourierOther] = useState('')
  const [trackingInput, setTrackingInput] = useState('')
  const [savingShipment, setSavingShipment] = useState(false)

  const load = useCallback(async () => {
    const result = await getShopifyOrderWithItems(id)
    if (!result) {
      setNotFound(true)
      return
    }
    setData(result)
    const existing = await getShipment({ shopifyOrderId: id })
    setShipmentState(existing)
    if (existing) {
      setTrackingInput(existing.trackingNumber)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    listTeamMemberNames().then((rows) => {
      setTeamNames(Object.fromEntries(rows.map((r) => [r.id, r.name])))
    })
    listCouriers().then(setCouriers)
  }, [])

  // Once couriers have loaded and we know the existing shipment (if any),
  // pick the matching dropdown option — or fall back to "Other" with the
  // saved name in the free-text field.
  useEffect(() => {
    if (!shipment || couriers.length === 0) return
    const match = couriers.find((c) => c.name.toLowerCase() === shipment.courierName.toLowerCase())
    if (match) {
      setCourierChoice(match.name)
    } else {
      setCourierChoice(OTHER_COURIER)
      setCourierOther(shipment.courierName)
    }
  }, [shipment, couriers])

  const saveShipment = async () => {
    const courierName = courierChoice === OTHER_COURIER ? courierOther.trim() : courierChoice
    if (!courierName || !trackingInput.trim()) {
      push('Pick a courier and enter the tracking number', { tone: 'error' })
      return
    }
    setSavingShipment(true)
    try {
      const saved = await setShipment({ shopifyOrderId: id, courierName, trackingNumber: trackingInput.trim() })
      setShipmentState(saved)
      push('Tracking saved', { tone: 'success' })
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSavingShipment(false)
    }
  }

  const copyWhatsAppMessage = async () => {
    if (!data || !shipment) return
    const trackingUrl = buildTrackingUrl(shipment.courierName, shipment.trackingNumber, couriers)
    const message = buildWhatsAppShipmentMessage({
      customerName: data.order.customerName,
      orderNumber: data.order.orderNumber,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      trackingUrl,
    })
    try {
      await navigator.clipboard.writeText(message)
      push('WhatsApp message copied', { tone: 'success' })
    } catch {
      push('Could not copy — your browser may be blocking clipboard access', { tone: 'error' })
    }
  }

  useRealtimeRefresh(REALTIME_TABLES, load)

  const moveTo = async (newStatus, overrideReason) => {
    setUpdating(true)
    try {
      await setShopifyOrderWorkflowStatus({
        orderId: data.order.id,
        newStatus,
        expectedStatus: data.order.workflowStatus,
        overrideReason,
      })
      setOverrideReasons((r) => ({ ...r, [newStatus]: '' }))
      await load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setUpdating(false)
    }
  }

  if (notFound) {
    return (
      <div>
        <PageHeader title="Order" back />
        <EmptyState icon={<ShoppingBagIcon className="h-10 w-10" />} title="Order not found" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  const { order, items } = data
  const addr = order.shippingAddress

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <PageHeader title={order.orderNumber} back />

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <StatusBadge kind="shopify" value={order.workflowStatus} />
          <Badge tone="brand">{(order.fulfillmentStatus || '').replace(/_/g, ' ').toLowerCase() || 'unknown'}</Badge>
        </div>
        <p className="text-xs text-slate-400">Placed {formatDate(order.createdAt)}</p>
        {order.workflowUpdatedBy && (
          <p className="text-xs text-slate-400">
            Last moved by {teamNames[order.workflowUpdatedBy] || 'a team member'}
            {order.workflowUpdatedAt && ` · ${formatDate(order.workflowUpdatedAt)}`}
          </p>
        )}
        {order.paymentHold && <p className="text-xs font-semibold text-danger-600">Payment issue — do not ship</p>}
        {order.cancelledAt && <p className="text-xs text-slate-400">Cancelled {formatDate(order.cancelledAt)}</p>}
        {order.financialStatus && !['PAID', 'AUTHORIZED', 'PARTIALLY_REFUNDED'].includes(order.financialStatus) && (
          <AdminOnly>
            <p className="text-xs text-slate-400">Payment status: {order.financialStatus.toLowerCase()}</p>
          </AdminOnly>
        )}
      </Card>

      <Card className="space-y-2.5">
        <p className="text-xs font-semibold text-slate-500">Workflow</p>
        {order.paymentHold && (
          <p className="text-xs font-semibold text-danger-600">
            {order.cancelledAt ? 'This order is cancelled.' : 'This order has a payment issue.'} Packing, Packed and
            Dispatched are blocked{member?.isAdmin ? ' unless overridden below' : ''} — Delivered is not affected.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {WORKFLOW_STEPS.map((step) => {
            const stepIndex = WORKFLOW_STEPS.indexOf(step)
            const currentIndex = WORKFLOW_STEPS.indexOf(order.workflowStatus)
            if (step === order.workflowStatus) return null
            // Staff only ever see the single next step forward; admins see
            // every other step, forward or back.
            if (!member?.isAdmin && stepIndex !== currentIndex + 1) return null

            const blocked = order.paymentHold && HOLD_BLOCKED_STEPS.includes(step)
            // Staff have no override, at any status — the banner above
            // already explains why, so just omit the button entirely.
            if (blocked && !member?.isAdmin) return null

            if (blocked && member?.isAdmin) {
              return (
                <div key={step} className="flex w-full items-center gap-2">
                  <Input
                    placeholder={`Reason to override and move to ${WORKFLOW_LABELS[step]}`}
                    value={overrideReasons[step] || ''}
                    onChange={(e) => setOverrideReasons((r) => ({ ...r, [step]: e.target.value }))}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => moveTo(step, overrideReasons[step])}
                    disabled={updating || !overrideReasons[step]?.trim()}
                  >
                    {updating ? <Spinner className="h-4 w-4" /> : 'Override'}
                  </Button>
                </div>
              )
            }

            return (
              <Button key={step} size="sm" variant={stepIndex > currentIndex ? 'primary' : 'outline'} onClick={() => moveTo(step)} disabled={updating}>
                {updating ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  `Move to ${WORKFLOW_LABELS[step]}${step === 'shipped' ? ' (not sent to Shopify)' : ''}`
                )}
              </Button>
            )
          })}
        </div>
        {order.workflowStatus === 'shipped' && <p className="text-xs text-slate-400">Dispatched — not yet sent to Shopify.</p>}
        {order.workflowHoldOverrideReason && (
          <p className="text-xs text-slate-400">
            Payment hold overridden by {teamNames[order.workflowHoldOverrideBy] || 'a team member'}
            {order.workflowHoldOverrideAt && ` on ${formatDate(order.workflowHoldOverrideAt)}`}: "{order.workflowHoldOverrideReason}"
          </p>
        )}
      </Card>

      <Card className="space-y-2.5">
        <p className="text-xs font-semibold text-slate-500">Shipment</p>
        <div className="flex gap-2">
          <Select value={courierChoice} onChange={(e) => setCourierChoice(e.target.value)} className="flex-1">
            <option value="">Pick a courier…</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            <option value={OTHER_COURIER}>Other</option>
          </Select>
        </div>
        {courierChoice === OTHER_COURIER && (
          <Input value={courierOther} onChange={(e) => setCourierOther(e.target.value)} placeholder="Courier name" />
        )}
        <Input value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} placeholder="Tracking number" />
        <Button size="sm" variant="outline" onClick={saveShipment} disabled={savingShipment}>
          {savingShipment ? <Spinner className="h-4 w-4" /> : 'Save tracking'}
        </Button>
        {shipment && (
          <div className="flex gap-2 pt-1">
            {buildTrackingUrl(shipment.courierName, shipment.trackingNumber, couriers) ? (
              <Button
                as="a"
                href={buildTrackingUrl(shipment.courierName, shipment.trackingNumber, couriers)}
                target="_blank"
                rel="noreferrer"
                size="sm"
                className="flex-1"
              >
                Track
              </Button>
            ) : (
              <p className="flex-1 self-center text-xs text-slate-400">
                No tracking link known for "{shipment.courierName}" — share the number directly.
              </p>
            )}
            <Button size="sm" variant="outline" className="flex-1" onClick={copyWhatsAppMessage}>
              Copy WhatsApp message
            </Button>
          </div>
        )}
      </Card>

      <Card className="space-y-1.5 text-sm">
        <p className="font-semibold text-slate-800">{order.customerName || 'No name on order'}</p>
        {order.customerPhone && <p className="text-slate-500">{order.customerPhone}</p>}
        {order.customerEmail && <p className="text-slate-500">{order.customerEmail}</p>}
        {addr && (
          <p className="pt-1 text-slate-500">
            {[addr.address1, addr.address2, addr.city, addr.province, addr.zip, addr.country].filter(Boolean).join(', ')}
          </p>
        )}
        {!order.customerPhone && !order.customerEmail && !addr && (
          <p className="text-xs text-slate-400">No contact details on this order.</p>
        )}
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-500">Items</p>
        <Card className="divide-y divide-slate-100 !p-0">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-700">{it.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {it.variantTitle && `${it.variantTitle} · `}
                  {it.sku || 'No SKU'}
                  {!it.productId && it.sku && <span className="text-warn-600"> · unmapped</span>}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-slate-700">× {it.quantity}</p>
                {it.unitPrice != null && <p className="text-xs text-slate-400">{money(it.unitPrice, order.currency)}</p>}
              </div>
            </div>
          ))}
        </Card>
      </div>

      {order.totalPrice != null && (
        <Card className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-medium text-slate-700">{money(order.subtotalPrice, order.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Tax</span>
            <span className="font-medium text-slate-700">{money(order.totalTax, order.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1.5">
            <span className="font-semibold text-slate-600">Total</span>
            <span className="font-bold text-slate-900">{money(order.totalPrice, order.currency)}</span>
          </div>
        </Card>
      )}

      {order.note && (
        <Card className="text-sm text-slate-600">
          <p className="mb-1 text-xs font-semibold text-slate-400">Note</p>
          {order.note}
        </Card>
      )}

      <OrderNotes shopifyOrderId={id} />
    </div>
  )
}
