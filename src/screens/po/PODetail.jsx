import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getPurchaseOrder,
  getSupplier,
  listProducts,
  updatePurchaseOrderStatus,
  receivePurchaseOrder,
  deletePurchaseOrder,
} from '../../db/storage.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { PageHeader, Card, Badge, StatusBadge, Button, Input, Spinner, EmptyState } from '../../components/ui.jsx'
import { TrashIcon, PackageCheckIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['purchase_orders', 'products']

export default function PODetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member } = useTeamMember()
  const { push } = useToast()

  const [po, setPo] = useState(null)
  const [supplier, setSupplier] = useState(null)
  const [products, setProducts] = useState({})
  const [receiveMode, setReceiveMode] = useState(false)
  const [receiveQty, setReceiveQty] = useState({})
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const order = await getPurchaseOrder(id)
    if (!order) {
      setNotFound(true)
      return
    }
    setPo(order)
    setSupplier(await getSupplier(order.supplierId))
    const allProducts = await listProducts()
    const map = {}
    allProducts.forEach((p) => (map[p.id] = p))
    setProducts(map)
    const initial = {}
    order.items.forEach((it) => {
      initial[it.productId] = Math.max(0, it.qtyOrdered - it.qtyReceived)
    })
    setReceiveQty(initial)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Skip auto-refresh while actively entering receive quantities, so an
  // unrelated change elsewhere doesn't wipe out in-progress input.
  useRealtimeRefresh(REALTIME_TABLES, () => {
    if (!receiveMode) load()
  })

  if (notFound) {
    return (
      <div>
        <PageHeader title="Purchase order" back />
        <EmptyState title="Not found" subtitle="It may have been deleted" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  const totalCost = po.items.reduce((s, i) => s + i.qtyOrdered * i.unitCost, 0)
  const canMarkOrdered = po.status === 'draft'
  const canReceive = po.status === 'ordered' || po.status === 'partially_received'

  const markOrdered = async () => {
    setBusy(true)
    try {
      await updatePurchaseOrderStatus(id, 'ordered')
      push('Marked as ordered', { tone: 'success' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const submitReceive = async () => {
    const received = Object.entries(receiveQty)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => ({ productId, qty: Number(qty) }))
    if (!received.length) {
      push('Enter at least one quantity to receive', { tone: 'error' })
      return
    }
    setBusy(true)
    try {
      const updated = await receivePurchaseOrder(id, received, member)
      push(
        updated.status === 'received' ? 'Purchase order fully received' : 'Items received, stock updated',
        { tone: 'success' },
      )
      setReceiveMode(false)
      await load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!confirm('Delete this purchase order? This cannot be undone.')) return
    await deletePurchaseOrder(id)
    push('Purchase order deleted')
    navigate('/purchase-orders')
  }

  return (
    <div className="pb-8">
      <PageHeader
        title={supplier?.name || 'Purchase order'}
        back
        right={
          po.status === 'draft' && (
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete">
              <TrashIcon className="h-5 w-5 text-danger-600" />
            </Button>
          )
        }
      />

      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <StatusBadge kind="po" value={po.status} />
          <span className="text-sm text-slate-400">
            {new Date(po.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {po.note && (
          <Card className="text-sm text-slate-600">
            <p className="mb-1 text-xs font-semibold text-slate-400">Note</p>
            {po.note}
          </Card>
        )}

        <Card className="divide-y divide-slate-100 !p-0">
          {po.items.map((line) => {
            const product = products[line.productId]
            const remaining = line.qtyOrdered - line.qtyReceived
            return (
              <div key={line.productId} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{product?.name || 'Unknown product'}</p>
                    <p className="text-xs text-slate-400">
                      {line.qtyReceived}/{line.qtyOrdered} received · ₹{line.unitCost} each
                    </p>
                  </div>
                  {remaining > 0 ? (
                    <Badge tone="warn">{remaining} left</Badge>
                  ) : (
                    <Badge tone="ok">Complete</Badge>
                  )}
                </div>
                {receiveMode && remaining > 0 && (
                  <div className="mt-2">
                    <Input
                      type="number"
                      min="0"
                      max={remaining}
                      value={receiveQty[line.productId] ?? ''}
                      onChange={(e) =>
                        setReceiveQty((q) => ({ ...q, [line.productId]: e.target.value }))
                      }
                    />
                  </div>
                )}
              </div>
            )
          })}
        </Card>

        <Card className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500">Expected total</span>
          <span className="text-lg font-bold text-slate-900">₹{totalCost.toFixed(2)}</span>
        </Card>

        {canMarkOrdered && (
          <Button className="w-full" size="lg" onClick={markOrdered} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Mark as ordered'}
          </Button>
        )}

        {canReceive && !receiveMode && (
          <Button className="w-full" size="lg" onClick={() => setReceiveMode(true)}>
            <PackageCheckIcon className="h-5 w-5" /> Receive items
          </Button>
        )}

        {canReceive && receiveMode && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setReceiveMode(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitReceive} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Confirm receipt'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
