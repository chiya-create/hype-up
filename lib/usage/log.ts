import { createServiceClient } from '@/lib/supabase/service'
import { DEFAULT_ORGANIZATION_NAME } from '@/lib/constants'
import type { UsageEventType } from '@/lib/constants'
import type { Json } from '@/types/database'

interface LogUsageEventParams {
  organizationId?: string | null
  projectId?: string | null
  eventType: UsageEventType
  tokenUsed?: number | null
  metadata?: Record<string, unknown>
}

// Cached default org id to avoid repeated DB lookups within a process lifetime.
let _defaultOrgId: string | null = null

async function resolveOrgId(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId?: string | null
): Promise<string | null> {
  if (organizationId) return organizationId

  if (_defaultOrgId) return _defaultOrgId

  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', DEFAULT_ORGANIZATION_NAME)
    .single()

  if (data?.id) {
    _defaultOrgId = data.id
    return data.id
  }

  return null
}

/**
 * usage_logs にイベントを記録する。
 * 記録に失敗しても例外を投げない — 呼び出し元の処理を止めない。
 */
export async function logUsageEvent(params: LogUsageEventParams): Promise<void> {
  try {
    const supabase = createServiceClient()
    const orgId = await resolveOrgId(supabase, params.organizationId)

    if (!orgId) {
      console.warn('[usage] Could not resolve organization_id — skipping log')
      return
    }

    const { error } = await supabase.from('usage_logs').insert({
      organization_id: orgId,
      project_id: params.projectId ?? null,
      event_type: params.eventType,
      token_used: params.tokenUsed ?? null,
      metadata: (params.metadata ?? {}) as unknown as Json,
    })

    if (error) {
      console.warn('[usage] Insert failed:', error.message)
    }
  } catch (err) {
    console.warn('[usage] Unexpected error:', err)
  }
}
