import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTeamMember } from '../../context/TeamMemberContext.jsx'
import { supabase } from '../../db/supabaseClient.js'
import { PageHeader, Field, Input, Button } from '../../components/ui.jsx'
import { useToast } from '../../context/ToastContext.jsx'

export default function ChangePassword() {
  const { session } = useAuth()
  const { member } = useTeamMember()
  const { push } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (next !== confirm) {
      setError("New passwords don't match")
      return
    }
    setSaving(true)
    try {
      // Re-check the current password before allowing a change, so someone
      // with an already-unlocked phone can't change another person's
      // password without knowing it.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: current,
      })
      if (reauthError) {
        setError('Current password is incorrect')
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) throw updateError
      push('Password changed', { tone: 'success' })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Change password" back />
      <form onSubmit={submit} className="space-y-4 px-4 py-4">
        <p className="text-sm text-slate-500">Signed in as {member?.name}</p>

        <Field label="Current password">
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Field>

        <Field label="New password" hint="At least 8 characters">
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </Field>

        <Field label="Confirm new password" error={error}>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </div>
  )
}
