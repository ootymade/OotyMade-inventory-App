import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listPurchaseOrders, listSuppliers } from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { PageHeader, StatusBadge, SegmentedControl, Button, EmptyState, Card, Skeleton, getStatusMeta } from '../../components/ui.jsx'
import { PlusIcon, ClipboardIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['purchase_orders']

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: getStatusMeta('po', 'draft').label },
  { value: 'ordered', label: getStatusMeta('po', 'ordered').label },
  { value: 'partially_received', label: getStatusMeta('po', 'partially_received').label },
  { value: 'received', label: getStatusMeta('po', 'received').label },
]

export default function POList() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || 'all'
  const [orders, setOrders] = useState(null)
  const [suppliers, setSuppliers] = useState({})

  useEffect(() => {
    listSuppliers().then((items) => {
      const map = {}
      items.forEach((s) => (map[s.id] = s))
      setSuppliers(map)
    })
  }, [])

  useEffect(() => {
    listPurchaseOrders({ status: status === 'all' ? '' : status }).then(setOrders)
  }, [status])

  useRealtimeRefresh(REALTIME_TABLES, () => {
    listPurchaseOrders({ status: status === 'all' ? '' : status }).then(setOrders)
  })

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        right={
          <Link to="/purchase-orders/new">
            <Button size="sm" className="!px-3">
              <PlusIcon className="h-4 w-4" /> New
            </Button>
          </Link>
        }
      />

      <div className="px-4 pt-3 pb-1">
        <SegmentedControl
          options={TABS}
          value={status}
          onChange={(t) => setParams(t === 'all' ? {} : { status: t }, { replace: true })}
        />
      </div>

      <div className="px-4 pt-2 pb-4">
        {orders === null ? (
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon className="h-10 w-10" />}
            title="No purchase orders"
            subtitle="Create one to order stock from a supplier"
            action={
              <Link to="/purchase-orders/new">
                <Button>New purchase order</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {orders.map((po) => {
              const itemCount = po.items.length
              const totalCost = po.items.reduce((s, i) => s + i.qtyOrdered * i.unitCost, 0)
              return (
                <Link key={po.id} to={`/purchase-orders/${po.id}`}>
                  <Card className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {suppliers[po.supplierId]?.name || 'Unknown supplier'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {itemCount} item{itemCount === 1 ? '' : 's'} · ₹{totalCost.toFixed(0)}
                      </p>
                    </div>
                    <StatusBadge kind="po" value={po.status} />
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
