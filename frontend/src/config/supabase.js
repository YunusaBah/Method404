import { createClient } from '@supabase/supabase-js'

let supabase

export function getSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    const missing = [
      !url && 'VITE_SUPABASE_URL',
      !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
    ].filter(Boolean)
    throw new Error(`Supabase is not configured. Set ${missing.join(' and ')} in frontend/.env.`)
  }

  if (!supabase) {
    supabase = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return supabase
}
