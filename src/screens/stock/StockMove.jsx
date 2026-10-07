import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adjustStock, getProduct, listProducts, getProductByCode } from '../../db/storage.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Field, Input, Select, Textarea, Button, Spinner, SegmentedControl, SearchBox } from '../../components/ui.jsx'
import { ScanIcon, BoxIcon } from '../../components/icons.jsx'

const TYPE_OPTIONS = [
  { value: 'in', label: 'Stock in' },
  { value: 'out', label: 'Stock out' },
]

const REASONS = {
  in: [
    { value: 'received', label: 'Received from supplier' },
    { value: 'adjustment', label: 'Adjustment (count correction)' },
  ],
  out: [
    { value: 'sold', label: 'Sold' },
    { value: 'damaged', label: 'Damaged / lost' },
    { value: 'adjustment', label: 'Adjustment (count correction)' },
  ],
}

export default function StockMove() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { member } = useTeamMember()
  const { push } = useToast()

  const [type, setType] = useState(params.get('type') === 'out' ? 'out' : 'in')
  const [product, setProduct] = useState(null)
  const [loadingProduct, setLoadingProduct] = useState(Boolean(params.get('productId') || params.get('code')))
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState(REASONS.in[0].value)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setReason(REASONS[type][0].value)
  }, [type])

  useEffect(() => {
    const productId = params.get('productId')
    const code = params.get('code')
    if (productId) {
      getProduct(productId).then((p) => {
        setProduct(p || null)
        setLoadingProduct(false)
      })
    } else if (code) {
      getProductByCode(code).then((p) => {
        setProduct(p || null)
        setLoadingProduct(false)
        if (!p) push(`No product found for code "${code}"`, { tone: 'error' })
      })
    }
  }, [params, push])

  useEffect(() => {
    if (!search.trim() || product) {
      setResults([])
      return
    }
    let cancelled = false
    listProducts({ search }).then((items) => {
      if (!cancelled) setResults(items.slice(0, 8))
    })
    return () => {
      cancelled = true
    }
  }, [search, product])

  const submit = async (e) => {
    e.preventDefault()
    if (!product) return
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      push('Enter a quantity greater than zero', { tone: 'error' })
      return
    }
    setSaving(true)
    try {
      const { crossedBelowThreshold, product: updated } = await adjustStock({
        productId: product.id,
        type,
        quantity: qty,
        reason,
        note,
        member,
      })
      push(`${type === 'in' ? 'Added' : 'Removed'} ${qty} ${updated.unit} · ${product.name}`, { tone: 'success' })
      if (crossedBelowThreshold) {
        push(`⚠ ${product.name} just dropped below its low-stock threshold`, { tone: 'warn', duration: 5000 })
      }
      navigate(`/products/${product.id}`)
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Stock movement" back />

      <div className="space-y-4 px-4 py-4">
        <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} className="justify-center" />

        {loadingProduct ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6 text-brand-600" />
          </div>
        ) : product ? (
          <Card className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
              {product.photo ? (
                <img src={product.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <BoxIcon className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{product.name}</p>
              <p className="text-xs text-slate-400">
                {product.sku} · {product.quantity} {product.unit} in stock
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setProduct(null)}>
              Change
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <SearchBox
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product or SKU"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => navigate('/scan?redirect=stock-move')}>
                <ScanIcon className="h-5 w-5" />
              </Button>
            </div>
            {results.length > 0 && (
              <Card className="divide-y divide-slate-100 !p-0">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProduct(p)
                      setSearch('')
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.sku}</p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {p.quantity} {p.unit}
                    </span>
                  </button>
                ))}
              </Card>
            )}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Field label="Quantity">
            <Input
              type="number"
              min="1"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              disabled={!product}
            />
          </Field>

          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value)} disabled={!product}>
              {REASONS[type].map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Note (optional)">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add details..." disabled={!product} />
          </Field>

          <Button type="submit" size="lg" className="w-full" disabled={!product || saving}>
            {saving ? <Spinner className="h-4 w-4" /> : `Confirm ${type === 'in' ? 'stock in' : 'stock out'}`}
          </Button>
        </form>
      </div>
    </div>
  )
}
