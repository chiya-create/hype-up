// Vercel 関数タイムアウト設定（Pro プラン以上必須）
// Claude API を 1 回呼び出す。通常 30〜60 秒。余裕をもって 120 秒に設定
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { compareProjectsWithClaude } from '@/lib/claude/client'
import type { Json } from '@/types/database'
import { logUsageEvent } from '@/lib/usage/log'
import { getCurrentUserAccessContext, canCreateComparison } from '@/lib/auth/permissions'
import type {
  ComparisonProject,
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
} from '@/types/analysis'

export async function POST(req: NextRequest) {
  // ── 1. リクエスト検証 ──────────────────────────────────────────────────
  let body: { projectIds?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト本文が不正です' }, { status: 400 })
  }

  const projectIds = body.projectIds
  if (!Array.isArray(projectIds) || projectIds.length < 2 || projectIds.length > 3) {
    return NextResponse.json(
      { error: 'projectIds は2〜3件の配列で指定してください' },
      { status: 400 }
    )
  }

  const ids = projectIds as string[]

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません' },
      { status: 500 }
    )
  }

  // ── 認証・組織コンテキスト取得 ────────────────────────────────────────
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  if (!canCreateComparison(ctx.role)) {
    return NextResponse.json({ error: '競合比較の作成権限がありません' }, { status: 403 })
  }
  const activeOrgId = ctx.activeOrganizationId

  const supabase = createServiceClient()

  // ── 2. プロジェクト取得 ────────────────────────────────────────────────
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name, industry, review_count, organization_id')
    .in('id', ids)

  if (projectsError || !projects || projects.length !== ids.length) {
    return NextResponse.json(
      { error: '一部のプロジェクトが見つかりません' },
      { status: 404 }
    )
  }

  // ── 組織帰属チェック: organization_id が設定済みのプロジェクトは activeOrg と一致すること
  if (activeOrgId !== null) {
    const outsider = projects.find(
      (p) => p.organization_id !== null && p.organization_id !== activeOrgId
    )
    if (outsider) {
      return NextResponse.json(
        { error: `「${outsider.name}」は所属組織のプロジェクトではありません` },
        { status: 403 }
      )
    }
  }

  // ── 3. 分析結果取得 ────────────────────────────────────────────────────
  const { data: analyses, error: analysesError } = await supabase
    .from('project_analyses')
    .select('project_id, rating_points, complaints, purchase_reasons, customer_types, appeal_words')
    .in('project_id', ids)

  if (analysesError) {
    return NextResponse.json(
      { error: '分析結果の取得に失敗しました' },
      { status: 500 }
    )
  }

  const analysisMap = new Map(analyses?.map((a) => [a.project_id, a]) ?? [])

  for (const id of ids) {
    if (!analysisMap.has(id)) {
      const proj = projects.find((p) => p.id === id)
      return NextResponse.json(
        { error: `「${proj?.name ?? id}」の分析結果がありません。先に分析を実行してください。` },
        { status: 400 }
      )
    }
  }

  // ── 4. ComparisonProject 配列構築 ──────────────────────────────────────
  const comparisonProjects: ComparisonProject[] = ids.map((id) => {
    const proj = projects.find((p) => p.id === id)!
    const analysis = analysisMap.get(id)!
    return {
      id: proj.id,
      name: proj.name,
      industry: proj.industry ?? 'general',
      review_count: proj.review_count,
      rating_points: (analysis.rating_points ?? []) as unknown as RatingPoint[],
      complaints: (analysis.complaints ?? []) as unknown as Complaint[],
      purchase_reasons: (analysis.purchase_reasons ?? []) as unknown as PurchaseReason[],
      customer_types: (analysis.customer_types ?? []) as unknown as CustomerType[],
      appeal_words: (analysis.appeal_words ?? []) as unknown as AppealWord[],
    }
  })

  // ── 5. Claude 比較分析 ─────────────────────────────────────────────────
  let output: Awaited<ReturnType<typeof compareProjectsWithClaude>>
  try {
    output = await compareProjectsWithClaude(comparisonProjects)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `比較分析に失敗しました: ${message}` },
      { status: 500 }
    )
  }

  // ── 6. comparison_reports 保存（organization_id を設定）─────────────────
  const industries = [...new Set(comparisonProjects.map((p) => p.industry))]
  const title = comparisonProjects.map((p) => p.name).join(' vs ')

  const { data: saved, error: saveError } = await supabase
    .from('comparison_reports')
    .insert({
      project_ids: ids,
      industry: industries.length === 1 ? industries[0] : industries.join(', '),
      title,
      comparison_summary: output.result.comparison_summary,
      winning_appeals: output.result.winning_appeals as unknown as Json,
      strengths: output.result.strengths as unknown as Json,
      weaknesses: output.result.weaknesses as unknown as Json,
      shared_complaints: output.result.shared_complaints as unknown as Json,
      recommended_actions: output.result.recommended_actions as unknown as Json,
      raw_response: { text: output.raw_text } as unknown as Json,
      token_used: output.tokens_used,
      organization_id: activeOrgId ?? null,
    })
    .select('id')
    .single()

  if (saveError || !saved) {
    return NextResponse.json(
      { error: '比較結果の保存に失敗しました', detail: saveError?.message },
      { status: 500 }
    )
  }

  await logUsageEvent({
    organizationId: activeOrgId ?? null,
    eventType: 'comparison_created',
    tokenUsed: output.tokens_used,
    metadata: {
      project_ids: ids,
      project_names: comparisonProjects.map((p) => p.name),
      industry: industries.length === 1 ? industries[0] : industries.join(', '),
      token_used: output.tokens_used,
    },
  })

  return NextResponse.json({
    comparison_report_id: saved.id,
    tokens_used: output.tokens_used,
  })
}
