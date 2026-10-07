import { useCallback, useEffect, useMemo, useState } from 'react'
import { listUnmappedShopifySkus, listSkuMappings, saveSkuMapping, listProducts } from '../../db/storage.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { PageHeader, Card, Button, Input, Select, Spinner, EmptyState, AdminOnly } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { ShoppingBagIcon } from '../../components/icons.jsx'

// Scores how well a Shopify line-item title matches a catalog product name
// by shared words, so the likeliest product sorts first in the picker —
// the admin still has to confirm it, this is only a sort hint.
function suggestionScore(title, productName) {
  const words = (s) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2))
  const a = words(title)
  const b = words(productName)
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared
}

function MappingRow({ sku, sampleTitle, orderItemCount, products, onSaved }) {
  const { push } = useToast()
  const [productId, setProductId] = useState('')
  const [multiplier, setMultiplier] = useState(1)
  const [saving, setSaving] = useState(false)

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => suggestionScore(sampleTitle, b.name) - suggestionScore(sampleTitle, a.name))
  }, [products, sampleTitle])

  const confirm = async () => {
    if (!productId) {
      push('Pick a product first', { tone: 'error' })
      return
    }
    setSaving(true)
    try {
      await saveSkuMapping({ shopifySku: sku, productId, quantityMultiplier: Number(multiplier) || 1 })
      push('Mapping saved', { tone: 'success' })
      onSaved()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-2.5">
      <div>
        <p className="font-mono text-sm font-semibold text-slate-800">{sku}</p>
        <p className="truncate text-xs text-slate-400">
          {sampleTitle} · {orderItemCount} order item{orderItemCount === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex gap-2">
        <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="flex-1">
          <option value="">Pick the matching product…</option>
          {sortedProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </Select>
        <Input
          type="number"
          min="1"
          value={multiplier}
          onChange={(e) => setMultiplier(e.target.value)}
          className="!w-20"
          title="Quantity multiplier"
        />
      </div>
      <Button size="sm" className="w-full" onClick={confirm} disabled={saving}>
        {saving ? <Spinner className="h-4 w-4" /> : 'Confirm mapping'}
      </Button>
    </Card>
  )
}

export default function ShopifySkuMapping() {
  const { member } = useTeamMember()
  const [unmapped, setUnmapped] = useState(null)
  const [mapped, setMapped] = useState(null)
  const [products, setProducts] = useState([])

  const load = useCallback(() => {
    listUnmappedShopifySkus().then(setUnmapped)
    listSkuMappings().then(setMapped)
  }, [])

  useEffect(() => {
    if (!member?.isAdmin) return
    load()
    listProducts().then(setProducts)
  }, [load, member?.isAdmin])

  const productName = (id) => products.find((p) => p.id === id)?.name || 'Unknown product'

  return (
    <div className="space-y-5 px-4 pb-8 pt-4">
      <PageHeader title="Shopify SKU Mapping" back />

      <AdminOnly fallback={<EmptyState title="Admins only" subtitle="Ask an admin to map Shopify SKUs to products" />}>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-500">Unmapped SKUs</p>
        {unmapped === null ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : unmapped.length === 0 ? (
          <EmptyState icon={<ShoppingBagIcon className="h-10 w-10" />} title="Nothing unmapped" subtitle="Every synced SKU has a product" />
        ) : (
          <div className="space-y-2.5">
            {unmapped.map((u) => (
              <MappingRow key={u.sku} {...u} products={products} onSaved={load} />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-500">Confirmed mappings</p>
        {mapped === null ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : mapped.length === 0 ? (
          <p className="text-xs text-slate-400">No mappings confirmed yet.</p>
        ) : (
          <Card className="divide-y divide-slate-100 !p-0">
            {mapped.map((m) => (
              <div key={m.shopifySku} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-slate-500">{m.shopifySku}</p>
                  <p className="truncate font-medium text-slate-700">{productName(m.productId)}</p>
                </div>
                {m.quantityMultiplier !== 1 && (
                  <span className="shrink-0 text-xs font-semibold text-slate-400">×{m.quantityMultiplier}</span>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
      </AdminOnly>
    </div>
  )
}
