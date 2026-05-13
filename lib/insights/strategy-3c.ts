/**
 * strategy-3c.ts
 *
 * 既存の分析結果（ProjectAnalysis + IndustryBenchmark）から
 * Claude APIを呼び出さずに3C分析を組み立てるヘルパー。
 *
 * bullets は「ラベル：値」形式（最大3件・1件60文字以内）で統一。
 * 表示側でラベル部分を太字レンダリングする想定。
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** 末尾がはみ出す場合のみ文末省略。句読点境界を優先する。 */
function trunc(s: string | null | undefined, max: number): string {
  if (!s) return ''
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const boundary = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('、'), cut.lastIndexOf('・'))
  if (boundary > Math.floor(max * 0.6)) return cut.slice(0, boundary + 1) + '…'
  return cut.slice(0, max - 1) + '…'
}

/** 配列をテキスト結合。結合後が maxTotal を超えたら末尾省略。 */
function joinItems(items: string[], sep = '、', maxTotal = 40): string {
  if (items.length === 0) return ''
  const joined = items.join(sep)
  return joined.length <= maxTotal ? joined : joined.slice(0, maxTotal - 1) + '…'
}

/** 「ラベル：値」形式の bullet 文字列を生成。値が空なら null。 */
function bullet(label: string, value: string | null | undefined): string | null {
  if (!value) return null
  return `${label}：${value}`
}

// ---------------------------------------------------------------------------
// Customer セクション
// ---------------------------------------------------------------------------

function buildCustomer(analysis: ProjectAnalysis): Strategy3CSection {
  const customerTypes    = (analysis.customer_types    ?? []) as CustomerType[]
  const purchaseReasons  = (analysis.purchase_reasons  ?? []) as PurchaseReason[]
  const occasionInsights = (analysis.occasion_insights ?? []) as OccasionInsight[]
  const complaints       = (analysis.complaints        ?? []) as Complaint[]

  // 顧客像：customer_types の label をカンマ列挙（最大3件）
  const typeLabels = customerTypes.slice(0, 3).map((ct) => ct.label).filter(Boolean)
  // 悩み：complaints の label をカンマ列挙（最大3件）
  const complaintLabels = complaints.slice(0, 3).map((c) => c.label).filter(Boolean)
  // 欲求：purchase_reasons の surface_reason または label（最大2件）
  const reasonLabels = purchaseReasons.slice(0, 2)
    .map((pr) => pr.surface_reason || pr.label).filter(Boolean)
  // 想起：occasion_insights の occasion（最大2件）
  const occasionLabels = occasionInsights.slice(0, 2).map((oi) => oi.occasion).filter(Boolean)

  const bullets = [
    bullet('顧客像', typeLabels.length ? joinItems(typeLabels, '・', 40) : null),
    bullet('悩み',   complaintLabels.length ? joinItems(complaintLabels, '、', 38) : null),
    bullet('欲求',   reasonLabels.length ? joinItems(reasonLabels, '。', 40) : null),
    bullet('想起',   occasionLabels.length ? joinItems(occasionLabels, '、', 36) : null),
  ].filter(Boolean).slice(0, 3) as string[]

  // summary: 1〜2文、最大90文字
  const summary =
    customerTypes[0]?.description
      ? trunc(customerTypes[0].description, 90)
      : purchaseReasons[0]?.surface_reason
      ? trunc(purchaseReasons[0].surface_reason, 90)
      : '顧客の特徴・ニーズを分析中です'

  // key_message: 深層心理 or ターゲティングヒント
  const key_message =
    purchaseReasons[0]?.deep_psychology
      ? trunc(purchaseReasons[0].deep_psychology, 70)
      : customerTypes[0]?.ad_targeting_hint
      ? trunc(customerTypes[0].ad_targeting_hint, 70)
      : undefined

  return { title: 'Customer — 顧客', summary, bullets, key_message }
}

// ---------------------------------------------------------------------------
// Competitor セクション
// ---------------------------------------------------------------------------

function buildCompetitor(
  analysis: ProjectAnalysis,
  benchmark?: IndustryBenchmark | null
): Strategy3CSection {
  const complaints   = (analysis.complaints    ?? []) as Complaint[]
  const avoidAppeals = (analysis.avoid_appeals ?? []) as AvoidAppeal[]

  // 一般化：避けるべき訴求（業界共通） or ベンチマーク上位
  const generalizedItems = avoidAppeals.length
    ? avoidAppeals.slice(0, 3).map((aa) => aa.appeal).filter(Boolean)
    : benchmark?.rating_points.slice(0, 3).map((r) => r.label) ?? []

  // 比較軸：比較・価格・期待に関する不満
  const compComplaints = complaints
    .filter((c) => /価格|比較|期待|他社|競合|安い|高い|他の|比べ|品質/.test(c.label))
    .slice(0, 3)
    .map((c) => c.label)
  const compFallback = complaints.slice(0, 2).map((c) => c.label)
  const compItems = compComplaints.length ? compComplaints : compFallback

  // 注意：最初の avoid_appeal の reason または risk（短く）
  const cautionText = avoidAppeals[0]?.risk
    ? trunc(avoidAppeals[0].risk, 40)
    : avoidAppeals[0]?.reason
    ? trunc(avoidAppeals[0].reason, 40)
    : null

  const bullets = [
    bullet('一般化', generalizedItems.length ? joinItems(generalizedItems, '、', 38) : null),
    bullet('比較軸', compItems.length ? joinItems(compItems, '、', 38) : null),
    bullet('注意',   cautionText),
  ].filter(Boolean).slice(0, 3) as string[]

  const summary =
    avoidAppeals[0]
      ? `「${trunc(avoidAppeals[0].appeal, 20)}」など業界内で一般化した訴求では差別化が難しい`
      : benchmark?.rating_points[0]
      ? `業界共通の評価軸「${trunc(benchmark.rating_points[0].label, 20)}」での勝負を避ける`
      : '競合・業界共通の訴求軸を整理しています'

  const key_message = avoidAppeals[0]?.replacement_message
    ? trunc(avoidAppeals[0].replacement_message, 70)
    : undefined

  return { title: 'Competitor — 競合', summary, bullets, key_message }
}

// ---------------------------------------------------------------------------
// Company セクション
// ---------------------------------------------------------------------------

function buildCompany(analysis: ProjectAnalysis): Strategy3CSection {
  const ratingPoints = (analysis.rating_points ?? []) as RatingPoint[]
  const appealWords  = (analysis.appeal_words  ?? []) as AppealWord[]
  const demandPoints = (analysis.demand_points ?? []) as DemandPoint[]

  // 強み：rating_points の label（最大3件）
  const strengthItems = ratingPoints.slice(0, 3).map((rp) => rp.label).filter(Boolean)

  // 言葉：appeal_words の word（最大5件）
  const wordItems = appealWords.slice(0, 5).map((w) => w.word).filter(Boolean)

  // 価値：demand_points の label または copyworthy_phrases
  const valueText =
    demandPoints[0]?.label
      ? trunc(demandPoints[0].label, 36)
      : ratingPoints[0]?.copyworthy_phrases?.[0]
      ? trunc(ratingPoints[0].copyworthy_phrases[0], 36)
      : null

  const bullets = [
    bullet('強み', strengthItems.length ? joinItems(strengthItems, '、', 40) : null),
    bullet('言葉', wordItems.length ? joinItems(wordItems, '・', 38) : null),
    bullet('価値', valueText),
  ].filter(Boolean).slice(0, 3) as string[]

  const summary =
    ratingPoints[0]
      ? `「${trunc(ratingPoints[0].label, 25)}」が最も評価されており、差別化の核となる`
      : appealWords[0]
      ? `「${trunc(appealWords[0].word, 20)}」など独自の訴求ワードが自社の強みを示している`
      : '自社レビューから強みを分析しています'

  const key_message =
    appealWords[0]?.suggested_use
      ? trunc(appealWords[0].suggested_use, 70)
      : ratingPoints[0]?.copyworthy_phrases?.[0]
      ? trunc(ratingPoints[0].copyworthy_phrases[0], 70)
      : undefined

  return { title: 'Company — 自社', summary, bullets, key_message }
}

// ---------------------------------------------------------------------------
// Winning Strategy セクション
// ---------------------------------------------------------------------------

function buildWinningStrategy(analysis: ProjectAnalysis): Strategy3CSection {
  const insights         = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const avoidAppeals     = (analysis.avoid_appeals      ?? []) as AvoidAppeal[]
  const demandPoints     = (analysis.demand_points      ?? []) as DemandPoint[]
  const occasionInsights = (analysis.occasion_insights  ?? []) as OccasionInsight[]
  const appealWords      = (analysis.appeal_words       ?? []) as AppealWord[]

  const highInsights = insights.filter((i) => i.priority === 'high')

  // 捨てる：avoid_appeals の appeal（最大2件）
  const avoidItems = avoidAppeals.slice(0, 2).map((aa) => aa.appeal).filter(Boolean)

  // 打ち出す：appeal_words or demand_points のキーワード
  const pushItems = appealWords.length
    ? appealWords.slice(0, 4).map((w) => w.word).filter(Boolean)
    : demandPoints.slice(0, 3).map((dp) => dp.label).filter(Boolean)

  // 施策：high priority insight の suggested_action（短く）
  const actionText = highInsights[0]?.suggested_action
    ? trunc(highInsights[0].suggested_action, 40)
    : occasionInsights[0]?.recommended_message
    ? trunc(occasionInsights[0].recommended_message, 40)
    : null

  const bullets = [
    bullet('捨てる',   avoidItems.length ? joinItems(avoidItems, '、', 38) : null),
    bullet('打ち出す', pushItems.length  ? joinItems(pushItems,  '・', 38) : null),
    bullet('施策',     actionText),
  ].filter(Boolean).slice(0, 3) as string[]

  const summary =
    highInsights[0]
      ? trunc(highInsights[0].insight, 90)
      : insights[0]
      ? trunc(insights[0].insight, 90)
      : 'マーケティング示唆から勝ち筋を導出しています'

  const key_message = highInsights[0]?.suggested_action
    ? trunc(highInsights[0].suggested_action, 70)
    : demandPoints[0]?.marketing_use
    ? trunc(demandPoints[0].marketing_use, 70)
    : undefined

  return { title: 'Winning Strategy — 勝ち筋', summary, bullets, key_message }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * 既存の分析結果から3C分析を組み立てる。Claude APIは呼ばない。
 */
export function buildStrategy3C(
  analysis: ProjectAnalysis,
  benchmark?: IndustryBenchmark | null
): Strategy3C {
  return {
    customer:         buildCustomer(analysis),
    competitor:       buildCompetitor(analysis, benchmark),
    company:          buildCompany(analysis),
    winning_strategy: buildWinningStrategy(analysis),
  }
}
