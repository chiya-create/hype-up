// Vercel 関数タイムアウト設定（Pro プラン以上必須）
// 1,000 件 ÷ 50件/チャンク = 最大 20 チャンク × ~10秒 ≒ 200 秒
// 余裕をもって 300 秒に設定
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  analyzeChunkWithClaude,
  synthesizeProjectAnalysisWithClaude,
  buildFallbackSynthesisResult,
  type AggregatedAxes,
} from '@/lib/claude/client'
import type {
  ChunkAnalysisResult,
  ReviewForAnalysis,
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
} from '@/types/analysis'
import type { Json } from '@/types/database'
import { logUsageEvent } from '@/lib/usage/log'
import { aggregateProjectInsights } from '@/lib/insights/aggregate'
import { getCurrentUserAccessContext, canAnalyze, isPlatformAdmin } from '@/lib/auth/permissions'
import { CHUNK_SIZE } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Aggregation helper
// ---------------------------------------------------------------------------

function groupByLabel<T extends { label: string; count: number }>(items: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of items) {
    const existing = map.get(item.label)
    if (existing) {
      map.set(item.label, { ...existing, count: existing.count + item.count })
    } else {
      map.set(item.label, { ...item })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function aggregateChunks(chunks: ChunkAnalysisResult[]): AggregatedAxes {
  return {
    rating_points: groupByLabel<RatingPoint>(
      chunks.flatMap((c) => c.rating_points ?? [])
    ),
    complaints: groupByLabel<Complaint>(
      chunks.flatMap((c) => c.complaints ?? [])
    ),
    purchase_reasons: groupByLabel<PurchaseReason>(
      chunks.flatMap((c) => c.purchase_reasons ?? [])
    ),
    customer_types: groupByLabel<CustomerType>(
      chunks.flatMap((c) => c.customer_types ?? [])
    ),
    appeal_words: Array.from(
      chunks
        .flatMap((c) => c.appeal_words ?? [])
        .reduce((map, w) => {
          const ex = map.get(w.word)
          if (ex) {
            map.set(w.word, {
              ...ex,
              frequency: ex.frequency + w.frequency,
              score: Math.max(ex.score, w.score),
            })
          } else {
            map.set(w.word, { ...w })
          }
          return map
        }, new Map<string, AppealWord>())
        .values()
    ).sort((a, b) => b.score - a.score),
  }
}

// ---------------------------------------------------------------------------
// POST /api/analyze
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // ── 1. リクエスト検証 ──────────────────────────────────────────────────
  let body: { projectId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト本文が不正です' }, { status: 400 })
  }

  const projectId = body.projectId?.trim()
  if (!projectId) {
    return NextResponse.json({ error: 'projectId は必須です' }, { status: 400 })
  }

  // 認証・ロールチェック
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  if (!canAnalyze(ctx.role)) {
    return NextResponse.json({ error: '分析実行の権限がありません' }, { status: 403 })
  }

  // API key チェック（早期エラー）
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY が設定されていません' },
      { status: 500 }
    )
  }

  const supabase = createServiceClient()

  // ── 2. プロジェクト取得 ────────────────────────────────────────────────
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
  }

  // org アクセスチェック（platform_admin は全 org 許可）
  if (
    !isPlatformAdmin(ctx.role) &&
    project.organization_id !== null &&
    project.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'このプロジェクトへのアクセス権限がありません' }, { status: 403 })
  }

  // ── 3. レビュー存在チェック ────────────────────────────────────────────
  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if (!reviewCount || reviewCount === 0) {
    return NextResponse.json(
      { error: 'このプロジェクトにはレビューがありません' },
      { status: 400 }
    )
  }

  // ── 4. project.status → analyzing ─────────────────────────────────────
  await supabase
    .from('projects')
    .update({
      status: 'analyzing',
      analysis_started_at: new Date().toISOString(),
      analysis_completed_at: null,
      error_message: null,
    })
    .eq('id', projectId)

  await logUsageEvent({
    organizationId: project.organization_id,
    projectId,
    eventType: 'analysis_started',
  })

  // ── 5. 全チャンクをリセット（再分析対応）─────────────────────────────
  // 既存チャンクの有無を確認
  const { count: existingChunkCount } = await supabase
    .from('analysis_chunks')
    .select('id', { count: 'exact' })
    .eq('project_id', projectId)

  if (existingChunkCount && existingChunkCount > 0) {
    // チャンクが存在する場合 → 全件を pending にリセット
    await supabase
      .from('analysis_chunks')
      .update({
        status: 'pending',
        rating_points: null,
        complaints: null,
        purchase_reasons: null,
        customer_types: null,
        appeal_words: null,
        summary: null,
        token_used: null,
        raw_response: null,
        error_message: null,
      })
      .eq('project_id', projectId)
  } else {
    // チャンクが存在しない場合 → reviews から再生成
    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    const reviewIds = (reviewRows ?? []).map((r) => r.id)
    if (reviewIds.length === 0) {
      await supabase
        .from('projects')
        .update({ status: 'error', error_message: 'レビューが見つかりません' })
        .eq('id', projectId)
      return NextResponse.json(
        { error: 'このプロジェクトにはレビューがありません' },
        { status: 400 }
      )
    }

    const chunkInserts: Array<{
      project_id: string
      chunk_index: number
      review_ids: string[]
      status: 'pending'
    }> = []
    for (let i = 0; i < reviewIds.length; i += CHUNK_SIZE) {
      chunkInserts.push({
        project_id: projectId,
        chunk_index: chunkInserts.length,
        review_ids: reviewIds.slice(i, i + CHUNK_SIZE),
        status: 'pending',
      })
    }

    const { error: insertError } = await supabase
      .from('analysis_chunks')
      .insert(chunkInserts)

    if (insertError) {
      await supabase
        .from('projects')
        .update({ status: 'error', error_message: 'チャンク再生成に失敗しました' })
        .eq('id', projectId)
      return NextResponse.json(
        { error: 'チャンク再生成に失敗しました', detail: insertError.message },
        { status: 500 }
      )
    }
  }

  // ── 5-b. pending チャンク取得（chunk_index 昇順）──────────────────────
  const { data: chunks } = await supabase
    .from('analysis_chunks')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('chunk_index', { ascending: true })

  if (!chunks || chunks.length === 0) {
    await supabase
      .from('projects')
      .update({ status: 'error', error_message: '処理対象のチャンクがありません（チャンク生成に失敗した可能性があります）' })
      .eq('id', projectId)
    return NextResponse.json(
      { error: '処理対象のチャンクがありません（チャンク生成に失敗した可能性があります）' },
      { status: 400 }
    )
  }

  // ── 6. チャンク順次処理 ────────────────────────────────────────────────
  let processedChunks = 0
  let failedChunks = 0
  let totalTokens = 0

  for (const chunk of chunks) {
    // 6-a. レビュー取得（rating・source も含めて渡す）
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, body, rating, source, reviewer, reviewed_at')
      .in('id', chunk.review_ids as string[])

    if (!reviews || reviews.length === 0) {
      await supabase
        .from('analysis_chunks')
        .update({
          status: 'error',
          error_message: 'このチャンクに対応するレビューが見つかりません',
        })
        .eq('id', chunk.id)
      failedChunks++
      continue
    }

    // 6-b. status → processing
    await supabase
      .from('analysis_chunks')
      .update({ status: 'processing' })
      .eq('id', chunk.id)

    // 6-c. Claude API 呼び出し
    try {
      const reviewsForAnalysis: ReviewForAnalysis[] = reviews.map((r) => ({
        id: r.id,
        body: r.body,
        rating: r.rating ?? null,
        source: r.source ?? null,
        reviewer: r.reviewer ?? null,
        reviewed_at: r.reviewed_at ?? null,
      }))
      const output = await analyzeChunkWithClaude(reviewsForAnalysis, project.industry ?? 'general')

      totalTokens += output.tokens_used

      // 6-d. 結果保存
      await supabase
        .from('analysis_chunks')
        .update({
          status: 'done',
          rating_points: output.result.rating_points as unknown as Json,
          complaints: output.result.complaints as unknown as Json,
          purchase_reasons: output.result.purchase_reasons as unknown as Json,
          customer_types: output.result.customer_types as unknown as Json,
          appeal_words: output.result.appeal_words as unknown as Json,
          summary: output.result.summary,
          raw_response: { text: output.raw_text } as unknown as Json,
          token_used: output.tokens_used,
          error_message: null,
        })
        .eq('id', chunk.id)

      processedChunks++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failedChunks++

      await supabase
        .from('analysis_chunks')
        .update({
          status: 'error',
          error_message: message,
          raw_response: null,
        })
        .eq('id', chunk.id)
    }
  }

  // ── 7. done チャンク集約 ───────────────────────────────────────────────
  const { data: doneChunks } = await supabase
    .from('analysis_chunks')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'done')
    .order('chunk_index', { ascending: true })

  if (!doneChunks || doneChunks.length === 0) {
    await supabase
      .from('projects')
      .update({
        status: 'error',
        error_message: '全チャンクの分析に失敗しました',
        analysis_completed_at: new Date().toISOString(),
      })
      .eq('id', projectId)

    return NextResponse.json({
      project_id: projectId,
      status: 'error',
      processed_chunks: 0,
      failed_chunks: failedChunks,
      total_tokens_used: totalTokens,
    })
  }

  // done チャンクの結果を ChunkAnalysisResult として取り出す
  const chunkResults: ChunkAnalysisResult[] = doneChunks.map((c) => ({
    rating_points: (c.rating_points as unknown as RatingPoint[]) ?? [],
    complaints: (c.complaints as unknown as Complaint[]) ?? [],
    purchase_reasons: (c.purchase_reasons as unknown as PurchaseReason[]) ?? [],
    customer_types: (c.customer_types as unknown as CustomerType[]) ?? [],
    appeal_words: (c.appeal_words as unknown as AppealWord[]) ?? [],
    summary: c.summary ?? '',
  }))

  const chunkSummaries = chunkResults.map((c) => c.summary).filter(Boolean)
  const aggregated = aggregateChunks(chunkResults)

  // ── 8. 統合分析（Claude Synthesis）────────────────────────────────────
  let synthesisRawText: string | null = null
  let synthesisTokens = 0

  let synthResult: {
    summary: string
    marketing_insights: unknown[]
    lp_suggestions: unknown[]
    ad_copy_suggestions: unknown[]
    content_ideas: unknown[]
    demand_points: unknown[]
    occasion_insights: unknown[]
    avoid_appeals: unknown[]
  } = {
    summary: '',
    marketing_insights: [],
    lp_suggestions: [],
    ad_copy_suggestions: [],
    content_ideas: [],
    demand_points: [],
    occasion_insights: [],
    avoid_appeals: [],
  }

  try {
    const synthesisOutput = await synthesizeProjectAnalysisWithClaude(
      project.name,
      project.description,
      chunkSummaries,
      aggregated,
      project.industry ?? 'general'
    )
    synthResult = synthesisOutput.result
    synthesisRawText = synthesisOutput.raw_text
    synthesisTokens = synthesisOutput.tokens_used
    totalTokens += synthesisTokens
  } catch (err) {
    // 統合分析が失敗しても fallback を使ってチャンク集計から最低限の結果を生成する
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('統合分析エラー（fallback で継続）:', errMsg)
    synthResult = buildFallbackSynthesisResult(aggregated)
    // summary に fallback 由来であることを記録（QualityCheckCard で視認できるようにするため）
    synthResult = {
      ...synthResult,
      summary: `【fallback生成】統合分析エラーのため自動生成されました。再分析を推奨します。\nエラー: ${errMsg.slice(0, 200)}\n\n${synthResult.summary}`,
    }
  }

  // ── 9. project_analyses upsert ────────────────────────────────────────
  const { error: upsertError } = await supabase
    .from('project_analyses')
    .upsert(
      {
        project_id: projectId,
        rating_points: aggregated.rating_points as unknown as Json,
        complaints: aggregated.complaints as unknown as Json,
        purchase_reasons: aggregated.purchase_reasons as unknown as Json,
        customer_types: aggregated.customer_types as unknown as Json,
        appeal_words: aggregated.appeal_words as unknown as Json,
        summary: synthResult.summary,
        marketing_insights: synthResult.marketing_insights as unknown as Json,
        lp_suggestions: synthResult.lp_suggestions as unknown as Json,
        ad_copy_suggestions: synthResult.ad_copy_suggestions as unknown as Json,
        content_ideas: synthResult.content_ideas as unknown as Json,
        demand_points: synthResult.demand_points as unknown as Json,
        occasion_insights: synthResult.occasion_insights as unknown as Json,
        avoid_appeals: synthResult.avoid_appeals as unknown as Json,
        chunk_count: doneChunks.length,
        total_tokens_used: totalTokens,
        raw_response: synthesisRawText
          ? ({ text: synthesisRawText } as unknown as Json)
          : null,
      },
      { onConflict: 'project_id' }
    )

  if (upsertError) {
    console.error('project_analyses upsert エラー:', upsertError)
  }

  // ── 9-b. 業界別インサイト集計（失敗しても分析処理は継続）────────────
  await aggregateProjectInsights({
    industry: project.industry ?? 'general',
    analysis: {
      id: '',
      project_id: projectId,
      rating_points: aggregated.rating_points,
      complaints: aggregated.complaints,
      purchase_reasons: aggregated.purchase_reasons,
      customer_types: aggregated.customer_types,
      appeal_words: aggregated.appeal_words,
      summary: synthResult.summary,
      marketing_insights: synthResult.marketing_insights as never,
      lp_suggestions: synthResult.lp_suggestions as never,
      ad_copy_suggestions: synthResult.ad_copy_suggestions as never,
      content_ideas: synthResult.content_ideas as never,
      demand_points: synthResult.demand_points as never,
      occasion_insights: synthResult.occasion_insights as never,
      avoid_appeals: synthResult.avoid_appeals as never,
      future_axes: null,
      total_tokens_used: totalTokens,
      chunk_count: doneChunks.length,
      raw_response: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  })

  // ── 10. project 最終ステータス更新 ────────────────────────────────────
  const hasPartialError = failedChunks > 0
  const finalStatus = hasPartialError ? 'done' : 'done' // partial でも done に（エラー数はレスポンスで返す）

  await supabase
    .from('projects')
    .update({
      status: finalStatus,
      analysis_completed_at: new Date().toISOString(),
      error_message: hasPartialError
        ? `${failedChunks} チャンクの分析に失敗しました（${processedChunks} チャンクは成功）`
        : null,
    })
    .eq('id', projectId)

  await logUsageEvent({
    organizationId: project.organization_id,
    projectId,
    eventType: 'analysis_completed',
    tokenUsed: totalTokens,
    metadata: {
      processed_chunks: processedChunks,
      failed_chunks: failedChunks,
      total_tokens_used: totalTokens,
      status: hasPartialError ? 'partial_error' : 'done',
    },
  })

  return NextResponse.json({
    project_id: projectId,
    status: hasPartialError ? 'partial_error' : 'done',
    processed_chunks: processedChunks,
    failed_chunks: failedChunks,
    total_tokens_used: totalTokens,
  })
}
