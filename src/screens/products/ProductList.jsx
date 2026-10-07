import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listProducts, listCategories, listSuppliers } from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { formatWeight, productWeightGrams } from '../../lib/weight.js'
import { PageHeader, Input, Select, Badge, Card, EmptyState, Button } from '../../components/ui.jsx'
import { SearchIcon, PlusIcon, BoxIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['products']

export default function ProductList() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState(null)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || '')
  const supplierFilter = params.get('supplierId') || ''
  const lowStockOnly = params.get('filter') === 'low-stock'

  useEffect(() => {
    listCategories().then(setCategories)
    listSuppliers().then(setSuppliers)
  }, [])

  useEffect(() => {
    let cancelled = false
    listProducts({ search, category, supplierId: supplierFilter }).then((items) => {
      if (!cancelled) setProducts(items)
    })
    return () => {
      cancelled = true
    }
  }, [search, category, supplierFilter])

  useRealtimeRefresh(REALTIME_TABLES, () => {
    listProducts({ search, category, supplierId: supplierFilter }).then(setProducts)
  })

  const visible = useMemo(() => {
    if (!products) return null
    return lowStockOnly ? products.filter((p) => p.hasBeenCounted && p.quantity <= p.lowStockThreshold) : products
  }, [products, lowStockOnly])

  const totalWeightGrams = useMemo(() => {
    if (!visible) return 0
    return visible.reduce((sum, p) => sum + (productWeightGrams(p) || 0), 0)
  }, [visible])

  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={visible ? `${visible.length} item${visible.length === 1 ? '' : 's'}` : undefined}
        right={
          <Link to="/products/new">
            <Button size="sm" className="!px-3">
              <PlusIcon className="h-4 w-4" /> Add
            </Button>
          </Link>
        }
      />

      <div className="space-y-2 px-4 pt-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              updateParam('q', e.target.value)
            }}
            placeholder="Search by name or SKU"
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => updateParam('filter', lowStockOnly ? '' : 'low-stock')}
            className={`tap shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              lowStockOnly ? 'bg-danger-600 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'
            }`}
          >
            Low stock only
          </button>
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              updateParam('category', e.target.value)
            }}
            className="!w-auto shrink-0 !py-1.5 text-xs"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {supplierFilter && (
            <button
              onClick={() => updateParam('supplierId', '')}
              className="tap shrink-0 rounded-full bg-brand-100 px-3.5 py-1.5 text-xs font-semibold text-brand-600"
            >
              {supplierName(supplierFilter) || 'Supplier'} ✕
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 px-4 pb-4">
        {visible === null ? (
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BoxIcon className="h-10 w-10" />}
            title="No products found"
            subtitle={search || category || lowStockOnly ? 'Try adjusting filters' : 'Add your first product to get started'}
            action={
              !search && !category && !lowStockOnly && (
                <Link to="/products/new">
                  <Button>Add product</Button>
                </Link>
              )
            }
          />
        ) : (
          <>
            {totalWeightGrams > 0 && (
              <Card className="mb-2 flex items-center justify-between !py-3">
                <span className="text-sm text-slate-500">Total weight in view</span>
                <span className="text-sm font-bold text-slate-900">{formatWeight(totalWeightGrams)}</span>
              </Card>
            )}
            <ul className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
              {visible.map((p) => {
                const low = p.hasBeenCounted && p.quantity <= p.lowStockThreshold
                const weight = productWeightGrams(p)
                return (
                  <li key={p.id}>
                    <Link to={`/products/${p.id}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                        {p.photo ? (
                          <img src={p.photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <BoxIcon className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {p.sku} {p.category && `· ${p.category}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge tone={low ? 'danger' : 'slate'}>
                          {p.quantity} {p.unit}
                        </Badge>
                        {weight > 0 && <p className="mt-1 text-[11px] text-slate-400">{formatWeight(weight)}</p>}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
