import type { ProjectAnalysis } from '@/types/analysis'
import type { Json } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BenchmarkLevel = 'common' | 'emerging' | 'unique' | 'unknown'

export interface BenchmarkItem {
  label: string
  insight_type: string
  project_count: number
  industry_count: number
  confidence_score: number | null
  benchmark_level: BenchmarkLevel
  interpretation: string
}

export interface BenchmarkSummary {
  total: number
  common: number
  emerging: number
  unique: number
  unknown: number
}

export interface IndustryBenchmark {
  rating_points: BenchmarkItem[]
  complaints: BenchmarkItem[]
  purchase_reasons: BenchmarkItem[]
  appeal_words: BenchmarkItem[]
  summary: BenchmarkSummary
}

export interface AggregatedInsightRow {
  id: string
  industry: string
  insight_type: string
  label: string
  count: number
  examples_anonymized: Json
  confidence_score: number | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Interpretations
// ---------------------------------------------------------------------------

const INTERPRETATIONS: Record<BenchmarkLevel, string> = {
  common:
    '同業界でもよく見られる傾向です。差別化要素というより、最低限押さえるべき訴求・課題として扱うのが良さそうです。',
  emerging:
    '同業界でも一部見られる傾向です。今後伸びる可能性がある論点として注視できます。',
  unique:
    '現時点の集計データでは目立っていない傾向です。競合との差別化要素になる可能性があります。',
  unknown: '比較できるデータが不足しています。',
}

// insight_type 変換（DB側は単数形、分析軸は複数形）
const AXIS_TO_TYPE: Record<string, string> = {
  rating_points: 'rating_point',
  complaints: 'complaint',
  purchase_reasons: 'purchase_reason',
  appeal_words: 'appeal_word',
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function classifyLevel(industryCount: number, label: string): BenchmarkLevel {
  if (!label) return 'unknown'
  if (industryCount === 0) return 'unique'
  if (industryCount >= 5) return 'common'
  return 'emerging'
}

function buildAxisItems(
  axis: keyof typeof AXIS_TO_TYPE,
  items: Array<{ label: string; count: number }>,
  insightMap: Map<string, AggregatedInsightRow>
): BenchmarkItem[] {
  const insightType = AXIS_TO_TYPE[axis]
  return items
    .filter((item) => !!item.label)
    .map((item) => {
      const key = `${insightType}::${item.label}`
      const matched = insightMap.get(key)
      const industryCount = matched?.count ?? 0
      const level = classifyLevel(industryCount, item.label)
      return {
        label: item.label,
        insight_type: insightType,
        project_count: item.count,
        industry_count: industryCount,
        confidence_score: matched?.confidence_score ?? null,
        benchmark_level: level,
        interpretation: INTERPRETATIONS[level],
      }
    })
    .sort((a, b) => {
      // unique → emerging → common → unknown
      const order: Record<BenchmarkLevel, number> = {
        unique: 0,
        emerging: 1,
        common: 2,
        unknown: 3,
      }
      return order[a.benchmark_level] - order[b.benchmark_level]
    })
}

interface BuildIndustryBenchmarkParams {
  industry: string
  analysis: ProjectAnalysis
  aggregatedInsights: AggregatedInsightRow[]
}

export function buildIndustryBenchmark(
  params: BuildIndustryBenchmarkParams
): IndustryBenchmark {
  const { analysis, aggregatedInsights } = params

  // Build lookup map: "insight_type::label" → row
  const insightMap = new Map<string, AggregatedInsightRow>(
    aggregatedInsights.map((row) => [`${row.insight_type}::${row.label}`, row])
  )

  const ratingPointItems = buildAxisItems(
    'rating_points',
    (analysis.rating_points ?? []).map((r) => ({ label: r.label, count: r.count })),
    insightMap
  )
  const complaintItems = buildAxisItems(
    'complaints',
    (analysis.complaints ?? []).map((c) => ({ label: c.label, count: c.count })),
    insightMap
  )
  const purchaseItems = buildAxisItems(
    'purchase_reasons',
    (analysis.purchase_reasons ?? []).map((p) => ({ label: p.label, count: p.count })),
    insightMap
  )
  const appealItems = buildAxisItems(
    'appeal_words',
    (analysis.appeal_words ?? []).map((a) => ({ label: a.word, count: a.frequency })),
    insightMap
  )

  const allItems = [...ratingPointItems, ...complaintItems, ...purchaseItems, ...appealItems]

  const summary: BenchmarkSummary = {
    total: allItems.length,
    common: allItems.filter((i) => i.benchmark_level === 'common').length,
    emerging: allItems.filter((i) => i.benchmark_level === 'emerging').length,
    unique: allItems.filter((i) => i.benchmark_level === 'unique').length,
    unknown: allItems.filter((i) => i.benchmark_level === 'unknown').length,
  }

  return { rating_points: ratingPointItems, complaints: complaintItems, purchase_reasons: purchaseItems, appeal_words: appealItems, summary }
}
