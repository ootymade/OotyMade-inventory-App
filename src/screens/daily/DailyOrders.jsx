import { useEffect, useMemo, useState } from 'react'
import {
  listDailyOrderCounts,
  upsertDailyOrderCount,
  getConfirmedDirectOrderCount,
} from '../../db/storage.js'
import { SALES_CHANNELS } from '../../db/businessInfo.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useRealtimeRefresh } from '../../db/useRealtimeRefresh.js'
import { PageHeader, Card, Input, Spinner, SegmentedControl } from '../../components/ui.jsx'

const HISTORY_OPTIONS = [
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]
import { ChevronRightIcon } from '../../components/icons.jsx'

const REALTIME_TABLES = ['daily_order_counts']

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoIso(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DailyOrders() {
  const { member } = useTeamMember()
  const { push } = useToast()
  const today = todayIso()

  const [todayCounts, setTodayCounts] = useState(null) // { channel: count }
  const [directSuggestion, setDirectSuggestion] = useState(0)
  const [, setSaving] = useState({})
  const [historyDays, setHistoryDays] = useState(30)
  const [history, setHistory] = useState(null)
  const [expandedDate, setExpandedDate] = useState(null)

  const loadToday = () => {
    listDailyOrderCounts({ dateFrom: today, dateTo: today }).then((rows) => {
      const map = {}
      rows.forEach((r) => (map[r.channel] = r.orderCount))
      setTodayCounts(map)
    })
    getConfirmedDirectOrderCount(today).then(setDirectSuggestion)
  }

  const loadHistory = () => {
    listDailyOrderCounts({ dateFrom: daysAgoIso(historyDays), dateTo: today }).then(setHistory)
  }

  useEffect(() => {
    loadToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyDays])

  useRealtimeRefresh(REALTIME_TABLES, () => {
    loadToday()
    loadHistory()
  })

  const saveCount = async (channel, value) => {
    setSaving((s) => ({ ...s, [channel]: true }))
    try {
      await upsertDailyOrderCount({ date: today, channel, orderCount: value, member })
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSaving((s) => ({ ...s, [channel]: false }))
    }
  }

  const todayTotal = todayCounts ? Object.values(todayCounts).reduce((s, n) => s + (Number(n) || 0), 0) : 0

  const byDate = useMemo(() => {
    if (!history) return []
    const map = {}
    history.forEach((r) => {
      if (!map[r.date]) map[r.date] = { date: r.date, total: 0, byChannel: {} }
      map[r.date].total += r.orderCount
      map[r.date].byChannel[r.channel] = r.orderCount
    })
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [history])

  const monthTotals = useMemo(() => {
    if (!history) return {}
    const monthPrefix = today.slice(0, 7)
    const totals = {}
    history
      .filter((r) => r.date.startsWith(monthPrefix))
      .forEach((r) => {
        totals[r.channel] = (totals[r.channel] || 0) + r.orderCount
      })
    return totals
  }, [history, today])

  if (!todayCounts) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    )
  }

  return (
    <div className="pb-8">
      <PageHeader title="Daily orders" subtitle={`Today: ${todayTotal} order${todayTotal === 1 ? '' : 's'} shipped`} back />

      <div className="space-y-4 px-4 pt-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-500">Today · {formatDate(today)}</p>
          <Card className="divide-y divide-slate-100 !p-0">
            {SALES_CHANNELS.map((channel) => (
              <div key={channel} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{channel}</p>
                  {channel === 'Direct' && directSuggestion > 0 && (todayCounts[channel] ?? 0) !== directSuggestion && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-600"
                      onClick={() => {
                        setTodayCounts((c) => ({ ...c, Direct: directSuggestion }))
                        saveCount('Direct', directSuggestion)
                      }}
                    >
                      {directSuggestion} confirmed today — use this
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={todayCounts[channel] ?? ''}
                  onChange={(e) => setTodayCounts((c) => ({ ...c, [channel]: e.target.value }))}
                  onBlur={(e) => saveCount(channel, e.target.value)}
                  className="!w-20 text-center"
                />
              </div>
            ))}
          </Card>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">History</p>
            <SegmentedControl options={HISTORY_OPTIONS} value={historyDays} onChange={setHistoryDays} className="w-auto" />
          </div>

          {!history ? (
            <Spinner className="h-5 w-5 text-brand-600" />
          ) : byDate.length === 0 ? (
            <p className="px-1 text-sm text-slate-400">No history yet</p>
          ) : (
            <Card className="divide-y divide-slate-100 !p-0">
              {byDate.slice(0, 30).map((d) => (
                <div key={d.date}>
                  <button
                    className="flex w-full items-center justify-between px-4 py-3"
                    onClick={() => setExpandedDate(expandedDate === d.date ? null : d.date)}
                  >
                    <span className="text-sm font-medium text-slate-700">{formatDate(d.date)}</span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
                      {d.total}
                      <ChevronRightIcon
                        className={`h-4 w-4 text-slate-300 transition-transform ${expandedDate === d.date ? 'rotate-90' : ''}`}
                      />
                    </span>
                  </button>
                  {expandedDate === d.date && (
                    <div className="space-y-1 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                      {SALES_CHANNELS.filter((c) => d.byChannel[c]).map((c) => (
                        <div key={c} className="flex justify-between">
                          <span>{c}</span>
                          <span className="font-medium text-slate-700">{d.byChannel[c]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-500">This month so far</p>
          <Card className="divide-y divide-slate-100 !p-0">
            {SALES_CHANNELS.map((channel) => (
              <div key={channel} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-600">{channel}</span>
                <span className="font-semibold text-slate-800">{monthTotals[channel] || 0}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
