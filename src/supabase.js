import { createClient } from '@supabase/supabase-js'
import { demoClient } from './demo'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const demo = import.meta.env.VITE_DEMO === '1'

export const configured = demo || Boolean(url && key)

// PKCE puts the sign-in code in the query string, leaving the #/ routes alone.
export const supabase = demo
  ? demoClient
  : configured ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null
