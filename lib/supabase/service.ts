import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Service-role client for API routes — bypasses RLS, never use on the client */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
