import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMovements, listProducts } from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { PageHeader, Card, EmptyState, Skeleton } from '../../components/ui.jsx'
import { BoxIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['movements']
const LIMIT = 100

const REASON_LABEL = { received: 'Received', sold: 'Sold', damaged: 'Damaged', adjustment: 'Adjusted' }

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Didn't exist before Stage 2b as its own screen — only a per-product
// history (inside Product detail) and a 5-row Home feed existed. Built
// from the same listMovements() read everything else already uses; no
// new database access.
export default function MovementHistory() {
  const [movements, setMovements] = useState(null)
  const [productNames, setProductNames] = useState({})

  const load = () => {
    listMovements({ limit: LIMIT }).then(setMovements)
    listProducts().then((items) => {
      const map = {}
      items.forEach((p) => (map[p.id] = p.name))
      setProductNames(map)
    })
  }

  useEffect(load, [])
  useRealtimeRefresh(REALTIME_TABLES, load)

  return (
    <div>
      <PageHeader title="Movement history" back subtitle={`Last ${LIMIT} stock movements`} />

      <div className="px-4 pt-3 pb-4">
        {movements === null ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <EmptyState icon={<BoxIcon className="h-10 w-10" />} title="No movements yet" subtitle="Stock in/out will show up here" />
        ) : (
          <Card className="divide-y divide-slate-100 !p-0">
            {movements.map((m) => (
              <Link key={m.id} to={`/products/${m.productId}`} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {productNames[m.productId] || 'Unknown product'}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {REASON_LABEL[m.reason] || m.reason} · {m.memberName || 'Unknown'} · {formatDate(m.timestamp)}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-bold ${m.quantity < 0 ? 'text-danger-600' : 'text-ok-600'}`}>
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
