import { useCallback, useEffect, useState } from 'react'
import { listOrderNotes, addOrderNote, hideOrderNote, unhideOrderNote } from '../db/storage.js'
import { useRealtimeRefresh } from '../db/useRealtimeRefresh.js'
import { useTeamMember } from '../context/TeamMemberContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Card, Textarea, Input, Button, Badge, Spinner } from './ui.jsx'

const REALTIME_TABLES = ['order_notes']

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// One note thread per order — shared by both Shopify orders and direct
// orders (pass exactly one of shopifyOrderId/invoiceId). Permanent log:
// no edit for anyone; admins can hide a note (audit trail kept) via
// hideOrderNote/unhideOrderNote.
export default function OrderNotes({ shopifyOrderId, invoiceId }) {
  const { member } = useTeamMember()
  const { push } = useToast()
  const [notes, setNotes] = useState(null)
  const [available, setAvailable] = useState(true)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [hidingId, setHidingId] = useState(null)
  const [hideReason, setHideReason] = useState('')

  // If the Stage A tables haven't been created yet, hide this card
  // entirely rather than show a stuck spinner or a technical error.
  const load = useCallback(async () => {
    try {
      setNotes(await listOrderNotes({ shopifyOrderId, invoiceId }))
      setAvailable(true)
    } catch {
      setNotes([])
      setAvailable(false)
    }
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

  const startHide = (note) => {
    setHidingId(note.id)
    setHideReason('')
  }

  const confirmHide = async () => {
    if (!hideReason.trim()) {
      push('A reason is required to hide a note', { tone: 'error' })
      return
    }
    try {
      await hideOrderNote(hidingId, hideReason)
      setHidingId(null)
      load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    }
  }

  const unhide = async (note) => {
    try {
      await unhideOrderNote(note.id)
      load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    }
  }

  if (!available) return null

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
            <div key={n.id} className={`rounded-lg p-2 text-sm ${n.hiddenAt ? 'bg-slate-100 ring-1 ring-slate-200' : 'bg-slate-50'}`}>
              {n.hiddenAt && (
                <Badge tone="slate" className="mb-1">
                  Hidden{n.hiddenReason ? `: ${n.hiddenReason}` : ''}
                </Badge>
              )}
              <p className="whitespace-pre-wrap text-slate-700">{n.body}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDate(n.createdAt)}</p>
              {member?.isAdmin && (
                <>
                  {hidingId === n.id ? (
                    <div className="mt-2 space-y-2">
                      <Input value={hideReason} onChange={(e) => setHideReason(e.target.value)} placeholder="Reason for hiding..." />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={confirmHide}>
                          Confirm hide
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setHidingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : n.hiddenAt ? (
                    <button className="mt-1 text-xs font-semibold text-slate-500" onClick={() => unhide(n)}>
                      Unhide
                    </button>
                  ) : (
                    <button className="mt-1 text-xs font-semibold text-danger-600" onClick={() => startHide(n)}>
                      Hide
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">Don't paste customer phone numbers or addresses here.</p>
      <div className="flex gap-2">
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note..." className="flex-1" />
        <Button size="sm" onClick={add} disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : 'Add'}
        </Button>
      </div>
    </Card>
  )
}
