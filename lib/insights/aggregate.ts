import { createServiceClient } from '@/lib/supabase/service'
import type { Json } from '@/types/database'
import type {
  ProjectAnalysis,
  RatingPoint,
  Complaint,
  PurchaseReason,
  AppealWord,
} from '@/types/analysis'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type InsightType = 'rating_point' | 'complaint' | 'purchase_reason' | 'appeal_word'

interface InsightItem {
  industry: string
  insight_type: InsightType
  label: string
  count: number
  examples_anonymized: Json
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trunc(s: string | undefined | null, max = 80): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function mergeExamples(existing: Json, incoming: Json, max = 5): Json {
  const ex = Array.isArray(existing) ? (existing as unknown[]) : []
  const inc = Array.isArray(incoming) ? (incoming as unknown[]) : []
  // Deduplicate by JSON string and cap at `max`
  const seen = new Set(ex.map((e) => JSON.stringify(e)))
  const merged = [...ex]
  for (const item of inc) {
    const key = JSON.stringify(item)
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(item)
    }
    if (merged.length >= max) break
  }
  return merged.slice(0, max) as unknown as Json
}

function computeConfidence(count: number, examplesLen: number): number {
  // Simple heuristic: count-driven (70%) + example richness (30%). Cap at 1.0.
  const countScore = Math.min(count / 50, 1.0) * 0.7
  const exampleScore = (Math.min(examplesLen, 5) / 5) * 0.3
  return Math.round((countScore + exampleScore) * 100) / 100
}

// ---------------------------------------------------------------------------
// Axis converters
// ---------------------------------------------------------------------------

function ratingPointToItem(rp: RatingPoint, industry: string): InsightItem {
  const examples = (rp.examples ?? [])
    .slice(0, 3)
    .map((e) => ({ text: trunc(e) }))
  return {
    industry,
    insight_type: 'rating_point',
    label: rp.label,
    count: rp.count,
    examples_anonymized: examples as unknown as Json,
  }
}

function complaintToItem(c: Complaint, industry: string): InsightItem {
  const examples = (c.examples ?? [])
    .slice(0, 3)
    .map((e) => ({ text: trunc(e) }))
  return {
    industry,
    insight_type: 'complaint',
    label: c.label,
    count: c.count,
    examples_anonymized: examples as unknown as Json,
  }
}

function purchaseReasonToItem(pr: PurchaseReason, industry: string): InsightItem {
  const examples = (pr.examples ?? [])
    .slice(0, 3)
    .map((e) => ({ text: trunc(e) }))
  return {
    industry,
    insight_type: 'purchase_reason',
    label: pr.label,
    count: pr.count,
    examples_anonymized: examples as unknown as Json,
  }
}

function appealWordToItem(aw: AppealWord, industry: string): InsightItem {
  return {
    industry,
    insight_type: 'appeal_word',
    label: aw.word,
    count: aw.frequency,
    examples_anonymized: [
      { context: trunc(aw.context), suggested_use: trunc(aw.suggested_use) },
    ] as unknown as Json,
  }
}

// ---------------------------------------------------------------------------
// Upsert helper (per insight_type batch)
// ---------------------------------------------------------------------------

async function upsertInsightBatch(
  supabase: ReturnType<typeof createServiceClient>,
  items: InsightItem[]
): Promise<void> {
  if (items.length === 0) return

  const { industry, insight_type } = items[0]
  const labels = items.map((i) => i.label)

  // Fetch existing records for this (industry, insight_type) + labels
  const { data: existing } = await supabase
    .from('aggregated_insights')
    .select('id, label, count, examples_anonymized')
    .eq('industry', industry)
    .eq('insight_type', insight_type)
    .in('label', labels)

  const existingMap = new Map(
    (existing ?? []).map((r) => [r.label, r])
  )

  const toUpsert = items.map((item) => {
    const ex = existingMap.get(item.label)
    if (ex) {
      const newCount = ex.count + item.count
      const mergedExamples = mergeExamples(ex.examples_anonymized, item.examples_anonymized)
      return {
        industry: item.industry,
        insight_type: item.insight_type,
        label: item.label,
        count: newCount,
        examples_anonymized: mergedExamples,
        confidence_score: computeConfidence(newCount, (mergedExamples as unknown[]).length),
        updated_at: new Date().toISOString(),
      }
    }
    return {
      industry: item.industry,
      insight_type: item.insight_type,
      label: item.label,
      count: item.count,
      examples_anonymized: item.examples_anonymized,
      confidence_score: computeConfidence(
        item.count,
        Array.isArray(item.examples_anonymized) ? (item.examples_anonymized as unknown[]).length : 0
      ),
      updated_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase
    .from('aggregated_insights')
    .upsert(toUpsert, { onConflict: 'industry,insight_type,label' })

  if (error) {
    console.warn('[insights] upsert error:', error.message)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface AggregateProjectInsightsParams {
  industry: string
  analysis: ProjectAnalysis
}

/**
 * project_analyses から匿名化・集計インサイトを aggregated_insights に蓄積する。
 * エラーが発生しても例外を投げない。
 */
export async function aggregateProjectInsights(
  params: AggregateProjectInsightsParams
): Promise<void> {
  try {
    const { industry, analysis } = params
    const supabase = createServiceClient()

    const ratingItems = (analysis.rating_points ?? []).map((rp) =>
      ratingPointToItem(rp, industry)
    )
    const complaintItems = (analysis.complaints ?? []).map((c) =>
      complaintToItem(c, industry)
    )
    const purchaseItems = (analysis.purchase_reasons ?? []).map((pr) =>
      purchaseReasonToItem(pr, industry)
    )
    const appealItems = (analysis.appeal_words ?? []).map((aw) =>
      appealWordToItem(aw, industry)
    )

    // Process each axis as a batch
    await Promise.all([
      upsertInsightBatch(supabase, ratingItems),
      upsertInsightBatch(supabase, complaintItems),
      upsertInsightBatch(supabase, purchaseItems),
      upsertInsightBatch(supabase, appealItems),
    ])
  } catch (err) {
    console.warn('[insights] aggregateProjectInsights failed:', err)
  }
}
