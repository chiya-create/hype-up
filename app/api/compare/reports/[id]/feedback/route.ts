import { NextRequest, NextResponse } from 'next/server'
import { createServerUserClient } from '@/lib/supabase/server'
import { logUsageEvent } from '@/lib/usage/log'
import { getCurrentUserAccessContext, isPlatformAdmin } from '@/lib/auth/permissions'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServerUserClient()

  const { data: report } = await supabase
    .from('comparison_reports')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle()

  if (
    !isPlatformAdmin(ctx.role) &&
    report?.organization_id !== null &&
    report?.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const { data } = await supabase
    .from('analysis_feedback')
    .select('*')
    .eq('target_type', 'comparison_report')
    .eq('target_id', id)
    .maybeSingle()

  return NextResponse.json(data ?? null)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServerUserClient()

  const { data: report } = await supabase
    .from('comparison_reports')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle()

  if (
    !isPlatformAdmin(ctx.role) &&
    report?.organization_id !== null &&
    report?.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const body = await req.json() as {
    summary_quality?: number | null
    insight_quality?: number | null
    copy_quality?: number | null
    action_quality?: number | null
    pptx_quality?: number | null
    overall_score?: number | null
    notes?: string | null
  }

  const { data, error } = await supabase
    .from('analysis_feedback')
    .upsert(
      {
        target_type: 'comparison_report' as const,
        target_id: id,
        summary_quality: body.summary_quality ?? null,
        insight_quality: body.insight_quality ?? null,
        copy_quality: body.copy_quality ?? null,
        action_quality: body.action_quality ?? null,
        pptx_quality: body.pptx_quality ?? null,
        overall_score: body.overall_score ?? null,
        notes: body.notes ?? null,
        organization_id: report?.organization_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'target_type,target_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logUsageEvent({
    organizationId: data?.organization_id ?? null,
    eventType: 'feedback_submitted',
    metadata: {
      target_type: 'comparison_report',
      target_id: id,
      overall_score: body.overall_score ?? null,
    },
  })

  return NextResponse.json(data)
}
