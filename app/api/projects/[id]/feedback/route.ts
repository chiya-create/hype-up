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

  const { data: project } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle()

  if (
    !isPlatformAdmin(ctx.role) &&
    project?.organization_id !== null &&
    project?.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  const { data: analysis } = await supabase
    .from('project_analyses')
    .select('id')
    .eq('project_id', id)
    .maybeSingle()

  if (!analysis) return NextResponse.json(null)

  const { data } = await supabase
    .from('analysis_feedback')
    .select('*')
    .eq('target_type', 'project_analysis')
    .eq('target_id', analysis.id)
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

  // project の organization_id を取得
  const [{ data: project }, { data: analysis }] = await Promise.all([
    supabase.from('projects').select('organization_id').eq('id', id).maybeSingle(),
    supabase.from('project_analyses').select('id').eq('project_id', id).maybeSingle(),
  ])

  if (
    !isPlatformAdmin(ctx.role) &&
    project?.organization_id !== null &&
    project?.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  if (!analysis) {
    return NextResponse.json({ error: 'analysis not found' }, { status: 404 })
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
        target_type: 'project_analysis' as const,
        target_id: analysis.id,
        summary_quality: body.summary_quality ?? null,
        insight_quality: body.insight_quality ?? null,
        copy_quality: body.copy_quality ?? null,
        action_quality: body.action_quality ?? null,
        pptx_quality: body.pptx_quality ?? null,
        overall_score: body.overall_score ?? null,
        notes: body.notes ?? null,
        organization_id: project?.organization_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'target_type,target_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logUsageEvent({
    organizationId: data?.organization_id ?? null,
    projectId: id,
    eventType: 'feedback_submitted',
    metadata: {
      target_type: 'project_analysis',
      target_id: analysis.id,
      overall_score: body.overall_score ?? null,
    },
  })

  return NextResponse.json(data)
}
