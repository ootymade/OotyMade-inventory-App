import { useCallback, useEffect, useState } from 'react'
import { listCouriers, saveCourier, deleteCourier } from '../../db/storage.js'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { PageHeader, Card, Button, Input, Field, Spinner, EmptyState } from '../../components/ui.jsx'
import { TrashIcon } from '../../components/icons.jsx'

const BLANK = { name: '', trackingUrlTemplate: '', isDeepLink: false, useUniversalTracker: false, sortOrder: 0 }

export default function CourierSettings() {
  const { member } = useTeamMember()
  const { push } = useToast()
  const [couriers, setCouriers] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    listCouriers().then(setCouriers)
  }, [])

  useEffect(() => {
    if (member?.isAdmin) load()
  }, [load, member?.isAdmin])

  if (!member?.isAdmin) {
    return (
      <div>
        <PageHeader title="Couriers" back />
        <EmptyState title="Admins only" subtitle="Ask an admin to manage the courier list" />
      </div>
    )
  }

  const edit = (courier) =>
    setForm(
      courier
        ? {
            id: courier.id,
            name: courier.name,
            trackingUrlTemplate: courier.trackingUrlTemplate,
            isDeepLink: courier.isDeepLink,
            useUniversalTracker: courier.useUniversalTracker,
            sortOrder: courier.sortOrder,
          }
        : BLANK,
    )

  const save = async () => {
    if (!form.name.trim()) {
      push('Enter a courier name', { tone: 'error' })
      return
    }
    setSaving(true)
    try {
      await saveCourier(form)
      setForm(BLANK)
      push('Courier saved', { tone: 'success' })
      load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Remove this courier from the list?')) return
    try {
      await deleteCourier(id)
      push('Courier removed')
      load()
    } catch (err) {
      push(err.message, { tone: 'error' })
    }
  }

  return (
    <div className="space-y-4 px-4 pb-8 pt-4">
      <PageHeader title="Couriers" back />

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">{form.id ? 'Edit courier' : 'Add courier'}</p>
        <Field label="Name">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Delhivery" />
        </Field>
        <Field
          label="Tracking URL"
          hint={
            form.isDeepLink
              ? 'Must contain the literal placeholder {tracking_number}'
              : 'General tracking page — no verified way to embed the number directly'
          }
        >
          <Input
            value={form.trackingUrlTemplate}
            onChange={(e) => setForm((f) => ({ ...f, trackingUrlTemplate: e.target.value }))}
            placeholder="https://…"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.isDeepLink}
            onChange={(e) => setForm((f) => ({ ...f, isDeepLink: e.target.checked }))}
          />
          URL embeds the tracking number (deep link)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.useUniversalTracker}
            onChange={(e) => setForm((f) => ({ ...f, useUniversalTracker: e.target.checked }))}
          />
          Use universal tracker (17TRACK) as a fallback for this courier
        </label>
        <Field label="Sort order">
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
        </Field>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : form.id ? 'Save changes' : 'Add courier'}
          </Button>
          {form.id && (
            <Button size="sm" variant="ghost" onClick={() => setForm(BLANK)}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-500">Current list</p>
        {couriers === null ? (
          <Spinner className="h-5 w-5 text-brand-600" />
        ) : (
          <Card className="divide-y divide-slate-100 !p-0">
            {couriers.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <button className="min-w-0 flex-1 text-left" onClick={() => edit(c)}>
                  <p className="truncate font-medium text-slate-700">{c.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {c.isDeepLink ? 'Deep link' : 'General page only'} · {c.trackingUrlTemplate || 'no URL set'}
                    {c.useUniversalTracker ? ' · 17TRACK fallback on' : ''}
                  </p>
                </button>
                <button onClick={() => remove(c.id)} aria-label={`Remove ${c.name}`}>
                  <TrashIcon className="h-4 w-4 text-danger-600" />
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
