import { useCallback, useEffect, useState } from 'react'
import { listNotices, createNotice, setNoticePinned, markNoticeSeen, listNoticeSeenBy } from '../../db/storage.js'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Button, Textarea, Spinner, EmptyState, Badge } from '../../components/ui.jsx'
import { PinIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['team_notices', 'team_notice_seen']

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function SeenBy({ noticeId, open }) {
  const [seenBy, setSeenBy] = useState(null)

  useEffect(() => {
    if (open) listNoticeSeenBy(noticeId).then(setSeenBy).catch(() => setSeenBy([]))
  }, [open, noticeId])

  if (!open) return null
  if (seenBy === null) return <Spinner className="mt-2 h-4 w-4 text-brand-600" />
  if (seenBy.length === 0) return <p className="mt-2 text-xs text-slate-400">No one has seen this yet</p>
  return (
    <p className="mt-2 text-xs text-slate-400">
      Seen by {seenBy.map((s) => s.name).join(', ')}
    </p>
  )
}

export default function TeamNoticeBoard() {
  const { member } = useTeamMember()
  const { push } = useToast()
  const [notices, setNotices] = useState(null)
  const [available, setAvailable] = useState(true)
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [expanded, setExpanded] = useState(null)

  // If the Stage A tables haven't been created yet, fail quietly — an
  // empty board, not a stuck spinner or a technical error on screen.
  const load = useCallback(async () => {
    try {
      const list = await listNotices()
      setNotices(list)
      setAvailable(true)
      if (member?.id) {
        for (const n of list) {
          markNoticeSeen(n.id, member.id).catch(() => {})
        }
      }
    } catch {
      setNotices([])
      setAvailable(false)
    }
  }, [member?.id])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  const post = async () => {
    if (!body.trim()) {
      push('Write something to post', { tone: 'error' })
      return
    }
    setPosting(true)
    try {
      await createNotice(body, member)
      setBody('')
      push('Posted', { tone: 'success' })
      load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setPosting(false)
    }
  }

  const togglePin = async (notice) => {
    try {
      await setNoticePinned(notice.id, !notice.pinned, member)
      load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    }
  }

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <PageHeader title="Team Board" back />

      {member?.isAdmin && available && (
        <Card className="space-y-2">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Post an announcement..." />
          <p className="text-xs text-slate-400">Don't paste customer phone numbers or addresses here.</p>
          <Button size="sm" onClick={post} disabled={posting}>
            {posting ? <Spinner className="h-4 w-4" /> : 'Post'}
          </Button>
        </Card>
      )}

      {notices === null ? (
        <Spinner className="h-5 w-5 text-brand-600" />
      ) : notices.length === 0 ? (
        <EmptyState title="No announcements yet" subtitle="Nothing posted so far" />
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card key={n.id} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm text-slate-800">{n.body}</p>
                {n.pinned && (
                  <Badge tone="brand">
                    <PinIcon className="h-3 w-3" />
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">{formatDate(n.createdAt)}</p>
              <div className="flex items-center gap-3 pt-1">
                {member?.isAdmin && (
                  <button className="text-xs font-semibold text-brand-600" onClick={() => togglePin(n)}>
                    {n.pinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
                <button
                  className="text-xs font-semibold text-slate-400"
                  onClick={() => setExpanded(expanded === n.id ? null : n.id)}
                >
                  {expanded === n.id ? 'Hide seen by' : 'Seen by'}
                </button>
              </div>
              <SeenBy noticeId={n.id} open={expanded === n.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
