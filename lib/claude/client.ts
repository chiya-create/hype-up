import Anthropic from '@anthropic-ai/sdk'
import {
  CLAUDE_CHUNK_MODEL,
  CLAUDE_SYNTHESIS_MODEL,
} from '@/lib/constants'
import {
  buildChunkAnalysisPrompt,
  buildSynthesisPrompt,
  buildComparisonPrompt,
} from '@/lib/claude/prompts'
import type {
  ChunkAnalysisResult,
  ReviewForAnalysis,
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
  MarketingInsight,
  LpSuggestion,
  AdCopySuggestion,
  ContentIdea,
  DemandPoint,
  OccasionInsight,
  AvoidAppeal,
  ComparisonProject,
  ComparisonResult,
  WinningAppeal,
  ComparisonStrength,
  ComparisonWeakness,
  SharedComplaint,
  ComparisonAction,
} from '@/types/analysis'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TOKENS_CHUNK = 16_000
// Step 53: 8,192 → 16,000 に引き上げ。
// Step 51 で synthesis 出力が 7 配列になり、8,192 では日本語テキスト量次第で
// JSON truncation が発生していた（エラー位置 ~10,512 chars）。
const MAX_TOKENS_SYNTHESIS = 16_000

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ChunkAnalysisOutput {
  result: ChunkAnalysisResult
  raw_text: string
  tokens_used: number
}

export interface SynthesisOutput {
  result: {
    summary: string
    marketing_insights: MarketingInsight[]
    lp_suggestions: LpSuggestion[]
    ad_copy_suggestions: AdCopySuggestion[]
    content_ideas: ContentIdea[]
    demand_points: DemandPoint[]
    occasion_insights: OccasionInsight[]
    avoid_appeals: AvoidAppeal[]
  }
  raw_text: string
  tokens_used: number
}

export interface CompareOutput {
  result: ComparisonResult
  raw_text: string
  tokens_used: number
}

export type AggregatedAxes = {
  rating_points: RatingPoint[]
  complaints: Complaint[]
  purchase_reasons: PurchaseReason[]
  customer_types: CustomerType[]
  appeal_words: AppealWord[]
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY が設定されていません。.env.local を確認してください。'
    )
  }
  return new Anthropic({ apiKey })
}

function getChunkModel(): string {
  return process.env.CLAUDE_CHUNK_MODEL?.trim() || CLAUDE_CHUNK_MODEL
}

function getSynthesisModel(): string {
  return process.env.CLAUDE_SYNTHESIS_MODEL?.trim() || CLAUDE_SYNTHESIS_MODEL
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') {
    throw new Error('Claude レスポンスにテキストブロックがありません')
  }
  return block.text
}

/** Trailing comma（,} または ,]）を除去して JSON を修復する */
function removeTrailingCommas(json: string): string {
  // ,  の後に } か ] が続く（空白・改行を挟んでいてもよい）パターンを削除
  return json.replace(/,(\s*[}\]])/g, '$1')
}

/** truncation で末尾が壊れた JSON を可能な範囲で閉じて修復する */
function repairTruncatedJson(json: string): string {
  // 開き括弧の stack を追跡して不足している閉じ括弧を補う
  const stack: string[] = []
  let inString = false
  let escape = false
  for (let i = 0; i < json.length; i++) {
    const ch = json[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  // 不足分を末尾に追加（逆順）
  return json + stack.reverse().join('')
}

/** Claude レスポンスから JSON 文字列を抽出・修復する */
function extractJson(text: string): string {
  // Step 1: ``` フェンスを優先的に剥がす
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  let raw = fenced?.[1] ?? ''

  // Step 2: フェンスがない場合は最初の { から最後の } まで
  if (!raw) {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      raw = text.slice(start, end + 1)
    } else if (start !== -1) {
      // } が見つからない → truncation の可能性
      raw = text.slice(start)
    }
  }

  if (!raw) throw new Error('レスポンスから JSON を抽出できませんでした')

  // Step 3: まずそのまま parse を試みる
  try {
    JSON.parse(raw)
    return raw
  } catch {
    // Step 4: trailing comma を除去して再 parse
    const cleaned = removeTrailingCommas(raw)
    try {
      JSON.parse(cleaned)
      return cleaned
    } catch {
      // Step 5: truncation repair して再 parse
      const repaired = repairTruncatedJson(cleaned)
      try {
        JSON.parse(repaired)
        return repaired
      } catch (finalErr) {
        // 修復不能 — 呼び出し元でエラーハンドリングできるよう詳細を添付してスロー
        const preview = raw.slice(0, 200)
        const tail = raw.slice(-200)
        throw new Error(
          `JSON パース失敗（修復不能）: ${String(finalErr)}\n先頭200文字: ${preview}\n末尾200文字: ${tail}`
        )
      }
    }
  }
}

function toArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function toString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

// ---------------------------------------------------------------------------
// JSON validators — 必須キー確認・欠損補完
// ---------------------------------------------------------------------------

function validateChunkResult(parsed: unknown): ChunkAnalysisResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('チャンク分析レスポンスがオブジェクトではありません')
  }
  const p = parsed as Record<string, unknown>

  const normalizeRatingPoint = (item: unknown): RatingPoint => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      label: toString(i.label, '不明'),
      count: typeof i.count === 'number' ? i.count : 0,
      examples: toArray(i.examples),
      copyworthy_phrases: toArray(i.copyworthy_phrases),
    }
  }

  const normalizeComplaint = (item: unknown): Complaint => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      label: toString(i.label, '不明'),
      count: typeof i.count === 'number' ? i.count : 0,
      examples: toArray(i.examples),
      faq_suggestion: toString(i.faq_suggestion),
      lp_counter_suggestion: toString(i.lp_counter_suggestion),
    }
  }

  const normalizePurchaseReason = (item: unknown): PurchaseReason => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      label: toString(i.label, '不明'),
      count: typeof i.count === 'number' ? i.count : 0,
      examples: toArray(i.examples),
      surface_reason: toString(i.surface_reason),
      deep_psychology: toString(i.deep_psychology),
    }
  }

  const normalizeCustomerType = (item: unknown): CustomerType => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      label: toString(i.label, '不明'),
      count: typeof i.count === 'number' ? i.count : 0,
      description: toString(i.description),
      ad_targeting_hint: toString(i.ad_targeting_hint),
    }
  }

  const normalizeAppealWord = (item: unknown): AppealWord => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      word: toString(i.word, ''),
      score: typeof i.score === 'number' ? Math.min(100, Math.max(0, i.score)) : 0,
      frequency: typeof i.frequency === 'number' ? i.frequency : 0,
      context: toString(i.context),
      suggested_use: toString(i.suggested_use),
    }
  }

  return {
    rating_points: toArray(p.rating_points).map(normalizeRatingPoint),
    complaints: toArray(p.complaints).map(normalizeComplaint),
    purchase_reasons: toArray(p.purchase_reasons).map(normalizePurchaseReason),
    customer_types: toArray(p.customer_types).map(normalizeCustomerType),
    appeal_words: toArray(p.appeal_words).map(normalizeAppealWord),
    summary: toString(p.summary),
  }
}

function validateSynthesisResult(parsed: unknown): SynthesisOutput['result'] {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('統合分析レスポンスがオブジェクトではありません')
  }
  const p = parsed as Record<string, unknown>

  const normalizeInsight = (item: unknown): MarketingInsight => {
    const i = (item ?? {}) as Record<string, unknown>
    const priority = i.priority
    return {
      insight: toString(i.insight, ''),
      rationale: toString(i.rationale),
      priority:
        priority === 'high' || priority === 'medium' || priority === 'low'
          ? priority
          : 'medium',
      suggested_action: toString(i.suggested_action),
    }
  }

  const normalizeLp = (item: unknown): LpSuggestion => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      section: toString(i.section, ''),
      headline: toString(i.headline),
      body: toString(i.body),
      evidence: toString(i.evidence),
    }
  }

  const normalizeAd = (item: unknown): AdCopySuggestion => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      platform: toString(i.platform, ''),
      headline: toString(i.headline),
      body: toString(i.body),
      cta: toString(i.cta),
      target_persona: toString(i.target_persona),
    }
  }

  const normalizeContent = (item: unknown): ContentIdea => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      format: toString(i.format, ''),
      title: toString(i.title),
      angle: toString(i.angle),
      key_message: toString(i.key_message),
    }
  }

  const normalizeDemandPoint = (item: unknown): DemandPoint => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      label: toString(i.label, ''),
      count: typeof i.count === 'number' ? i.count : 0,
      description: toString(i.description),
      evidence_examples: toArray<string>(i.evidence_examples).map((e) => String(e)),
      marketing_use: toString(i.marketing_use),
    }
  }

  const normalizeOccasionInsight = (item: unknown): OccasionInsight => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      occasion: toString(i.occasion, ''),
      trigger: toString(i.trigger),
      customer_state: toString(i.customer_state),
      recommended_message: toString(i.recommended_message),
      evidence_examples: toArray<string>(i.evidence_examples).map((e) => String(e)),
    }
  }

  const normalizeAvoidAppeal = (item: unknown): AvoidAppeal => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      appeal: toString(i.appeal, ''),
      reason: toString(i.reason),
      risk: toString(i.risk),
      replacement_message: toString(i.replacement_message),
    }
  }

  return {
    summary: toString(p.summary),
    marketing_insights: toArray(p.marketing_insights).map(normalizeInsight),
    lp_suggestions: toArray(p.lp_suggestions).map(normalizeLp),
    ad_copy_suggestions: toArray(p.ad_copy_suggestions).map(normalizeAd),
    content_ideas: toArray(p.content_ideas).map(normalizeContent),
    demand_points: toArray(p.demand_points).map(normalizeDemandPoint),
    occasion_insights: toArray(p.occasion_insights).map(normalizeOccasionInsight),
    avoid_appeals: toArray(p.avoid_appeals).map(normalizeAvoidAppeal),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** チャンク分析: 50件前後のレビューをClaude APIで分析する */
export async function analyzeChunkWithClaude(
  reviews: ReviewForAnalysis[],
  industry = 'general'
): Promise<ChunkAnalysisOutput> {
  const client = getClient()
  const model = getChunkModel()
  const prompt = buildChunkAnalysisPrompt(reviews, industry)

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS_CHUNK,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw_text = extractText(response)
  const tokens_used =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

  const jsonStr = extractJson(raw_text)
  const parsed: unknown = JSON.parse(jsonStr)
  const result = validateChunkResult(parsed)

  return { result, raw_text, tokens_used }
}

/** 統合分析: 全チャンク結果を集約してマーケティング施策を生成する */
export async function synthesizeProjectAnalysisWithClaude(
  productName: string,
  productDescription: string | null,
  chunkSummaries: string[],
  aggregated: AggregatedAxes,
  industry = 'general'
): Promise<SynthesisOutput> {
  const client = getClient()
  const model = getSynthesisModel()
  const prompt = buildSynthesisPrompt(
    productName,
    productDescription,
    chunkSummaries,
    aggregated,
    industry
  )

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS_SYNTHESIS,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw_text = extractText(response)
  const tokens_used =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

  // extractJson は trailing comma 除去・truncation repair 済みの文字列を返す
  const jsonStr = extractJson(raw_text)
  const parsed: unknown = JSON.parse(jsonStr)
  const result = validateSynthesisResult(parsed)

  return { result, raw_text, tokens_used }
}

// ---------------------------------------------------------------------------
// Fallback synthesis — Claude API 失敗時にチャンク集計から最低限の結果を生成
// ---------------------------------------------------------------------------

/**
 * Claude synthesis が失敗した場合に、集計済みチャンクデータから
 * marketing_insights / lp_suggestions / ad_copy_suggestions / content_ideas /
 * demand_points / occasion_insights / avoid_appeals を生成する。
 */
export function buildFallbackSynthesisResult(
  aggregated: AggregatedAxes
): SynthesisOutput['result'] {
  const rp = aggregated.rating_points.slice(0, 3)
  const cp = aggregated.complaints.slice(0, 3)
  const pr = aggregated.purchase_reasons.slice(0, 3)
  const ct = aggregated.customer_types.slice(0, 3)
  const aw = aggregated.appeal_words.slice(0, 5)

  // marketing_insights: complaints / purchase_reasons から生成
  const marketing_insights: MarketingInsight[] = [
    ...cp.slice(0, 2).map((c): MarketingInsight => ({
      insight: `「${c.label}」への不満が ${c.count} 件確認されている`,
      rationale: 'この不満はLP・FAQ で事前に払拭しなければ購入後の低評価につながる',
      priority: 'high',
      suggested_action: `LP の FAQ セクションに「${c.label}」への対応策を明示する`,
    })),
    ...pr.slice(0, 1).map((r): MarketingInsight => ({
      insight: `購入理由「${r.label}」が ${r.count} 件確認されている`,
      rationale: 'この購入動機をファーストビューで訴求することでコンバージョンが向上する',
      priority: 'medium',
      suggested_action: `LP ヘッドラインに「${r.label}」を反映した訴求を追加する`,
    })),
  ].slice(0, 3)

  // lp_suggestions: complaints / rating_points から生成
  const lp_suggestions: LpSuggestion[] = [
    ...rp.slice(0, 2).map((r): LpSuggestion => ({
      section: 'ファーストビュー',
      headline: r.copyworthy_phrases?.[0] ?? r.label,
      body: `${r.label}を支持するレビューが ${r.count} 件集まっています。`,
      evidence: r.examples?.[0] ?? '',
    })),
    ...cp.slice(0, 1).map((c): LpSuggestion => ({
      section: 'FAQ',
      headline: `よくあるご不安: ${c.label}`,
      body: c.faq_suggestion || `${c.label}についてよくご質問いただきますが、詳しくご説明します。`,
      evidence: c.examples?.[0] ?? '',
    })),
  ].slice(0, 3)

  // ad_copy_suggestions: appeal_words / purchase_reasons から生成
  const platforms = ['Instagram', 'Meta', 'Google検索']
  const ad_copy_suggestions: AdCopySuggestion[] = [
    ...aw.slice(0, 2).map((w, i): AdCopySuggestion => ({
      platform: platforms[i] ?? 'Instagram',
      headline: w.word,
      body: `${w.context || w.word}を実感した方が多数います。`,
      cta: '詳しく見る',
      target_persona: ct[0]?.label ?? '購入検討中のユーザー',
    })),
    ...pr.slice(0, 1).map((_r): AdCopySuggestion => ({
      platform: platforms[2] ?? 'Google検索',
      headline: aw[0]?.word ?? rp[0]?.label ?? '',
      body: `${pr[0]?.label ?? ''}が決め手という声が多数。`,
      cta: '公式サイトへ',
      target_persona: ct[0]?.label ?? '購入検討中のユーザー',
    })),
  ].slice(0, 3)

  // content_ideas: customer_types / purchase_reasons から生成
  const formats = ['Instagram投稿', 'ブログ記事', 'リール']
  const content_ideas: ContentIdea[] = [
    ...ct.slice(0, 2).map((c, i): ContentIdea => ({
      format: formats[i] ?? 'Instagram投稿',
      title: `${c.label}に刺さる使い方`,
      angle: `${c.description || c.label}向けの体験談`,
      key_message: c.ad_targeting_hint || `${c.label}のリアルな声`,
    })),
    ...pr.slice(0, 1).map((_r): ContentIdea => ({
      format: formats[2] ?? 'リール',
      title: `選ばれる理由 TOP3`,
      angle: '購入理由ランキング形式で信頼感を醸成',
      key_message: pr[0]?.label ?? '選ばれ続ける理由',
    })),
  ].slice(0, 3)

  // demand_points: rating_points / purchase_reasons から生成
  const demand_points: DemandPoint[] = [
    ...rp.slice(0, 2).map((r): DemandPoint => ({
      label: r.label,
      count: r.count,
      description: `評価ポイントとして ${r.count} 件のレビューで言及されている`,
      evidence_examples: r.examples?.slice(0, 1) ?? [],
      marketing_use: `LP のベネフィットセクションで「${r.label}」を強調する`,
    })),
    ...pr.slice(0, 1).map((r): DemandPoint => ({
      label: r.label,
      count: r.count,
      description: r.surface_reason || `購入理由として ${r.count} 件に言及がある`,
      evidence_examples: r.examples?.slice(0, 1) ?? [],
      marketing_use: `ファーストビューの訴求軸に採用する`,
    })),
  ].slice(0, 3)

  // occasion_insights: purchase_reasons / customer_types から生成
  const occasion_insights: OccasionInsight[] = [
    ...pr.slice(0, 2).map((r): OccasionInsight => ({
      occasion: `${r.label}を意識した時`,
      trigger: r.surface_reason || r.label,
      customer_state: r.deep_psychology || '変化を求めている',
      recommended_message: r.label,
      evidence_examples: r.examples?.slice(0, 1) ?? [],
    })),
    ...ct.slice(0, 1).map((c): OccasionInsight => ({
      occasion: `${c.label}が商品を探しているとき`,
      trigger: c.description || c.label,
      customer_state: '解決策を求めている',
      recommended_message: c.ad_targeting_hint || `${c.label}向けの商品です`,
      evidence_examples: [],
    })),
  ].slice(0, 3)

  // avoid_appeals: complaints から生成
  const avoid_appeals: AvoidAppeal[] = cp.slice(0, 2).map((c): AvoidAppeal => ({
    appeal: `${c.label}を完全に解消できると謳う訴求`,
    reason: `レビューで「${c.label}」への不満が ${c.count} 件確認されており、過度な期待を持たせると返品・低評価につながる`,
    risk: '購入後の期待外れが低評価レビューの増加を招く',
    replacement_message: c.lp_counter_suggestion || `${c.label}については個人差があることを明示する`,
  }))

  const summary = `【fallback】チャンク分析完了。統合分析は自動生成されています。
評価ポイント: ${rp.map((r) => r.label).join('・') || 'なし'}。
主要不満: ${cp.map((c) => c.label).join('・') || 'なし'}。
再分析を実行するか、管理者にお知らせください。`

  return {
    summary,
    marketing_insights,
    lp_suggestions,
    ad_copy_suggestions,
    content_ideas,
    demand_points,
    occasion_insights,
    avoid_appeals,
  }
}

// ---------------------------------------------------------------------------
// Comparison validation
// ---------------------------------------------------------------------------

function validateComparisonResult(parsed: unknown): ComparisonResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('比較分析レスポンスがオブジェクトではありません')
  }
  const p = parsed as Record<string, unknown>

  const normalizeWinning = (item: unknown): WinningAppeal => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      project_name: toString(i.project_name, ''),
      appeal: toString(i.appeal, ''),
      why_it_wins: toString(i.why_it_wins),
      suggested_copy: toString(i.suggested_copy),
    }
  }

  const normalizeStrength = (item: unknown): ComparisonStrength => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      project_name: typeof i.project_name === 'string' ? i.project_name : null,
      label: toString(i.label, ''),
      is_unique: Boolean(i.is_unique),
      description: toString(i.description),
    }
  }

  const normalizeWeakness = (item: unknown): ComparisonWeakness => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      project_name: toString(i.project_name, ''),
      label: toString(i.label, ''),
      description: toString(i.description),
      improvement_suggestion: toString(i.improvement_suggestion),
    }
  }

  const normalizeShared = (item: unknown): SharedComplaint => {
    const i = (item ?? {}) as Record<string, unknown>
    return {
      label: toString(i.label, ''),
      description: toString(i.description),
      affected_projects: toArray<string>(i.affected_projects),
    }
  }

  const normalizeAction = (item: unknown): ComparisonAction => {
    const i = (item ?? {}) as Record<string, unknown>
    const priority = i.priority
    return {
      project_name: typeof i.project_name === 'string' ? i.project_name : null,
      priority:
        priority === 'high' || priority === 'medium' || priority === 'low'
          ? priority
          : 'medium',
      action: toString(i.action, ''),
      rationale: toString(i.rationale),
    }
  }

  return {
    comparison_summary: toString(p.comparison_summary),
    winning_appeals: toArray(p.winning_appeals).map(normalizeWinning),
    strengths: toArray(p.strengths).map(normalizeStrength),
    weaknesses: toArray(p.weaknesses).map(normalizeWeakness),
    shared_complaints: toArray(p.shared_complaints).map(normalizeShared),
    recommended_actions: toArray(p.recommended_actions).map(normalizeAction),
  }
}

/** 競合比較: 2〜3プロジェクトの分析データをClaude APIで比較する */
export async function compareProjectsWithClaude(
  projects: ComparisonProject[]
): Promise<CompareOutput> {
  const client = getClient()
  const model = getSynthesisModel()
  const prompt = buildComparisonPrompt(projects)

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS_SYNTHESIS,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw_text = extractText(response)
  const tokens_used =
    (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

  const jsonStr = extractJson(raw_text)
  const parsed: unknown = JSON.parse(jsonStr)
  const result = validateComparisonResult(parsed)

  return { result, raw_text, tokens_used }
}
