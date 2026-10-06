import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check your .env file')
}

// The anon key is meant to be public (it ships in the client bundle); actual
// access control happens via Postgres Row Level Security, which only allows
// reads/writes from a signed-in session (see AuthContext).
export const supabase = createClient(url, anonKey)
