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
const MAX_TOKENS_SYNTHESIS = 8_192

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

function extractJson(text: string): string {
  // ```json ... ``` ブロックを優先
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced?.[1]) return fenced[1]
  // フォールバック: 最初の { から最後の } まで
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) return text.slice(start, end + 1)
  throw new Error('レスポンスから JSON を抽出できませんでした')
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

  const jsonStr = extractJson(raw_text)
  const parsed: unknown = JSON.parse(jsonStr)
  const result = validateSynthesisResult(parsed)

  return { result, raw_text, tokens_used }
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
