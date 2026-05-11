/**
 * GET /api/projects/[id]/benchmark
 *
 * 業界ベンチマーク取得 API。
 * aggregated_insights は RLS で platform_admin のみ SELECT 可のため、
 * このエンドポイントが service role 経由で取得し、必要なデータのみ返す。
 *
 * 認証: requireClientAccess() 相当（getCurrentUserAccessContext() + 手動チェック）
 * 権限: client_owner / client_member / platform_admin（自組織プロジェクトのみ）
 */

import { NextResponse } from 'next/server'
import { createServerUserClient } from '@/lib/supabase/server'
import { getCurrentUserAccessContext, isPlatformAdmin } from '@/lib/auth/permissions'
import { getProjectBenchmark } from '@/lib/insights/get-project-benchmark'
import type { ProjectAnalysis } from '@/types/analysis'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServerUserClient()

  // プロジェクト取得
  const { data: project } = await supabase
    .from('projects')
    .select('id, industry, organization_id')
    .eq('id', id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // org チェック（platform_admin は全組織許可）
  if (
    !isPlatformAdmin(ctx.role) &&
    project.organization_id !== null &&
    project.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
  }

  // 分析結果取得
  const { data: analysisRow } = await supabase
    .from('project_analyses')
    .select('*')
    .eq('project_id', id)
    .maybeSingle()

  if (!analysisRow) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const analysis = analysisRow as unknown as ProjectAnalysis

  // aggregated_insights を service role 経由で取得してベンチマーク計算
  const benchmark = await getProjectBenchmark(project.industry ?? 'general', analysis)

  return NextResponse.json(benchmark)
}
