import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSupplier, listProductsBySupplier } from '../../db/storage.js'
import { PageHeader, Card, Badge, Button, EmptyState, Spinner } from '../../components/ui.jsx'
import { EditIcon, BoxIcon, ClipboardIcon } from '../../components/icons.jsx'

export default function SupplierDetail() {
  const { id } = useParams()
  const [supplier, setSupplier] = useState(null)
  const [products, setProducts] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getSupplier(id).then((s) => {
      if (!s) {
        setNotFound(true)
        return
      }
      setSupplier(s)
    })
    listProductsBySupplier(id).then(setProducts)
  }, [id])

  if (notFound) {
    return (
      <div>
        <PageHeader title="Supplier" back />
        <EmptyState title="Supplier not found" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  return (
    <div className="pb-8">
      <PageHeader
        title={supplier.name}
        back
        right={
          <Link to={`/suppliers/${id}/edit`}>
            <Button variant="ghost" size="icon" aria-label="Edit">
              <EditIcon className="h-5 w-5" />
            </Button>
          </Link>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        <Card className="space-y-2 text-sm">
          {supplier.contactName && (
            <div className="flex justify-between">
              <span className="text-slate-400">Contact</span>
              <span className="font-medium text-slate-700">{supplier.contactName}</span>
            </div>
          )}
          {supplier.phone && (
            <div className="flex justify-between">
              <span className="text-slate-400">Phone</span>
              <a href={`tel:${supplier.phone}`} className="font-medium text-brand-600">
                {supplier.phone}
              </a>
            </div>
          )}
          {supplier.email && (
            <div className="flex justify-between">
              <span className="text-slate-400">Email</span>
              <a href={`mailto:${supplier.email}`} className="truncate font-medium text-brand-600">
                {supplier.email}
              </a>
            </div>
          )}
          {supplier.notes && (
            <div className="pt-1">
              <span className="text-slate-400">Notes</span>
              <p className="mt-0.5 font-medium text-slate-700">{supplier.notes}</p>
            </div>
          )}
          {!supplier.contactName && !supplier.phone && !supplier.email && !supplier.notes && (
            <p className="text-slate-400">No contact details yet</p>
          )}
        </Card>

        <Link to={`/purchase-orders/new?supplierId=${id}`}>
          <Button className="w-full" size="lg">
            <ClipboardIcon className="h-5 w-5" /> Create purchase order
          </Button>
        </Link>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-500">Products supplied</p>
          {products === null ? (
            <Spinner className="h-5 w-5 text-brand-600" />
          ) : products.length === 0 ? (
            <EmptyState icon={<BoxIcon className="h-8 w-8" />} title="No linked products" />
          ) : (
            <Card className="divide-y divide-slate-100 !p-0">
              {products.map((p) => (
                <Link key={p.id} to={`/products/${p.id}`} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <Badge tone={p.hasBeenCounted && p.quantity <= p.lowStockThreshold ? 'danger' : 'slate'}>
                    {p.quantity} {p.unit}
                  </Badge>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
