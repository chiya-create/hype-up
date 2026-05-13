/**
 * strategy-3c.ts
 *
 * 既存の分析結果（ProjectAnalysis + IndustryBenchmark）から
 * Claude APIを呼び出さずに3C分析を組み立てるヘルパー。
 */
import type {
  ProjectAnalysis,
  Strategy3C,
  Strategy3CSection,
  CustomerType,
  PurchaseReason,
  RatingPoint,
  AppealWord,
  Complaint,
  MarketingInsight,
  DemandPoint,
  OccasionInsight,
  AvoidAppeal,
} from '@/types/analysis'
import type { IndustryBenchmark } from './benchmark'

function trunc(s: string | null | undefined, max = 60): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

/** Customer セクション */
function buildCustomer(analysis: ProjectAnalysis): Strategy3CSection {
  const customerTypes = (analysis.customer_types ?? []) as CustomerType[]
  const purchaseReasons = (analysis.purchase_reasons ?? []) as PurchaseReason[]
  const occasionInsights = (analysis.occasion_insights ?? []) as OccasionInsight[]
  const complaints = (analysis.complaints ?? []) as Complaint[]

  // Who — top customer types
  const whoLines = customerTypes.slice(0, 2).map((ct) => trunc(ct.description || ct.label, 55))
  // Why — top purchase reasons (surface)
  const whyLines = purchaseReasons.slice(0, 2).map((pr) =>
    trunc(pr.surface_reason || pr.label, 55)
  )
  // When — top occasion
  const whenLine = occasionInsights[0]
    ? `「${trunc(occasionInsights[0].occasion, 30)}」のシーンで想起`
    : null
  // Anxiety — top complaint as pre-purchase fear
  const anxietyLine = complaints[0]
    ? `購入前不安: ${trunc(complaints[0].label, 35)}`
    : null

  const bullets: string[] = [
    ...whoLines,
    ...whyLines,
    ...(whenLine ? [whenLine] : []),
    ...(anxietyLine ? [anxietyLine] : []),
  ].filter(Boolean).slice(0, 5)

  // summary — use top customer type description
  const summary =
    customerTypes[0]?.description
      ? trunc(customerTypes[0].description, 70)
      : purchaseReasons[0]?.surface_reason
      ? trunc(purchaseReasons[0].surface_reason, 70)
      : '顧客の特徴・ニーズを分析しています'

  // key_message — top purchase reason deep psychology
  const key_message = purchaseReasons[0]?.deep_psychology
    ? trunc(purchaseReasons[0].deep_psychology, 60)
    : undefined

  return { title: 'Customer — 顧客', summary, bullets, key_message }
}

/** Competitor セクション */
function buildCompetitor(
  analysis: ProjectAnalysis,
  benchmark?: IndustryBenchmark | null
): Strategy3CSection {
  const complaints = (analysis.complaints ?? []) as Complaint[]
  const avoidAppeals = (analysis.avoid_appeals ?? []) as AvoidAppeal[]

  const bullets: string[] = []

  // Industry-common from benchmark
  if (benchmark?.rating_points?.length) {
    const topBenchmark = benchmark.rating_points[0]
    bullets.push(`業界共通評価軸: ${trunc(topBenchmark.label, 45)}`)
  }

  // Avoid appeals = industry-common or over-used pitches
  avoidAppeals.slice(0, 2).forEach((aa) => {
    bullets.push(`使い古された訴求: 「${trunc(aa.appeal, 30)}」— ${trunc(aa.reason, 35)}`)
  })

  // Complaints that suggest comparison (expectation gap / price)
  const comparisonComplaints = complaints.filter(
    (c) => /価格|比較|期待|他社|競合|安い|高い|他の|比べ/.test(c.label)
  )
  comparisonComplaints.slice(0, 2).forEach((c) => {
    bullets.push(`比較ポイント: ${trunc(c.label, 50)}`)
  })

  // Fallback if no comparison complaints
  if (comparisonComplaints.length === 0 && complaints.length > 0) {
    bullets.push(`顧客の主要不満: ${trunc(complaints[0].label, 50)}`)
  }

  const bulletsFinal = bullets.slice(0, 5)

  const summary =
    avoidAppeals[0]
      ? `「${trunc(avoidAppeals[0].appeal, 25)}」など業界内で一般化した訴求が差別化の障壁になっている`
      : benchmark?.rating_points[0]
      ? `業界共通評価軸「${trunc(benchmark.rating_points[0].label, 25)}」での差別化が課題`
      : '競合・業界共通の訴求軸を整理しています'

  const key_message = avoidAppeals[0]?.replacement_message
    ? trunc(avoidAppeals[0].replacement_message, 60)
    : undefined

  return { title: 'Competitor — 競合', summary, bullets: bulletsFinal, key_message }
}

/** Company セクション */
function buildCompany(analysis: ProjectAnalysis): Strategy3CSection {
  const ratingPoints = (analysis.rating_points ?? []) as RatingPoint[]
  const appealWords = (analysis.appeal_words ?? []) as AppealWord[]
  const demandPoints = (analysis.demand_points ?? []) as DemandPoint[]

  const bullets: string[] = []

  // Strengths from rating_points
  ratingPoints.slice(0, 2).forEach((rp) => {
    const phrase = rp.copyworthy_phrases?.[0]
    bullets.push(
      phrase
        ? `「${trunc(phrase, 35)}」— ${trunc(rp.label, 30)}`
        : `強み: ${trunc(rp.label, 50)}（${rp.count}件）`
    )
  })

  // Top appeal words
  const topWords = appealWords.slice(0, 3).map((w) => w.word).join('・')
  if (topWords) bullets.push(`訴求キーワード: ${topWords}`)

  // Demand points fulfilled
  demandPoints.slice(0, 1).forEach((dp) => {
    bullets.push(`顧客要求充足: ${trunc(dp.label, 50)}`)
  })

  const bulletsFinal = bullets.slice(0, 5)

  const summary =
    ratingPoints[0]
      ? `「${trunc(ratingPoints[0].label, 30)}」が最も評価されており、これが差別化の核となる`
      : appealWords[0]
      ? `「${appealWords[0].word}」など独自の訴求ワードが自社の強みを示している`
      : '自社レビューから強みを分析しています'

  const key_message =
    appealWords[0]?.suggested_use
      ? trunc(appealWords[0].suggested_use, 60)
      : ratingPoints[0]?.copyworthy_phrases?.[0]
      ? `"${trunc(ratingPoints[0].copyworthy_phrases[0], 55)}"`
      : undefined

  return { title: 'Company — 自社', summary, bullets: bulletsFinal, key_message }
}

/** Winning Strategy セクション */
function buildWinningStrategy(analysis: ProjectAnalysis): Strategy3CSection {
  const insights = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const avoidAppeals = (analysis.avoid_appeals ?? []) as AvoidAppeal[]
  const demandPoints = (analysis.demand_points ?? []) as DemandPoint[]
  const occasionInsights = (analysis.occasion_insights ?? []) as OccasionInsight[]

  const highInsights = insights.filter((i) => i.priority === 'high')

  const bullets: string[] = []

  // Top high-priority action
  highInsights.slice(0, 2).forEach((ins) => {
    bullets.push(`打ち手: ${trunc(ins.suggested_action || ins.insight, 55)}`)
  })

  // Key occasion message
  occasionInsights[0]?.recommended_message &&
    bullets.push(`訴求シーン: ${trunc(occasionInsights[0].recommended_message, 50)}`)

  // Demand point to fulfill
  demandPoints[0] &&
    bullets.push(`顧客要求軸: ${trunc(demandPoints[0].marketing_use || demandPoints[0].label, 50)}`)

  // Avoid
  avoidAppeals[0] &&
    bullets.push(`捨てる訴求: 「${trunc(avoidAppeals[0].appeal, 25)}」`)

  const bulletsFinal = bullets.slice(0, 5)

  const summary =
    highInsights[0]
      ? trunc(highInsights[0].insight, 75)
      : insights[0]
      ? trunc(insights[0].insight, 75)
      : 'マーケティング示唆から勝ち筋を導出しています'

  const key_message = highInsights[0]?.suggested_action
    ? trunc(highInsights[0].suggested_action, 65)
    : undefined

  return { title: 'Winning Strategy — 勝ち筋', summary, bullets: bulletsFinal, key_message }
}

/**
 * 既存の分析結果から3C分析を組み立てる。
 * Claude APIは呼ばない。
 */
export function buildStrategy3C(
  analysis: ProjectAnalysis,
  benchmark?: IndustryBenchmark | null
): Strategy3C {
  return {
    customer: buildCustomer(analysis),
    competitor: buildCompetitor(analysis, benchmark),
    company: buildCompany(analysis),
    winning_strategy: buildWinningStrategy(analysis),
  }
}
