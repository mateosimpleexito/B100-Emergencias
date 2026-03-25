import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase env vars missing — running in offline mode')
    return null
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseKey)
  }
  return _client
}

// Stub that returns no-op for all chained methods when env vars are missing
const NOOP_CHAIN = new Proxy({} as any, {
  get() {
    return (..._args: any[]) => NOOP_CHAIN
  },
  apply() {
    return Promise.resolve({ data: null, error: null })
  },
})

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getClient()
    if (!client) return (..._args: any[]) => NOOP_CHAIN
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
