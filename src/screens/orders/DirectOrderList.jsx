import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listInvoices } from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { PageHeader, SearchBox, Card, StatusBadge, Button, EmptyState, Skeleton } from '../../components/ui.jsx'
import { PlusIcon, ClipboardIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['invoices']

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// `embedded`: used when this list is shown as one tab of the Orders hub
// (/orders) instead of its own standalone route — skips the page header
// (the hub supplies one shared header above both tabs) but keeps the
// "New" action, just moved inline.
export default function DirectOrderList({ embedded = false }) {
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState(null)

  const load = () => listInvoices({ search }).then(setOrders)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useRealtimeRefresh(REALTIME_TABLES, load)

  return (
    <div>
      {embedded ? (
        <div className="flex justify-end px-4 pt-3">
          <Link to="/direct-orders/new">
            <Button size="sm" className="!px-3">
              <PlusIcon className="h-4 w-4" /> New
            </Button>
          </Link>
        </div>
      ) : (
        <PageHeader
          title="Direct orders"
          subtitle={orders ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : undefined}
          right={
            <Link to="/direct-orders/new">
              <Button size="sm" className="!px-3">
                <PlusIcon className="h-4 w-4" /> New
              </Button>
            </Link>
          }
        />
      )}

      <div className="px-4 pt-3">
        <SearchBox
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer, phone, invoice #"
        />
      </div>

      <div className="px-4 pt-3 pb-4">
        {orders === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardIcon className="h-10 w-10" />}
            title="No direct orders yet"
            subtitle="Create a proforma for a WhatsApp or phone order"
            action={
              <Link to="/direct-orders/new">
                <Button>New order</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <Link key={o.id} to={`/direct-orders/${o.id}`}>
                <Card className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {o.customerName}
                      {o.kind === 'gst' && <span className="text-slate-400"> · INV-{o.invoiceNumber}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(o.createdAt)} · ₹{o.total.toFixed(2)}
                    </p>
                  </div>
                  <StatusBadge kind="direct" value={o.status} />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
