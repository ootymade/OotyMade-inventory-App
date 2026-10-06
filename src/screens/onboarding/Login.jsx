import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, Field, Input } from '../../components/ui.jsx'
import { BoxIcon } from '../../components/icons.jsx'

export const TEAM_ROSTER = [
  { name: 'Vijayakumar', role: 'Director', function: 'Overall business oversight', email: 'vijayakumar@ootymade-inventory.app' },
  { name: 'Moorthy', role: 'Sales Manager', function: 'Oversees and confirms overall inventory accuracy', email: 'moorthy@ootymade-inventory.app' },
  { name: 'Rajendran', role: 'Dispatch Manager', function: 'Daily purchase & sales entry', email: 'rajendran@ootymade-inventory.app' },
  { name: 'Jaheer', role: 'Staff', function: 'Daily purchase & sales entry', email: 'jaheer@ootymade-inventory.app' },
  { name: 'Priya Vijayakumar', role: 'Director', function: 'Monitors stock; daily purchase & sales', email: 'priya@ootymade-inventory.app' },
  { name: 'Sanjay', role: 'Director', function: 'Monitors stock; daily purchase & sales', email: 'sanjay@ootymade-inventory.app' },
]

export default function Login() {
  const { signIn } = useAuth()
  const [picked, setPicked] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(picked.email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!picked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-10">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <BoxIcon className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Ooty Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Who's using this phone?</p>
        </div>

        <div className="w-full max-w-sm space-y-2.5">
          {TEAM_ROSTER.map((person) => (
            <button
              key={person.name}
              onClick={() => setPicked(person)}
              className="tap flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 active:scale-[0.98]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
                {person.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{person.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {person.role} · {person.function}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <BoxIcon className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Hi, {picked.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your password to continue</p>
      </div>

      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <Field label="Password" error={error}>
          <Input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Checking…' : 'Unlock'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setPicked(null)
            setPassword('')
            setError('')
          }}
          className="w-full text-center text-xs text-slate-400"
        >
          Not {picked.name}?
        </button>
      </form>
      <p className="mt-6 max-w-sm text-center text-xs text-slate-400">
        You'll only need to do this once on this phone.
      </p>
    </div>
  )
}
