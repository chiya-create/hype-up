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
// Interpretations — insight_type × benchmark_level で出し分け
// ---------------------------------------------------------------------------

type InsightTypeKey = 'rating_point' | 'complaint' | 'purchase_reason' | 'appeal_word'

const INTERPRETATIONS: Record<BenchmarkLevel, Partial<Record<InsightTypeKey, string>> & { _default: string }> = {
  common: {
    rating_point:
      'LP・広告で最低限押さえるべき基本訴求です。差別化よりも土台固めとして活用しましょう。',
    complaint:
      '購入前の不安や離脱要因として業界共通で見られます。FAQやLP内の補足説明で先回りして解消するのが良さそうです。',
    purchase_reason:
      '購入決定に関わる動機として業界全体で共通しています。ファーストビューやお客様の声に反映すると購入意欲を高めやすくなります。',
    appeal_word:
      '広告・LP・SNSで広く使われている表現です。使うべき言葉として押さえつつ、自社らしい切り口を加えると差別化になります。',
    _default:
      '同業界でもよく見られる傾向です。差別化よりも最低限押さえるべき基本として扱うのが良さそうです。',
  },
  emerging: {
    rating_point:
      '自社レビューで目立ち始めている評価ポイントです。競合がまだ強く打ち出していなければ、差別化訴求として使える可能性があります。',
    complaint:
      '今後増える可能性がある不満論点です。競合より先に対策を打てると、信頼感の向上につながります。',
    purchase_reason:
      '伸び始めている購入動機です。このニーズを先取りしたメッセージングで購入率の向上が狙えます。',
    appeal_word:
      '広まりつつある訴求ワードです。今のうちに広告・LPで使い始めると先行者優位を取れる可能性があります。',
    _default:
      '同業界でも一部見られ始めている傾向です。今後伸びる可能性がある論点として注視しましょう。',
  },
  unique: {
    rating_point:
      '自社レビューで相対的に強く出ているポイントです。広告見出しやファーストビューで優先的に検証する価値があります。',
    complaint:
      '自社特有の不満です。早期に改善または説明を加えることで、競合との差別化ポイントに転換できる可能性があります。',
    purchase_reason:
      '自社ならではの購入動機です。独自の訴求軸として、LPや広告コピーの中心に据えることを検討してください。',
    appeal_word:
      '自社に特有の訴求ワードです。広告見出しやキャッチコピーとして積極的にテストする価値があります。',
    _default:
      '現時点の集計データでは目立っていない傾向です。競合との差別化要素になる可能性があります。',
  },
  unknown: {
    _default: '比較できるデータが不足しています。',
  },
}

function getInterpretation(level: BenchmarkLevel, insightType: string): string {
  const map = INTERPRETATIONS[level]
  return (map[insightType as InsightTypeKey] ?? map._default)
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
        interpretation: getInterpretation(level, insightType),
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
