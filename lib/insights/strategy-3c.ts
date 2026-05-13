/**
 * strategy-3c.ts
 *
 * 既存の分析結果（ProjectAnalysis + IndustryBenchmark）から
 * Claude APIを呼び出さずに3C分析を組み立てるヘルパー。
 *
 * 設計原則:
 *  - 省略記号「…」「...」を一切出さない
 *  - テンプレート埋め込み前に safeEmbed() で助詞末チェック → NG なら固定フォールバック
 *  - summary ≤ 60 / bullet value ≤ 30 / key_message ≤ 44
 *  - bullets: 各カード最大3件
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
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** 省略記号なしハードカット */
function hardCut(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max)
}

/**
 * ラベルから冗長な助詞・接続句を除去し、短い名詞句にする。
 * 変換例:
 *   "セルライト対策としての即効性への期待値ギャップ" → "セルライト対策の即効性"
 *   "価格の高さと容量消費のバランス"               → "価格・容量消費"
 *   "絶対大丈夫な安全性への訴求"                  → "絶対大丈夫な安全性"
 */
function cleanLabel(s: string | null | undefined, max = 20): string {
  if (!s) return ''
  let c = s
    .replace(/としての/g, 'の')
    .replace(/の(?:期待値ギャップ|期待値|懸念|ギャップ|不満感)/g, '')
    .replace(/と(\S+?)のバランス$/, '・$1')
    .replace(/への(?=\S)/g, 'の')
    .replace(/への$/g, '')
    .replace(/に対する.+$/g, '')
    .replace(/の(?:高さ|低さ|少なさ|多さ|悪さ|弱さ).*$/g, '')
    .trim()
  return hardCut(c || s, max)
}

/**
 * 文章テンプレートへの埋め込みに安全かチェック。
 * 末尾が助詞・な形・括弧類の場合は null を返す。
 * 2文字未満 or max 超えも null。
 */
function safeEmbed(s: string | null | undefined, max = 14): string | null {
  if (!s) return null
  const c = hardCut(cleanLabel(s, max), max)
  if (!c || c.length < 2) return null
  if (/[をにはがでてもやとへのな・、。「」『』（）【】]$/.test(c)) return null
  return c
}

/**
 * 複数要素を sep で結合し、max 文字以内に収まる範囲だけ結合（省略記号なし）。
 * 各要素は cleanLabel 済みの短いラベルを想定。
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

/** 「ラベル：値」bullet。value が空なら null。value は maxVal 文字でハードカット。 */
function bul(label: string, value: string | null | undefined, maxVal = 30): string | null {
  const v = hardCut(value, maxVal)
  return v ? `${label}：${v}` : null
}

/**
 * marketing_insights のテキストから反映チャネルを推定し、
 * "LP・広告を刷新" のような固定句を返す。
 */
function inferChannel(insights: MarketingInsight[]): string {
  const text = insights.slice(0, 5)
    .map((i) => `${i.suggested_action ?? ''} ${i.insight ?? ''}`)
    .join(' ')
  const parts: string[] = []
  if (/LP|ランディング|ファーストビュー|商品ページ/.test(text)) parts.push('LP')
  if (/広告|ad\b|Meta|Google|Yahoo|CPA|ROAS/i.test(text))    parts.push('広告')
  if (/SNS|Instagram|Twitter|TikTok|リール/.test(text))       parts.push('SNS')
  if (/FAQ|よくある質問|Q&A/i.test(text))                     parts.push('FAQ')
  if (parts.length === 0) return 'LP・広告を刷新'
  return parts.slice(0, 2).join('・') + 'を刷新'
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
  const typeVal = hardCut(cleanLabel(customerTypes[0]?.label, 24), 24)
  // 悩み：complaints.label を cleanLabel して2件まで結合
  const complaintVals = complaints.slice(0, 3).map((c) => cleanLabel(c.label, 12))
  const complaintVal  = safeJoin(complaintVals, '・', 28)
  // 欲求：purchase_reasons.label を cleanLabel して2件まで
  const reasonVals = purchaseReasons.slice(0, 2).map((pr) => cleanLabel(pr.label, 14))
  const reasonVal  = safeJoin(reasonVals, '・', 28)
  // 想起：occasion_insights.occasion 1件
  const occasionVal = hardCut(cleanLabel(occasionInsights[0]?.occasion, 22), 22)

  const bullets = [
    bul('顧客像', typeVal),
    bul('悩み',   complaintVal),
    bul('欲求',   reasonVal),
    bul('想起',   occasionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary: safeEmbed で安全確認してからテンプレートへ ---
  const tl = safeEmbed(customerTypes[0]?.label,  13)
  const cl = safeEmbed(complaints[0]?.label,      13)
  const summary = tl && cl
    ? `${tl}が、${cl}を気にしている`
    : tl
    ? `${tl}が主な顧客層`
    : complaintVal
    ? `${hardCut(complaintVal, 20)}を気にする顧客が中心`
    : '顧客の特徴・ニーズを整理しました'

  // --- key_message ---
  const kmOccasion = occasionInsights[0]?.occasion
    ? `${hardCut(cleanLabel(occasionInsights[0].occasion, 16), 16)}のケア需要が強い`
    : null
  const kmReason = purchaseReasons[0]?.label
    ? `${hardCut(cleanLabel(purchaseReasons[0].label, 18), 18)}が購入の決め手`
    : null
  const key_message = hardCut(kmOccasion ?? kmReason ?? undefined, 44) || undefined

  return {
    title:    'Customer — 顧客',
    summary:  hardCut(summary, 60),
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
  const generalVal = safeJoin(generalVals, '・', 26)

  // 比較軸：比較・価格系 complaints を cleanLabel して2件まで
  const compSource = complaints
    .filter((c) => /価格|比較|期待|高い|安い|容量|品質/.test(c.label))
    .slice(0, 3)
  const compFallback = complaints.slice(0, 3)
  const compVals = (compSource.length ? compSource : compFallback)
    .map((c) => cleanLabel(c.label, 10))
  const compVal = safeJoin(compVals, '・', 26)

  // 注意：avoid_appeals[0].risk/reason を直接 cleanLabel（句読点サーチをやめる）
  const cautionRaw = avoidAppeals[0]?.risk || avoidAppeals[0]?.reason || ''
  const cautionVal = cautionRaw ? hardCut(cleanLabel(cautionRaw, 20), 20) : null

  const bullets = [
    bul('一般化', generalVal),
    bul('比較軸', compVal),
    bul('注意',   cautionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary: safeEmbed で安全確認 ---
  const al = safeEmbed(avoidAppeals[0]?.appeal,            14)
  const bl = safeEmbed(benchmark?.rating_points[0]?.label, 14)
  const summary = al
    ? `${al}など一般化した訴求では差別化が難しい`
    : bl
    ? `${bl}では業界内で差別化が難しい`
    : generalVal
    ? `${hardCut(generalVal, 18)}訴求は一般化し、差別化しづらい`
    : '競合・業界共通の訴求軸を整理しました'

  // --- key_message ---
  const km = avoidAppeals[0]?.replacement_message
    ? hardCut(cleanLabel(avoidAppeals[0].replacement_message, 40), 44)
    : undefined
  const key_message = km || undefined

  return {
    title:    'Competitor — 競合',
    summary:  hardCut(summary, 60),
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
  const strengthVal  = safeJoin(strengthVals, '・', 26)
  // 言葉：appeal_words.word 3件まで（word は既に短い）
  const wordVals = appealWords.slice(0, 4).map((w) => hardCut(w.word, 10))
  const wordVal  = safeJoin(wordVals, '・', 26)
  // 価値：demand_points.label or copyworthy_phrases[0] を cleanLabel
  const valueRaw = demandPoints[0]?.label || ratingPoints[0]?.copyworthy_phrases?.[0] || null
  const valueVal = hardCut(cleanLabel(valueRaw, 26), 26)

  const bullets = [
    bul('強み', strengthVal),
    bul('言葉', wordVal),
    bul('価値', valueVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary: safeEmbed で安全確認 ---
  const sl = safeEmbed(ratingPoints[0]?.label, 18)
  const wl = safeEmbed(appealWords[0]?.word,   14)
  const summary = sl
    ? `自社の強みは「${sl}」にある`
    : wl
    ? `「${wl}」など独自の訴求ワードが強み`
    : strengthVal
    ? `${hardCut(strengthVal, 20)}が自社の差別化ポイント`
    : '自社レビューから強みを整理しました'

  // --- key_message ---
  const km = appealWords[0]?.word
    ? `${hardCut(appealWords[0].word, 16)}を主軸にした訴求が有効`
    : demandPoints[0]?.label
    ? `${hardCut(cleanLabel(demandPoints[0].label, 18), 18)}を前面に打ち出す`
    : undefined
  const key_message = hardCut(km, 44) || undefined

  return {
    title:    'Company — 自社',
    summary:  hardCut(summary, 60),
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
  const appealWords      = (analysis.appeal_words       ?? []) as AppealWord[]

  const highInsights = insights.filter((i) => i.priority === 'high')

  // 捨てる：avoid_appeals.appeal を cleanLabel して2件まで
  const avoidVals = avoidAppeals.slice(0, 3).map((aa) => cleanLabel(aa.appeal, 12))
  const avoidVal  = safeJoin(avoidVals, '・', 26)

  // 打ち出す：appeal_words.word or demand_points.label 3件まで
  const pushItems = appealWords.length
    ? appealWords.slice(0, 4).map((w) => hardCut(w.word, 10))
    : demandPoints.slice(0, 3).map((dp) => cleanLabel(dp.label, 12))
  const pushVal = safeJoin(pushItems, '・', 26)

  // 施策：チャネル推定による固定句（raw insight テキストをそのまま使わない）
  const channelVal = (insights.length + highInsights.length > 0)
    ? inferChannel(insights)
    : null

  const bullets = [
    bul('捨てる',   avoidVal),
    bul('打ち出す', pushVal),
    bul('施策',     channelVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary: safeEmbed で安全確認 ---
  const avoidL = safeEmbed(avoidAppeals[0]?.appeal,                       12)
  const pushL  = safeEmbed(appealWords[0]?.word || demandPoints[0]?.label, 12)
  const summary = avoidL && pushL
    ? `${avoidL}訴求を捨て、${pushL}へ転換する`
    : avoidL
    ? `${avoidL}訴求を捨て、強みを前面に打ち出す`
    : pushL
    ? `${pushL}を中心に据えた訴求へ転換する`
    : '勝ち筋となる訴求軸を整理しました'

  // --- key_message ---
  const kmAction = highInsights[0]?.suggested_action
    ? hardCut(highInsights[0].suggested_action, 44)
    : null
  const kmDemand = demandPoints[0]?.marketing_use
    ? hardCut(demandPoints[0].marketing_use, 44)
    : null
  const key_message = hardCut(kmAction ?? kmDemand ?? undefined, 44) || undefined

  return {
    title:    'Winning Strategy — 勝ち筋',
    summary:  hardCut(summary, 60),
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
 * テンプレート埋め込み文字列は safeEmbed() で助詞末チェック済み。
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
