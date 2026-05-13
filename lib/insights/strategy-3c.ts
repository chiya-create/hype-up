/**
 * strategy-3c.ts
 *
 * 既存の分析結果（ProjectAnalysis + IndustryBenchmark）から
 * Claude APIを呼び出さずに3C分析を組み立てるヘルパー。
 *
 * 設計原則:
 *  - 省略記号「…」「...」を一切出さない
 *  - テンプレート埋め込みは safeEmbed / safeEmbedNoun で安全確認してから
 *  - summary ≤ 60 / bullet value ≤ 30 / key_message ≤ 44
 *  - bullets: 各カード最大3件
 *  - customer_type.label は normalizePersona() で自然な人物像に変換
 *  - avoid_appeal は categorizeAvoid() で戦略カテゴリ名に変換
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
// 基本ヘルパー
// ---------------------------------------------------------------------------

/** 省略記号なしハードカット */
function hardCut(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max)
}

/**
 * ラベルから冗長な助詞・接続句を除去し、短い名詞句にする。
 * 例: "〜としての即効性への期待値ギャップ" → "〜の即効性"
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
 * コロン（：/: ）以降を除去して前半部分だけ取り出す。
 * "産後ボディ悩み層：30代産後女性" → "産後ボディ悩み層"
 */
function stripSubLabel(s: string): string {
  const i = Math.min(
    s.indexOf('：') > 0 ? s.indexOf('：') : 9999,
    s.indexOf(':')  > 0 ? s.indexOf(':')  : 9999,
    s.indexOf('（') > 0 ? s.indexOf('（') : 9999,
    s.indexOf('(')  > 0 ? s.indexOf('(')  : 9999,
  )
  return i < 9999 ? s.slice(0, i).trim() : s
}

/**
 * テンプレートへの埋め込みに安全かチェック（汎用）。
 * 末尾が助詞・な形・括弧類の場合は null を返す。
 */
function safeEmbed(s: string | null | undefined, max = 14): string | null {
  if (!s) return null
  const c = hardCut(cleanLabel(s, max), max)
  if (!c || c.length < 2) return null
  if (/[をにはがでてもやとへのな・、。「」『』（）【】]$/.test(c)) return null
  return c
}

/**
 * 名詞位置（"〜へ転換する" など）専用の埋め込みチェック。
 * i形容詞末（〜い）も NG にする。
 */
function safeEmbedNoun(s: string | null | undefined, max = 14): string | null {
  const base = safeEmbed(s, max)
  if (!base) return null
  // i形容詞形（例: ベタつきが少ない、少ない、多い、高い）はNG
  if (/[いい]$/.test(base)) return null
  return base
}

/**
 * 複数要素を sep で結合し、max 文字以内に収まる範囲だけ結合（省略記号なし）。
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

/** 「ラベル：値」bullet。value が空なら null。 */
function bul(label: string, value: string | null | undefined, maxVal = 30): string | null {
  const v = hardCut(value, maxVal)
  return v ? `${label}：${v}` : null
}

// ---------------------------------------------------------------------------
// ドメイン変換ヘルパー
// ---------------------------------------------------------------------------

/**
 * customer_types.label を自然な人物像に変換。
 * ラベルに含まれるキーワードでパターンマッチし、読みやすい短句を返す。
 * マッチしない場合は cleanLabel + stripSubLabel で整形。
 */
function normalizePersona(label: string, description = ''): string {
  const text = `${label} ${description}`
  const patterns: [RegExp, string][] = [
    [/産後/,             '産後の女性'],
    [/立ち仕事/,          '立ち仕事の女性'],
    [/敏感肌/,           '敏感肌の女性'],
    [/乾燥肌/,           '乾燥肌の女性'],
    [/むくみ|浮腫/,       'むくみが気になる女性'],
    [/セルライト|凹凸/,   '体型変化を気にする女性'],
    [/継続|習慣|毎日/,    '継続ケアを求める女性'],
    [/美容意識|スキンケア/, '美容意識の高い女性'],
    [/男性|メンズ/,       'スキンケアを始めた男性'],
    [/高齢|シニア|50代|60代/, 'シニア世代の女性'],
  ]
  for (const [pattern, result] of patterns) {
    if (pattern.test(text)) return result
  }
  // フォールバック: サブラベル除去 → cleanLabel
  return hardCut(cleanLabel(stripSubLabel(label), 18), 18)
}

/**
 * avoid_appeal の appeal テキストを戦略カテゴリ名に変換。
 * "どんな敏感肌でも絶対大丈夫" → "過剰な安心訴求"
 */
function categorizeAvoid(appeal: string): string {
  const PATTERNS: [RegExp, string][] = [
    [/絶対|必ず|100%|完全に|誰でも必ず/,        '過剰な安心訴求'],
    [/どんな.*でも|誰でも.*(?:使|効|安)/,        '過剰な安心訴求'],
    [/すぐ消える?|即効|一瞬で|短期間で|\d+日で/,  '即効性訴求'],
    [/完全解消|根本から|完治|消える/,             '完全改善訴求'],
    [/副作用なし|ゼロリスク|絶対安全/,           '安全性過剰訴求'],
    [/安い|低価格|激安|最安/,                    '低価格訴求'],
    [/No\.?1|ナンバーワン|日本一|世界一/,        'No.1系強調訴求'],
    [/芸能人|モデル|有名人|セレブ/,              '権威性訴求'],
  ]
  for (const [pattern, result] of PATTERNS) {
    if (pattern.test(appeal)) return result
  }
  // マッチしない場合は短く整形
  return hardCut(cleanLabel(stripSubLabel(appeal), 12), 12)
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

  // 顧客像：normalizePersona で自然な人物像に変換（1件のみ）
  const typeVal = normalizePersona(
    customerTypes[0]?.label ?? '',
    customerTypes[0]?.description ?? '',
  )

  // 悩み：complaints.label を cleanLabel して2件まで結合
  const complaintVals = complaints.slice(0, 3).map((c) => cleanLabel(c.label, 12))
  const complaintVal  = safeJoin(complaintVals, '・', 26)

  // 欲求：purchase_reasons.label を cleanLabel して2件まで
  const reasonVals = purchaseReasons.slice(0, 2).map((pr) => cleanLabel(pr.label, 14))
  const reasonVal  = safeJoin(reasonVals, '・', 26)

  // 想起：occasion_insights.occasion 1件
  const occasionVal = hardCut(cleanLabel(occasionInsights[0]?.occasion, 22), 22)

  const bullets = [
    bul('顧客像', typeVal),
    bul('悩み',   complaintVal),
    bul('欲求',   reasonVal),
    bul('想起',   occasionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary: typeVal（normalizePersona済）+ complaintVal で自然文 ---
  const summaryType    = hardCut(typeVal, 16)          // 例: "産後の女性"
  const summaryIssue   = hardCut(complaintVal, 16)     // 例: "むくみ・凹凸"
  const summaryReason  = hardCut(reasonVal, 14)        // 例: "すっきりしたい"

  const summary = summaryType && summaryIssue
    ? `${summaryType}が、${summaryIssue}を気にしている`
    : summaryType && summaryReason
    ? `${summaryType}が、${summaryReason}と感じている`
    : summaryType
    ? `${summaryType}が主な顧客層`
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

  // 一般化：categorizeAvoid で戦略カテゴリ名に変換して2件まで
  const generalVals = avoidAppeals.length
    ? avoidAppeals.slice(0, 3).map((aa) => categorizeAvoid(aa.appeal))
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

  // 注意：avoid_appeals[0].risk/reason を cleanLabel
  const cautionRaw = avoidAppeals[0]?.risk || avoidAppeals[0]?.reason || ''
  const cautionVal = cautionRaw ? hardCut(cleanLabel(cautionRaw, 20), 20) : null

  const bullets = [
    bul('一般化', generalVal),
    bul('比較軸', compVal),
    bul('注意',   cautionVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary ---
  const al = safeEmbed(categorizeAvoid(avoidAppeals[0]?.appeal ?? ''), 16)
  const bl = safeEmbed(benchmark?.rating_points[0]?.label, 14)
  const summary = al
    ? `${al}は一般化し、差別化しづらい`
    : bl
    ? `${bl}では業界内で差別化が難しい`
    : generalVal
    ? (() => {
        // categorizeAvoid 結果は既に "〜訴求" 形なので重複を防ぐ
        const gv = hardCut(generalVal, 18)
        return gv.endsWith('訴求')
          ? `${gv}は一般化し、差別化しづらい`
          : `${gv}訴求は一般化し、差別化しづらい`
      })()
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
  // 言葉：appeal_words.word 3件まで
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

  // --- summary ---
  const sl = safeEmbed(ratingPoints[0]?.label, 18)
  const wl = safeEmbedNoun(appealWords[0]?.word, 14)
  const summary = sl
    ? `自社の強みは「${sl}」にある`
    : wl
    ? `「${wl}」など独自の訴求ワードが強み`
    : strengthVal
    ? `${hardCut(strengthVal, 20)}が自社の差別化ポイント`
    : '自社レビューから強みを整理しました'

  // --- key_message: "〜を主軸にした訴求が有効" — 名詞形のwordだけ使う ---
  // find() した値をそのまま使う（appealWords[0] を再評価すると null になる場合がある）
  const kmWord = appealWords.map((w) => safeEmbedNoun(w.word, 14)).find((v) => v != null) ?? null
  const km = kmWord
    ? `${kmWord}を主軸にした訴求が有効`
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

  // 捨てる：categorizeAvoid で変換して2件まで
  const avoidVals = avoidAppeals.slice(0, 3).map((aa) => categorizeAvoid(aa.appeal))
  const avoidVal  = safeJoin(avoidVals, '・', 26)

  // 打ち出す：appeal_words.word（名詞形のみ）or demand_points.label 3件まで
  const pushItems = appealWords.length
    ? appealWords.slice(0, 5)
        .map((w) => safeEmbedNoun(w.word, 10))
        .filter((v): v is string => v !== null)
    : demandPoints.slice(0, 3).map((dp) => cleanLabel(dp.label, 12))
  const pushVal = safeJoin(pushItems, '・', 26)

  // 施策：チャネル推定による固定句
  const channelVal = (insights.length > 0) ? inferChannel(insights) : null

  const bullets = [
    bul('捨てる',   avoidVal),
    bul('打ち出す', pushVal),
    bul('施策',     channelVal),
  ].filter(Boolean).slice(0, 3) as string[]

  // --- summary: avoidL（カテゴリ名）と pushL（名詞形）を使った自然文 ---
  const avoidL = safeEmbed(categorizeAvoid(avoidAppeals[0]?.appeal ?? ''), 12)
  // pushL: appeal_words から名詞形のものを優先探索
  const pushLRaw = appealWords.map((w) => safeEmbedNoun(w.word, 12)).find((v) => v != null)
    ?? (demandPoints[0]?.label ? safeEmbedNoun(cleanLabel(demandPoints[0].label, 12), 12) : null)

  // avoidL は categorizeAvoid 経由で既に "〜訴求" 形 → template に "訴求" を重ねない
  const summary = avoidL && pushLRaw
    ? `${avoidL}を捨て、${pushLRaw}へ転換する`
    : avoidL
    ? `${avoidL}を捨て、自社の強みを前面に打ち出す`
    : pushLRaw
    ? `${pushLRaw}を中心に据えた訴求へ転換する`
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
// 最終サニタイズ — 生成後の文字列を一括クリーン
// ---------------------------------------------------------------------------

/**
 * 個々の文字列フィールドを最終クリーン。
 * - "null" / "undefined" リテラルを除去
 * - "訴求訴求" → "訴求"（重複接尾語）
 * - "へを" → "を"
 * - "でせ" → "で"
 * - "絶対大丈…" を除去
 * - 前後空白トリム・連続空白を単一スペースに
 */
function sanitizeStr(s: string): string {
  return s
    .replace(/\bnull\b/g, '')
    .replace(/\bundefined\b/g, '')
    .replace(/訴求訴求/g, '訴求')
    .replace(/へを/g, 'を')
    .replace(/でせ/g, 'で')
    .replace(/絶対大丈\S*/g, '安心感')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function sanitizeSection(sec: Strategy3CSection): Strategy3CSection {
  return {
    ...sec,
    summary: sanitizeStr(sec.summary),
    bullets: sec.bullets.map(sanitizeStr).filter(Boolean),
    key_message: sec.key_message
      ? sanitizeStr(sec.key_message) || undefined
      : undefined,
  }
}

function sanitizeStrategy3C(s3c: Strategy3C): Strategy3C {
  return {
    customer:         sanitizeSection(s3c.customer),
    competitor:       sanitizeSection(s3c.competitor),
    company:          sanitizeSection(s3c.company),
    winning_strategy: sanitizeSection(s3c.winning_strategy),
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
  return sanitizeStrategy3C({
    customer:         buildCustomer(analysis),
    competitor:       buildCompetitor(analysis, benchmark),
    company:          buildCompany(analysis),
    winning_strategy: buildWinningStrategy(analysis),
  })
}
