/**
 * strategy-3c.ts
 *
 * 既存の分析結果（ProjectAnalysis + IndustryBenchmark）から
 * Claude APIを呼び出さずに3C分析を組み立てるヘルパー。
 *
 * 設計原則:
 *  - 省略記号「…」「...」を一切出さない
 *  - summary ≤ 60文字 / bullet value ≤ 32文字 / key_message ≤ 45文字
 *  - bullets: 各カード最大3件
 *  - データは .label（短いキーワード）を優先使用。長文フィールドは使わない
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
// Internal helpers — 省略記号なし
// ---------------------------------------------------------------------------

/**
 * 文字列を max 文字で黙ってカット（省略記号なし）。
 * .label などすでに短いフィールドに適用するため、ほぼトリガーしない想定。
 */
function hardCut(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max)
}

/**
 * 複数要素を sep で結合し、max 文字以内に収まる範囲だけ結合（省略記号なし）。
 * 1件目だけでも max を超える場合は hardCut で収める。
 */
function safeJoin(items: string[], sep: string, max: number): string {
  const clean = items.map((i) => hardCut(i, max)).filter(Boolean)
  const result: string[] = []
  for (const item of clean) {
    const candidate = [...result, item].join(sep)
    if (candidate.length <= max) result.push(item)
    else break
  }
  return result.length > 0 ? result.join(sep) : hardCut(clean[0] ?? '', max)
}

/**
 * 「ラベル：値」形式の bullet 文字列を生成。
 * value が空なら null を返す。value は maxVal 文字でハードカット。
 */
function bul(
  label: string,
  value: string | null | undefined,
  maxVal = 32
): string | null {
  const v = hardCut(value, maxVal)
  return v ? `${label}：${v}` : null
}

// ---------------------------------------------------------------------------
// Customer セクション
// ---------------------------------------------------------------------------

function buildCustomer(analysis: ProjectAnalysis): Strategy3CSection {
  const customerTypes    = (analysis.customer_types    ?? []) as CustomerType[]
  const purchaseReasons  = (analysis.purchase_reasons  ?? []) as PurchaseReason[]
  const occasionInsights = (analysis.occasion_insights ?? []) as OccasionInsight[]
  const complaints       = (analysis.complaints        ?? []) as Complaint[]

  // --- bullets ---
  // 顧客像：customer_types.label 最大2件・30文字以内
  const typeVal = safeJoin(customerTypes.slice(0, 2).map((ct) => ct.label), '・', 30)
  // 悩み：complaints.label 最大2件・30文字以内
  const complaintVal = safeJoin(complaints.slice(0, 2).map((c) => c.label), '・', 30)
  // 欲求：purchase_reasons.label 最大2件・30文字以内
  const reasonVal = safeJoin(purchaseReasons.slice(0, 2).map((pr) => pr.label), '・', 30)
  // 想起：occasion_insights.occasion 1件・28文字以内
  const occasionVal = hardCut(occasionInsights[0]?.occasion, 28)

  const bullets = [
    bul('顧客像', typeVal),
    bul('悩み',   complaintVal),
    bul('欲求',   reasonVal),
    bul('想起',   occasionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary: 固定テンプレート ≤ 60文字 ---
  const typeLabel = hardCut(customerTypes[0]?.label, 16)
  const issueLabel = hardCut(complaints[0]?.label, 16)
  const summary = typeLabel && issueLabel
    ? `${typeLabel}が、${issueLabel}を気にしている`
    : typeLabel
    ? `${typeLabel}が主要顧客層`
    : '顧客の特徴・ニーズを整理しています'

  // --- key_message ≤ 45文字 ---
  const kmOccasion = occasionInsights[0]?.occasion
    ? `${hardCut(occasionInsights[0].occasion, 20)}のケア需要が強い`
    : null
  const kmReason = purchaseReasons[0]?.label
    ? `${hardCut(purchaseReasons[0].label, 22)}が購入決め手`
    : null
  const key_message = hardCut(kmOccasion ?? kmReason ?? undefined, 45) || undefined

  return { title: 'Customer — 顧客', summary: hardCut(summary, 60), bullets, key_message }
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

  // --- bullets ---
  // 一般化：avoid_appeals.appeal 最大2件 or benchmark.label
  const generalItems = avoidAppeals.length
    ? avoidAppeals.slice(0, 2).map((aa) => aa.appeal)
    : (benchmark?.rating_points ?? []).slice(0, 2).map((r) => r.label)
  const generalVal = safeJoin(generalItems, '・', 30)

  // 比較軸：比較・価格系の complaints.label 最大2件、なければ top complaints
  const compItems = complaints
    .filter((c) => /価格|比較|期待|高い|安い|容量|品質/.test(c.label))
    .slice(0, 2)
    .map((c) => c.label)
  const compFallback = complaints.slice(0, 2).map((c) => c.label)
  const compVal = safeJoin(compItems.length ? compItems : compFallback, '・', 30)

  // 注意：avoid_appeals[0].risk → 短い名詞句に
  const cautionRaw = avoidAppeals[0]?.risk || avoidAppeals[0]?.reason || ''
  // risk はプロセ文のため最初の句点まで、なければ先頭20文字
  const cautionEnd = Math.min(
    cautionRaw.indexOf('、') > 0 ? cautionRaw.indexOf('、') : 9999,
    cautionRaw.indexOf('。') > 0 ? cautionRaw.indexOf('。') : 9999,
    20
  )
  const cautionVal = cautionRaw ? cautionRaw.slice(0, cautionEnd) : null

  const bullets = [
    bul('一般化', generalVal),
    bul('比較軸', compVal),
    bul('注意',   cautionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary ≤ 60文字 ---
  const avoidLabel = hardCut(avoidAppeals[0]?.appeal, 18)
  const benchLabel = hardCut(benchmark?.rating_points[0]?.label, 18)
  const summary = avoidLabel
    ? `${avoidLabel}は一般化しており、差別化しづらい`
    : benchLabel
    ? `${benchLabel}では業界内で差別化が難しい`
    : '競合・業界共通の訴求軸を整理しています'

  // --- key_message ≤ 45文字 ---
  const kmReplace = avoidAppeals[0]?.replacement_message
    ? hardCut(avoidAppeals[0].replacement_message, 40)
    : null
  const key_message = hardCut(kmReplace ?? undefined, 45) || undefined

  return {
    title: 'Competitor — 競合',
    summary: hardCut(summary, 60),
    bullets,
    key_message,
  }
}

// ---------------------------------------------------------------------------
// Company セクション
// ---------------------------------------------------------------------------

function buildCompany(analysis: ProjectAnalysis): Strategy3CSection {
  const ratingPoints = (analysis.rating_points ?? []) as RatingPoint[]
  const appealWords  = (analysis.appeal_words  ?? []) as AppealWord[]
  const demandPoints = (analysis.demand_points ?? []) as DemandPoint[]

  // --- bullets ---
  // 強み：rating_points.label 最大2件
  const strengthVal = safeJoin(ratingPoints.slice(0, 2).map((rp) => rp.label), '・', 30)
  // 言葉：appeal_words.word 最大3件
  const wordVal = safeJoin(appealWords.slice(0, 3).map((w) => w.word), '・', 30)
  // 価値：demand_points.label 1件 or copyworthy_phrases[0]
  const valueRaw = demandPoints[0]?.label
    || ratingPoints[0]?.copyworthy_phrases?.[0]
    || null
  const valueVal = hardCut(valueRaw, 30)

  const bullets = [
    bul('強み', strengthVal),
    bul('言葉', wordVal),
    bul('価値', valueVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary ≤ 60文字 ---
  const topStrength = hardCut(ratingPoints[0]?.label, 20)
  const topWord = hardCut(appealWords[0]?.word, 16)
  const summary = topStrength
    ? `自社の強みは「${topStrength}」にある`
    : topWord
    ? `「${topWord}」など独自の訴求ワードが強み`
    : '自社レビューから強みを分析しています'

  // --- key_message ≤ 45文字 ---
  const kmWord = appealWords[0]?.word
    ? `${hardCut(appealWords[0].word, 18)}を主軸にした訴求が有効`
    : null
  const kmDemand = demandPoints[0]?.label
    ? `${hardCut(demandPoints[0].label, 20)}を前面に出す`
    : null
  const key_message = hardCut(kmWord ?? kmDemand ?? undefined, 45) || undefined

  return {
    title: 'Company — 自社',
    summary: hardCut(summary, 60),
    bullets,
    key_message,
  }
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

  // --- bullets ---
  // 捨てる：avoid_appeals.appeal 最大2件
  const avoidVal = safeJoin(avoidAppeals.slice(0, 2).map((aa) => aa.appeal), '・', 30)
  // 打ち出す：appeal_words.word or demand_points.label 最大3件
  const pushItems = appealWords.length
    ? appealWords.slice(0, 3).map((w) => w.word)
    : demandPoints.slice(0, 2).map((dp) => dp.label)
  const pushVal = safeJoin(pushItems, '・', 30)
  // 施策：high insight の insight（先頭句まで）or occasion message
  const actionRaw = highInsights[0]?.insight || occasionInsights[0]?.occasion || ''
  const actionEnd = Math.min(
    actionRaw.indexOf('、') > 0 ? actionRaw.indexOf('、') : 9999,
    actionRaw.indexOf('。') > 0 ? actionRaw.indexOf('。') : 9999,
    20
  )
  const actionVal = actionRaw ? actionRaw.slice(0, actionEnd) : null

  const bullets = [
    bul('捨てる',   avoidVal),
    bul('打ち出す', pushVal),
    bul('施策',     actionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary ≤ 60文字 ---
  const avoidLabel = hardCut(avoidAppeals[0]?.appeal, 14)
  const pushLabel  = hardCut(
    appealWords[0]?.word || demandPoints[0]?.label, 14
  )
  const summary = avoidLabel && pushLabel
    ? `${avoidLabel}訴求を捨て、${pushLabel}へ転換する`
    : highInsights[0]
    ? hardCut(highInsights[0].insight, 55)
    : 'マーケティング示唆から勝ち筋を導出しています'

  // --- key_message ≤ 45文字 ---
  const kmInsight = highInsights[0]?.suggested_action
    ? hardCut(highInsights[0].suggested_action, 42)
    : null
  const kmDemand = demandPoints[0]?.marketing_use
    ? hardCut(demandPoints[0].marketing_use, 42)
    : null
  const key_message = hardCut(kmInsight ?? kmDemand ?? undefined, 45) || undefined

  return {
    title: 'Winning Strategy — 勝ち筋',
    summary: hardCut(summary, 60),
    bullets,
    key_message,
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * 既存の分析結果から3C分析を組み立てる。Claude APIは呼ばない。
 * 出力文字列に省略記号「…」「...」は含まれない。
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
