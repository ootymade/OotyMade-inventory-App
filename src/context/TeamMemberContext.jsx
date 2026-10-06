import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../db/supabaseClient.js'

const TeamMemberContext = createContext(null)

// member: undefined = looking up, null = signed in but no team_members row
// (shouldn't happen for the 6 seeded accounts), otherwise { name, role }.
export function TeamMemberProvider({ session, children }) {
  const [member, setMember] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    setMember(undefined)
    supabase
      .from('team_members')
      .select('name, role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMember(data || null)
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
