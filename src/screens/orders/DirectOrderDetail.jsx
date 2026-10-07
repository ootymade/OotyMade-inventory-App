import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getInvoiceWithItems,
  confirmDirectOrder,
  deleteDraftOrder,
  updateShipment,
  listCouriers,
  getShipment,
  setShipment,
  buildTrackingUrl,
  buildWhatsAppShipmentMessage,
} from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { downloadInvoicePdf, invoicePdfBlob, invoiceFilename } from '../../lib/invoicePdf.js'
import { PageHeader, Card, Badge, Button, Input, Select, Field, Spinner, EmptyState } from '../../components/ui.jsx'
import { DownloadIcon, TrashIcon, PackageCheckIcon } from '../../components/icons.jsx'

const OTHER_COURIER = '__other__'

const STATUS_TONE = { draft: 'slate', confirmed: 'brand', shipped: 'warn', delivered: 'ok', cancelled: 'danger' }
const STATUS_LABEL = {
  draft: 'Proforma (draft)',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const REALTIME_TABLES = ['invoices', 'invoice_items']

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function DirectOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member } = useTeamMember()
  const { push } = useToast()

  const [data, setData] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [couriers, setCouriers] = useState([])
  const [shipment, setShipmentState] = useState(null)
  const [courierChoice, setCourierChoice] = useState('')
  const [courierOther, setCourierOther] = useState('')
  const [tracking, setTracking] = useState('')

  const load = useCallback(async () => {
    const result = await getInvoiceWithItems(id)
    if (!result) {
      setNotFound(true)
      return
    }
    setData(result)
    const existing = await getShipment({ invoiceId: id })
    setShipmentState(existing)
    if (existing) setTracking(existing.trackingNumber)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    listCouriers().then(setCouriers)
  }, [])

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

  useRealtimeRefresh(REALTIME_TABLES, load)

  if (notFound) {
    return (
      <div>
        <PageHeader title="Order" back />
        <EmptyState title="Order not found" />
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

  const { invoice, items } = data
  const isDraft = invoice.status === 'draft'

  const onConfirm = async () => {
    if (!confirm('Confirm this order? This assigns a GST invoice number and deducts stock — it cannot be undone.')) return
    setBusy(true)
    try {
      await confirmDirectOrder(id, member)
      push('Order confirmed — GST invoice generated', { tone: 'success' })
      await load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!confirm('Delete this draft order?')) return
    await deleteDraftOrder(id)
    push('Draft deleted')
    navigate('/direct-orders')
  }

  const saveShipment = async () => {
    const courierName = courierChoice === OTHER_COURIER ? courierOther.trim() : courierChoice
    if (!courierName || !tracking.trim()) {
      push('Pick a courier and enter the tracking number', { tone: 'error' })
      return
    }
    setBusy(true)
    try {
      const saved = await setShipment({ invoiceId: id, courierName, trackingNumber: tracking.trim() })
      setShipmentState(saved)
      push('Tracking saved', { tone: 'success' })
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const copyWhatsAppMessage = async () => {
    if (!shipment) return
    const trackingUrl = buildTrackingUrl(shipment.courierName, shipment.trackingNumber, couriers)
    const message = buildWhatsAppShipmentMessage({
      customerName: invoice.customerName,
      orderNumber: invoice.kind === 'gst' ? `INV-${invoice.invoiceNumber}` : invoice.invoiceNumber,
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

  const setStatus = async (status) => {
    setBusy(true)
    try {
      await updateShipment(id, { status })
      push(`Marked as ${STATUS_LABEL[status].toLowerCase()}`, { tone: 'success' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const onDownload = () => downloadInvoicePdf({ invoice, items })

  const onShare = async () => {
    try {
      const blob = await invoicePdfBlob({ invoice, items })
      const file = new File([blob], invoiceFilename(invoice), { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        const trackLine = shipment ? `\nTrack my order: ${shipment.courierName} — ${shipment.trackingNumber}` : ''
        await navigator.share({
          files: [file],
          title: invoice.kind === 'gst' ? `Invoice INV-${invoice.invoiceNumber}` : 'Proforma Invoice',
          text: `Here's your ${invoice.kind === 'gst' ? 'invoice' : 'quote'} from OotyMade.${trackLine}`,
        })
      } else {
        onDownload()
        push('Direct sharing isn’t supported here — downloaded the PDF instead', { tone: 'warn' })
      }
    } catch (err) {
      if (err?.name !== 'AbortError') push('Could not share the PDF', { tone: 'error' })
    }
  }

  return (
    <div className="pb-8">
      <PageHeader
        title={invoice.customerName}
        back
        right={
          isDraft && (
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete draft">
              <TrashIcon className="h-5 w-5 text-danger-600" />
            </Button>
          )
        }
      />

      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <Badge tone={STATUS_TONE[invoice.status]}>{STATUS_LABEL[invoice.status]}</Badge>
          <span className="text-sm text-slate-400">
            {invoice.kind === 'gst' ? `INV-${invoice.invoiceNumber}` : 'Proforma'} · {formatDate(invoice.createdAt)}
          </span>
        </div>

        <Card className="space-y-1 text-sm">
          <p className="font-semibold text-slate-800">{invoice.customerName}</p>
          {invoice.customerPhone && <p className="text-slate-500">{invoice.customerPhone}</p>}
          {invoice.customerAddress && <p className="text-slate-500">{invoice.customerAddress}</p>}
          <p className="text-slate-400">{invoice.customerState}{invoice.customerGstin && ` · GSTIN ${invoice.customerGstin}`}</p>
        </Card>

        <Card className="divide-y divide-slate-100 !p-0">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{it.name}</p>
                <p className="text-xs text-slate-400">
                  HSN {it.hsnCode} · {it.quantity} × ₹{it.unitPrice.toFixed(2)}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-slate-700">₹{it.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </Card>

        <Card className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-medium text-slate-700">₹{invoice.subtotal.toFixed(2)}</span>
          </div>
          {invoice.cgst > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">CGST</span>
              <span className="font-medium text-slate-700">₹{invoice.cgst.toFixed(2)}</span>
            </div>
          )}
          {invoice.sgst > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">SGST</span>
              <span className="font-medium text-slate-700">₹{invoice.sgst.toFixed(2)}</span>
            </div>
          )}
          {invoice.igst > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">IGST</span>
              <span className="font-medium text-slate-700">₹{invoice.igst.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold text-slate-900">
            <span>Total</span>
            <span>₹{invoice.total.toFixed(2)}</span>
          </div>
        </Card>

        {isDraft ? (
          <Button className="w-full" size="lg" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Confirm & generate GST invoice'}
          </Button>
        ) : (
          <>
            <Card className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Shipment tracking</p>
              <Field label="Courier">
                <Select value={courierChoice} onChange={(e) => setCourierChoice(e.target.value)}>
                  <option value="">Pick a courier…</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value={OTHER_COURIER}>Other</option>
                </Select>
              </Field>
              {courierChoice === OTHER_COURIER && (
                <Field label="Courier name">
                  <Input value={courierOther} onChange={(e) => setCourierOther(e.target.value)} />
                </Field>
              )}
              <Field label="Tracking number">
                <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </Field>
              <Button variant="outline" size="sm" onClick={saveShipment} disabled={busy}>
                Save tracking details
              </Button>
              {shipment && (
                <div className="flex gap-2">
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
                    <p className="flex-1 self-center text-xs text-slate-400">No tracking link known for this courier.</p>
                  )}
                  <Button size="sm" variant="outline" className="flex-1" onClick={copyWhatsAppMessage}>
                    Copy WhatsApp message
                  </Button>
                </div>
              )}
              {invoice.status === 'confirmed' && (
                <Button size="sm" onClick={() => setStatus('shipped')} disabled={busy}>
                  <PackageCheckIcon className="h-4 w-4" /> Mark as shipped
                </Button>
              )}
              {invoice.status === 'shipped' && (
                <Button size="sm" onClick={() => setStatus('delivered')} disabled={busy}>
                  <PackageCheckIcon className="h-4 w-4" /> Mark as delivered
                </Button>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onDownload}>
                <DownloadIcon className="h-5 w-5" /> Download PDF
              </Button>
              <Button onClick={onShare}>Share via WhatsApp</Button>
            </div>
          </>
        )}

        {isDraft && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onDownload}>
              <DownloadIcon className="h-5 w-5" /> Download quote
            </Button>
            <Button variant="outline" onClick={onShare}>
              Share quote
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
