import { useCallback, useEffect, useState } from 'react'
import { listOrderNotes, addOrderNote } from '../db/storage.js'
import { useRealtimeRefresh } from '../db/useRealtimeRefresh.js'
import { useTeamMember } from '../context/TeamMemberContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Card, Textarea, Button, Spinner } from './ui.jsx'

const REALTIME_TABLES = ['order_notes']

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// One note thread per order — shared by both Shopify orders and direct
// orders (pass exactly one of shopifyOrderId/invoiceId). Permanent,
// append-only log: no edit, no delete, for anyone.
export default function OrderNotes({ shopifyOrderId, invoiceId }) {
  const { member } = useTeamMember()
  const { push } = useToast()
  const [notes, setNotes] = useState(null)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setNotes(await listOrderNotes({ shopifyOrderId, invoiceId }))
  }, [shopifyOrderId, invoiceId])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  const add = async () => {
    if (!body.trim()) return
    setSaving(true)
    try {
      await addOrderNote({ shopifyOrderId, invoiceId, body, member })
      setBody('')
      load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">Notes</p>
      {notes === null ? (
        <Spinner className="h-4 w-4 text-brand-600" />
      ) : notes.length === 0 ? (
        <p className="text-xs text-slate-400">No notes yet</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg bg-slate-50 p-2 text-sm">
              <p className="whitespace-pre-wrap text-slate-700">{n.body}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDate(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note..." className="flex-1" />
        <Button size="sm" onClick={add} disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : 'Add'}
        </Button>
      </div>
    </Card>
  )
}
