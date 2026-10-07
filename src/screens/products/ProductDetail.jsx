import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getProduct, getSupplier, listMovements, markProductCounted } from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { formatWeight, productWeightGrams } from '../../lib/weight.js'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Badge, Button, Spinner, EmptyState } from '../../components/ui.jsx'
import { PlusIcon, MinusIcon, EditIcon, QrIcon, BoxIcon, TruckIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['products', 'movements']

const REASON_LABEL = {
  received: 'Received',
  sold: 'Sold',
  damaged: 'Damaged',
  adjustment: 'Adjusted',
  counted_zero: 'Counted (zero)',
  pack_size_conversion: 'Pack size changed',
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const [product, setProduct] = useState(null)
  const [supplier, setSupplier] = useState(null)
  const [movements, setMovements] = useState(null)
  const [showLabel, setShowLabel] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    const p = await getProduct(id)
    if (!p) {
      setNotFound(true)
      return
    }
    setProduct(p)
    if (p.supplierId) setSupplier(await getSupplier(p.supplierId))
    setMovements(await listMovements({ productId: id, limit: 30 }))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  const markCounted = async () => {
    if (!confirm('Confirm this product is genuinely at zero stock right now?')) return
    setMarking(true)
    try {
      await markProductCounted(id)
      push('Marked as counted', { tone: 'success' })
      await load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setMarking(false)
    }
  }

  if (notFound) {
    return (
      <div>
        <PageHeader title="Product" back />
        <EmptyState title="Product not found" subtitle="It may have been deleted" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  const low = product.hasBeenCounted && product.quantity <= product.lowStockThreshold

  return (
    <div className="pb-8">
      <PageHeader
        title={product.name}
        back
        right={
          <Link to={`/products/${id}/edit`}>
            <Button variant="ghost" size="icon" aria-label="Edit">
              <EditIcon className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
            {product.photo ? (
              <img src={product.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <BoxIcon className="h-7 w-7 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">{product.sku}</p>
            <p className="text-2xl font-bold text-slate-900">
              {product.quantity} <span className="text-base font-medium text-slate-400">{product.unit}</span>
            </p>
            {product.packSizeGrams > 0 && (
              <p className="text-sm text-slate-400">
                {product.packSizeGrams} g pack · {formatWeight(productWeightGrams(product))} total
              </p>
            )}
            {low && <Badge tone="danger">Below threshold ({product.lowStockThreshold})</Badge>}
            {!product.hasBeenCounted && (
              <p className="mt-1 text-xs text-amber-600">
                No physical count yet — enter today's pack count via Stock In, reason "Adjustment (count correction)",
                or if it's genuinely zero right now, use "Mark as counted" below instead.
              </p>
            )}
          </div>
        </Card>

        {!product.hasBeenCounted && product.quantity === 0 && (
          <Button variant="outline" className="w-full" onClick={markCounted} disabled={marking}>
            {marking ? <Spinner className="h-4 w-4" /> : 'Mark as counted (zero stock)'}
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate(`/stock-move?productId=${id}&type=in`)}
          >
            <PlusIcon className="h-5 w-5" /> Stock in
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate(`/stock-move?productId=${id}&type=out`)}
          >
            <MinusIcon className="h-5 w-5" /> Stock out
          </Button>
        </div>

        <Card className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Category</span>
            <span className="font-medium text-slate-700">{product.category || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Unit cost</span>
            <span className="font-medium text-slate-700">₹{Number(product.unitCost || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Supplier</span>
            {supplier ? (
              <Link to={`/suppliers/${supplier.id}`} className="flex items-center gap-1 font-medium text-brand-600">
                <TruckIcon className="h-3.5 w-3.5" /> {supplier.name}
              </Link>
            ) : (
              <span className="font-medium text-slate-700">—</span>
            )}
          </div>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => setShowLabel(true)}>
          <QrIcon className="h-5 w-5" /> View / print QR label
        </Button>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-500">Movement history</p>
          {movements === null ? (
            <Spinner className="h-5 w-5 text-brand-600" />
          ) : movements.length === 0 ? (
            <EmptyState title="No movements yet" subtitle="Stock changes will be logged here" />
          ) : (
            <Card className="divide-y divide-slate-100 !p-0">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700">
                      {REASON_LABEL[m.reason] || m.reason}
                      {m.note && <span className="text-slate-400"> · {m.note}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(m.timestamp)} · {m.memberName || 'Unknown'}
                    </p>
                  </div>
                  <span className={`shrink-0 font-bold ${m.quantity < 0 ? 'text-danger-600' : 'text-ok-600'}`}>
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {showLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-6">
            <div id="print-area" className="flex flex-col items-center gap-3 text-center">
              <QRCodeSVG value={product.sku} size={200} />
              <p className="text-base font-bold text-slate-900">{product.name}</p>
              <p className="text-sm text-slate-500">{product.sku}</p>
            </div>
            <div className="mt-5 flex gap-2 print:hidden">
              <Button variant="outline" className="flex-1" onClick={() => setShowLabel(false)}>
                Close
              </Button>
              <Button className="flex-1" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
