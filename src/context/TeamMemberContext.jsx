import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../db/supabaseClient.js'

const TeamMemberContext = createContext(null)

// member: undefined = looking up, null = signed in but no team_members row
// (shouldn't happen for the 6 seeded accounts), otherwise { id, name, role,
// isAdmin }. `id` is the team_members row id (= auth.uid()), needed for
// writes where RLS checks the row's own created_by/team_member_id against
// the caller. `role` here is the descriptive title (e.g. "Director") used
// for movement/invoice attribution, same as before individual logins —
// it's sourced from team_members.title, NOT team_members.role, which is
// the separate admin/staff access level (team_members.role) used only for
// Shopify revenue masking server-side. isAdmin gates admin-only screens.
export function TeamMemberProvider({ session, children }) {
  const [member, setMember] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    setMember(undefined)
    supabase
      .from('team_members')
      .select('name, role, title')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setMember(data ? { id: session.user.id, name: data.name, role: data.title, isAdmin: data.role === 'admin' } : null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [session.user.id])

  const clearMember = () => supabase.auth.signOut()

  return <TeamMemberContext.Provider value={{ member, clearMember }}>{children}</TeamMemberContext.Provider>
}

export function useTeamMember() {
  const ctx = useContext(TeamMemberContext)
  if (!ctx) throw new Error('useTeamMember must be used within TeamMemberProvider')
  return ctx
}
