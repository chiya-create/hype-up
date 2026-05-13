/**
 * strategy-3c.ts
 *
 * 既存の分析結果（ProjectAnalysis + IndustryBenchmark）から
 * Claude APIを呼び出さずに3C分析を組み立てるヘルパー。
 *
 * 設計原則:
 *  - 省略記号「…」「...」を一切出さない
 *  - summary ≤ 60文字 / bullet value ≤ 30文字 / key_message ≤ 44文字
 *  - bullets: 各カード最大3件
 *  - cleanLabel() で助詞・冗長句を除去し自然な名詞句へ変換してから埋め込む
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

/** 省略記号なしハードカット */
function hardCut(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max)
}

/**
 * ラベルから冗長な助詞・接続句を除去し、自然な短い名詞句にする。
 * 例:
 *   "セルライト対策としての即効性への期待値ギャップ" → "即効性への期待"
 *   "価格の高さと容量消費のバランス"               → "価格・容量"
 *   "30代産後女性"                                → "30代産後女性"（変化なし）
 */
function cleanLabel(s: string | null | undefined, max = 18): string {
  if (!s) return ''
  let c = s
    // 「〜としての」→「〜の」
    .replace(/としての/g, 'の')
    // 「〜への期待値ギャップ/期待値/懸念」など → 「〜」
    .replace(/の(?:期待値ギャップ|期待値|懸念|ギャップ|不満感).*$/, '')
    // 「〜と〇〇のバランス」→「〜・〇〇」
    .replace(/と(\S+?)のバランス$/, '・$1')
    // 「への」を「の」に（文末除く）
    .replace(/への(?=\S)/g, 'の')
    // 文末「への」除去
    .replace(/への$/, '')
    // 「〜に対する」→ 後続を省略
    .replace(/に対する.+$/, '')
    // 「〜の高さ/少なさ/低さ」など → 「〜」
    .replace(/の(?:高さ|低さ|少なさ|多さ|悪さ|弱さ).*$/, '')
    .trim()
  return hardCut(c || s, max)
}

/**
 * 複数要素を sep で結合し、max 文字以内に収まる範囲だけ結合（省略記号なし）。
 * 入力は cleanLabel() 済みの短いラベルを想定。
 */
function safeJoin(items: string[], sep: string, max: number): string {
  const clean = items.filter(Boolean)
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
 * value は最大 maxVal 文字でハードカット。空なら null。
 */
function bul(
  label: string,
  value: string | null | undefined,
  maxVal = 30
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

  // 顧客像：customer_types 上位1件のみ（重複連結防止）
  const typeVal = cleanLabel(customerTypes[0]?.label, 24)

  // 悩み：complaints.label を cleanLabel して2件まで結合
  const complaintVals = complaints.slice(0, 3).map((c) => cleanLabel(c.label, 12))
  const complaintVal = safeJoin(complaintVals, '・', 28)

  // 欲求：purchase_reasons.label を cleanLabel して2件まで
  const reasonVals = purchaseReasons.slice(0, 2).map((pr) => cleanLabel(pr.label, 14))
  const reasonVal = safeJoin(reasonVals, '・', 28)

  // 想起：occasion_insights.occasion 1件
  const occasionVal = cleanLabel(occasionInsights[0]?.occasion, 22)

  const bullets = [
    bul('顧客像', typeVal),
    bul('悩み',   complaintVal),
    bul('欲求',   reasonVal),
    bul('想起',   occasionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary ≤ 60文字: 短いラベルで固定テンプレート ---
  const tl = cleanLabel(customerTypes[0]?.label, 14)
  const cl = cleanLabel(complaints[0]?.label, 14)
  const summary = tl && cl
    ? `${tl}が、${cl}を気にしている`
    : tl
    ? `${tl}が主な顧客層`
    : '顧客の特徴・ニーズを整理しています'

  // --- key_message ≤ 44文字 ---
  const km = occasionInsights[0]?.occasion
    ? `${cleanLabel(occasionInsights[0].occasion, 18)}のケア需要が強い`
    : purchaseReasons[0]?.label
    ? `${cleanLabel(purchaseReasons[0].label, 20)}が購入の決め手`
    : undefined
  const key_message = hardCut(km, 44) || undefined

  return {
    title: 'Customer — 顧客',
    summary: hardCut(summary, 60),
    bullets,
    key_message,
  }
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

  // 一般化：avoid_appeals.appeal を cleanLabel して2件まで
  const generalVals = avoidAppeals.length
    ? avoidAppeals.slice(0, 3).map((aa) => cleanLabel(aa.appeal, 12))
    : (benchmark?.rating_points ?? []).slice(0, 3).map((r) => cleanLabel(r.label, 12))
  const generalVal = safeJoin(generalVals, '・', 28)

  // 比較軸：比較・価格系の complaints.label (短縮) 2件まで
  const compRaw = complaints
    .filter((c) => /価格|比較|期待|高い|安い|容量|品質/.test(c.label))
    .slice(0, 3)
  const compFallback = complaints.slice(0, 3)
  const compSource = compRaw.length ? compRaw : compFallback
  const compVals = compSource.map((c) => cleanLabel(c.label, 10))
  const compVal = safeJoin(compVals, '・', 26)

  // 注意：avoid_appeals[0].risk/reason の先頭句
  const cautionRaw = avoidAppeals[0]?.risk || avoidAppeals[0]?.reason || ''
  const cautionEnd = Math.min(
    cautionRaw.indexOf('、') > 0 ? cautionRaw.indexOf('、') : 999,
    cautionRaw.indexOf('。') > 0 ? cautionRaw.indexOf('。') : 999,
    18
  )
  const cautionVal = cautionRaw ? cleanLabel(cautionRaw.slice(0, cautionEnd), 20) : null

  const bullets = [
    bul('一般化', generalVal),
    bul('比較軸', compVal),
    bul('注意',   cautionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary ≤ 60文字 ---
  const al = cleanLabel(avoidAppeals[0]?.appeal, 14)
  const bl = cleanLabel(benchmark?.rating_points[0]?.label, 14)
  const summary = al
    ? `${al}など一般化した訴求では差別化が難しい`
    : bl
    ? `${bl}では業界内で差別化が難しい`
    : '競合・業界共通の訴求軸を整理しています'

  // --- key_message ≤ 44文字 ---
  const km = avoidAppeals[0]?.replacement_message
    ? cleanLabel(avoidAppeals[0].replacement_message, 40)
    : undefined
  const key_message = hardCut(km, 44) || undefined

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

  // 強み：rating_points.label を cleanLabel して2件まで
  const strengthVals = ratingPoints.slice(0, 3).map((rp) => cleanLabel(rp.label, 12))
  const strengthVal = safeJoin(strengthVals, '・', 28)

  // 言葉：appeal_words.word 3件まで（word は既に短い）
  const wordVals = appealWords.slice(0, 4).map((w) => hardCut(w.word, 10))
  const wordVal = safeJoin(wordVals, '・', 28)

  // 価値：demand_points.label or copyworthy_phrases[0] を cleanLabel
  const valueRaw = demandPoints[0]?.label || ratingPoints[0]?.copyworthy_phrases?.[0] || null
  const valueVal = cleanLabel(valueRaw, 26)

  const bullets = [
    bul('強み', strengthVal),
    bul('言葉', wordVal),
    bul('価値', valueVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary ≤ 60文字 ---
  const sl = cleanLabel(ratingPoints[0]?.label, 20)
  const wl = cleanLabel(appealWords[0]?.word, 16)
  const summary = sl
    ? `自社の強みは「${sl}」にある`
    : wl
    ? `「${wl}」など独自の訴求ワードが強み`
    : '自社レビューから強みを分析しています'

  // --- key_message ≤ 44文字 ---
  const km = appealWords[0]?.word
    ? `${hardCut(appealWords[0].word, 16)}を主軸にした訴求が有効`
    : demandPoints[0]?.label
    ? `${cleanLabel(demandPoints[0].label, 18)}を前面に打ち出す`
    : undefined
  const key_message = hardCut(km, 44) || undefined

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

  // 捨てる：avoid_appeals.appeal を cleanLabel して2件まで
  const avoidVals = avoidAppeals.slice(0, 3).map((aa) => cleanLabel(aa.appeal, 12))
  const avoidVal = safeJoin(avoidVals, '・', 26)

  // 打ち出す：appeal_words.word or demand_points.label 3件まで
  const pushItems = appealWords.length
    ? appealWords.slice(0, 4).map((w) => hardCut(w.word, 10))
    : demandPoints.slice(0, 3).map((dp) => cleanLabel(dp.label, 12))
  const pushVal = safeJoin(pushItems, '・', 28)

  // 施策：high insight の insight の先頭部分
  const actionRaw = highInsights[0]?.insight || occasionInsights[0]?.occasion || ''
  const actionEnd = Math.min(
    actionRaw.indexOf('、') > 0 ? actionRaw.indexOf('、') : 999,
    actionRaw.indexOf('。') > 0 ? actionRaw.indexOf('。') : 999,
    18
  )
  const actionVal = actionRaw ? cleanLabel(actionRaw.slice(0, actionEnd), 20) : null

  const bullets = [
    bul('捨てる',   avoidVal),
    bul('打ち出す', pushVal),
    bul('施策',     actionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary ≤ 60文字 ---
  const avoidL = cleanLabel(avoidAppeals[0]?.appeal, 12)
  const pushL  = cleanLabel(appealWords[0]?.word || demandPoints[0]?.label, 12)
  const summary = avoidL && pushL
    ? `${avoidL}訴求を捨て、${pushL}へ転換する`
    : highInsights[0]?.insight
    ? hardCut(cleanLabel(highInsights[0].insight, 55), 58)
    : 'マーケティング示唆から勝ち筋を導出しています'

  // --- key_message ≤ 44文字 ---
  const kmAction = highInsights[0]?.suggested_action
    ? hardCut(highInsights[0].suggested_action, 42)
    : null
  const kmDemand = demandPoints[0]?.marketing_use
    ? hardCut(demandPoints[0].marketing_use, 42)
    : null
  const key_message = hardCut(kmAction ?? kmDemand ?? undefined, 44) || undefined

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
