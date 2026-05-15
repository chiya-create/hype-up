import { NextRequest, NextResponse } from 'next/server'
import { parseCsvText } from '@/lib/csv/parser'
import { generateBodyHash } from '@/lib/utils/hash'
import { createServiceClient } from '@/lib/supabase/service'
import { CHUNK_SIZE, INDUSTRY_IDS, MAX_REVIEWS_PER_PROJECT } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import { logUsageEvent } from '@/lib/usage/log'
import { getCurrentUserAccessContext } from '@/lib/auth/permissions'

// Step 87-D: review_sources 紐づけのために SupabaseClient の型を取得
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * アップロード失敗時のロールバックヘルパー。
 * review_sources は project.ON DELETE SET NULL のため project 削除では消えない。
 * reviewSourceId が確定している場合は明示的に削除する。
 */
async function rollback(
  supabase: SupabaseClient,
  projectId: string,
  reviewSourceId: string | null,
): Promise<void> {
  if (reviewSourceId) {
    await supabase.from('review_sources').delete().eq('id', reviewSourceId)
  }
  await supabase.from('projects').delete().eq('id', projectId)
}

export async function POST(req: NextRequest) {
  // 認証・組織・ロールチェック
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: 'ログインが必要です', requiresLogin: true },
      { status: 401 }
    )
  }
  if (!ctx.activeOrganizationId || ctx.role === null) {
    return NextResponse.json({ error: '組織に所属していません' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'リクエストの解析に失敗しました' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const projectName = (formData.get('projectName') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const rawIndustry = (formData.get('industry') as string | null)?.trim() ?? 'general'
  const industry: IndustryId = INDUSTRY_IDS.includes(rawIndustry as IndustryId)
    ? (rawIndustry as IndustryId)
    : 'general'

  if (!file) {
    return NextResponse.json({ error: 'CSVファイルが必要です' }, { status: 400 })
  }
  if (!projectName) {
    return NextResponse.json({ error: 'プロジェクト名は必須です' }, { status: 400 })
  }

  const text = await file.text()
  const { rows, skipped_empty_count, errors: parseErrors } = parseCsvText(text)

  // body 列なしはここで弾く
  if (parseErrors.some((e) => e.includes('body 列'))) {
    return NextResponse.json({ error: parseErrors[0], errors: parseErrors }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: '有効なレビューが1件もありません', skipped_empty_count, errors: parseErrors },
      { status: 400 }
    )
  }

  // MVP 件数上限チェック
  if (rows.length > MAX_REVIEWS_PER_PROJECT) {
    return NextResponse.json(
      {
        error: `現在の MVP では 1 プロジェクトあたり最大 ${MAX_REVIEWS_PER_PROJECT.toLocaleString()} 件まで対応しています。CSV を分割してアップロードしてください（現在: ${rows.length.toLocaleString()} 件）。大規模分析は今後の非同期ジョブ化で対応予定です。`,
        rows_count: rows.length,
        limit: MAX_REVIEWS_PER_PROJECT,
      },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // プロジェクト作成（organization_id を設定）
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: projectName,
      description,
      industry,
      status: 'pending',
      review_count: 0,
      organization_id: ctx.activeOrganizationId ?? null,
    })
    .select()
    .single()

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'プロジェクト作成に失敗しました', detail: projectError?.message },
      { status: 500 }
    )
  }

  // ── Step 87-D: review_sources レコードを作成 ──────────────────────────
  // CSVアップロードも 'csv_upload' ソースとして記録する。
  // 失敗した場合は project を削除してアップロード全体を失敗にする。
  const collectedAt = new Date().toISOString()

  const { data: reviewSource, error: sourceError } = await supabase
    .from('review_sources')
    .insert({
      organization_id: ctx.activeOrganizationId,
      project_id:      project.id,
      source_type:     'csv_upload',
      display_name:    `CSVアップロード（${projectName}）`,
      source_url:      null,
      source_id:       null,
      status:          'active',
      total_collected: 0,           // reviews INSERT 完了後に実件数で更新
      last_synced_at:  collectedAt,
    })
    .select('id')
    .single()

  if (sourceError || !reviewSource) {
    await supabase.from('projects').delete().eq('id', project.id)
    return NextResponse.json(
      { error: 'レビューソース登録に失敗しました', detail: sourceError?.message },
      { status: 500 }
    )
  }

  const reviewSourceId = reviewSource.id

  // CSV内の重複をメモリで排除
  const seen = new Set<string>()
  let skipped_duplicate_count = 0

  const dedupedRows = rows.reduce<Array<typeof rows[number] & { body_hash: string }>>(
    (acc, row) => {
      const hash = generateBodyHash(row.body)
      if (seen.has(hash)) {
        skipped_duplicate_count++
        return acc
      }
      seen.add(hash)
      acc.push({ ...row, body_hash: hash })
      return acc
    },
    []
  )

  // reviews を1000件ずつバッチ挿入
  const insertedIds: string[] = []

  for (let i = 0; i < dedupedRows.length; i += 1000) {
    const batch = dedupedRows.slice(i, i + 1000).map((row) => ({
      project_id:       project.id,
      body:             row.body,
      rating:           row.rating,
      reviewer:         row.reviewer,
      reviewed_at:      row.reviewed_at,
      source:           row.source,
      body_hash:        row.body_hash,
      raw:              row.raw as Record<string, string>,
      // Step 87-D: ソース追跡フィールド
      review_source_id: reviewSourceId,
      collected_at:     collectedAt,
      external_id:      null,         // CSV は行ごとの外部 ID を持たない
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('reviews')
      .insert(batch)
      .select('id')

    if (insertError) {
      await rollback(supabase, project.id, reviewSourceId)
      return NextResponse.json(
        { error: 'レビューの保存に失敗しました', detail: insertError.message },
        { status: 500 }
      )
    }

    insertedIds.push(...(inserted ?? []).map((r) => r.id))
  }

  // analysis_chunks を CHUNK_SIZE 件ずつ生成
  const chunkInserts: Array<{
    project_id: string
    chunk_index: number
    review_ids: string[]
    status: 'pending'
  }> = []

  for (let i = 0; i < insertedIds.length; i += CHUNK_SIZE) {
    chunkInserts.push({
      project_id: project.id,
      chunk_index: chunkInserts.length,
      review_ids: insertedIds.slice(i, i + CHUNK_SIZE),
      status: 'pending',
    })
  }

  if (chunkInserts.length > 0) {
    const { error: chunkError } = await supabase.from('analysis_chunks').insert(chunkInserts)
    if (chunkError) {
      await rollback(supabase, project.id, reviewSourceId)
      return NextResponse.json(
        { error: 'チャンク生成に失敗しました', detail: chunkError.message },
        { status: 500 }
      )
    }
  }

  // review_count を更新
  await supabase
    .from('projects')
    .update({ review_count: insertedIds.length })
    .eq('id', project.id)

  // Step 87-D: review_sources.total_collected を実際の挿入件数で更新
  // 失敗してもアップロード全体は成功とする（非致命的）
  await supabase
    .from('review_sources')
    .update({ total_collected: insertedIds.length })
    .eq('id', reviewSourceId)

  await logUsageEvent({
    organizationId: project.organization_id,
    projectId: project.id,
    eventType: 'csv_uploaded',
    metadata: {
      project_name: project.name,
      industry,
      total_rows: rows.length + skipped_empty_count,
      inserted_count: insertedIds.length,
      skipped_empty_count,
      skipped_duplicate_count,
      chunk_count: chunkInserts.length,
    },
  })

  return NextResponse.json({
    project_id: project.id,
    total_rows: rows.length + skipped_empty_count,
    inserted_count: insertedIds.length,
    skipped_empty_count,
    skipped_duplicate_count,
    chunk_count: chunkInserts.length,
    errors: parseErrors,
  })
}
