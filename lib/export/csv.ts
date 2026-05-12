import type {
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
} from '@/types/analysis'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** セルを CSV 安全な文字列にエスケープする */
function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // ダブルクォートを含む場合、またはカンマ・改行を含む場合はクォートで囲む
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(esc).join(',')
}

/** UTF-8 BOM + ヘッダー行 + データ行を結合して返す */
function buildCsv(header: string[], rows: string[]): string {
  const BOM = '﻿'
  const lines = [header.map(esc).join(','), ...rows]
  return BOM + lines.join('\r\n')
}

/** ファイル名に使えない文字を除去して安全な文字列にする */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50)
}

// ---------------------------------------------------------------------------
// 個別 CSV 生成関数
// ---------------------------------------------------------------------------

export function generateRatingPointsCsv(items: RatingPoint[]): string {
  const header = ['評価ポイント', '件数', '代表レビュー', '広告・LPに使える表現']
  const rows = items.map((item) =>
    row(
      item.label,
      item.count,
      item.examples.join(' / '),
      item.copyworthy_phrases.join(' / ')
    )
  )
  return buildCsv(header, rows)
}

export function generateComplaintsCsv(items: Complaint[]): string {
  const header = ['不満点', '件数', '代表レビュー', 'FAQ案', 'LPで先回りして伝える内容']
  const rows = items.map((item) =>
    row(
      item.label,
      item.count,
      item.examples.join(' / '),
      item.faq_suggestion,
      item.lp_counter_suggestion
    )
  )
  return buildCsv(header, rows)
}

export function generatePurchaseReasonsCsv(items: PurchaseReason[]): string {
  const header = ['購入理由', '件数', '代表レビュー', '表層理由', '深層心理']
  const rows = items.map((item) =>
    row(
      item.label,
      item.count,
      item.examples.join(' / '),
      item.surface_reason,
      item.deep_psychology
    )
  )
  return buildCsv(header, rows)
}

export function generateCustomerTypesCsv(items: CustomerType[]): string {
  const header = ['顧客タイプ', '件数', '説明', '広告ターゲティングのヒント']
  const rows = items.map((item) =>
    row(item.label, item.count, item.description, item.ad_targeting_hint)
  )
  return buildCsv(header, rows)
}

export function generateAppealWordsCsv(items: AppealWord[]): string {
  const header = ['訴求ワード', 'スコア', '頻度', '文脈', '活用案']
  const rows = items.map((item) =>
    row(item.word, item.score, item.frequency, item.context, item.suggested_use)
  )
  return buildCsv(header, rows)
}

export function generateMarketingInsightsCsv(items: MarketingInsight[]): string {
  const PRIORITY_LABEL: Record<string, string> = {
    high: '高（今すぐ着手）',
    medium: '中（次フェーズ）',
    low: '低（中長期検討）',
  }
  const header = ['優先度', '示唆', '根拠', '推奨アクション']
  const rows = items.map((item) =>
    row(
      PRIORITY_LABEL[item.priority] ?? item.priority,
      item.insight,
      item.rationale,
      item.suggested_action
    )
  )
  return buildCsv(header, rows)
}

export function generateLpSuggestionsCsv(items: LpSuggestion[]): string {
  const header = ['セクション', '見出し', '本文', '根拠']
  const rows = items.map((item) =>
    row(item.section, item.headline, item.body, item.evidence)
  )
  return buildCsv(header, rows)
}

export function generateAdCopySuggestionsCsv(items: AdCopySuggestion[]): string {
  const header = ['媒体', '見出し', '本文', 'CTA', 'ターゲットペルソナ']
  const rows = items.map((item) =>
    row(item.platform, item.headline, item.body, item.cta, item.target_persona)
  )
  return buildCsv(header, rows)
}

export function generateContentIdeasCsv(items: ContentIdea[]): string {
  const header = ['フォーマット', 'タイトル', '切り口', 'コアメッセージ']
  const rows = items.map((item) =>
    row(item.format, item.title, item.angle, item.key_message)
  )
  return buildCsv(header, rows)
}

export function generateDemandPointsCsv(items: DemandPoint[]): string {
  const header = ['求められているポイント', '件数', '説明', '証拠フレーズ', 'LP・広告活用法']
  const rows = items.map((item) =>
    row(
      item.label,
      item.count,
      item.description,
      item.evidence_examples.join(' / '),
      item.marketing_use
    )
  )
  return buildCsv(header, rows)
}

export function generateOccasionInsightsCsv(items: OccasionInsight[]): string {
  const header = ['想起シーン', 'トリガー', '心理状態', '推奨メッセージ', '証拠フレーズ']
  const rows = items.map((item) =>
    row(
      item.occasion,
      item.trigger,
      item.customer_state,
      item.recommended_message,
      item.evidence_examples.join(' / ')
    )
  )
  return buildCsv(header, rows)
}

export function generateAvoidAppealsCsv(items: AvoidAppeal[]): string {
  const header = ['捨てるべき訴求（NG）', '逆効果な理由', 'リスク', '代替訴求']
  const rows = items.map((item) =>
    row(item.appeal, item.reason, item.risk, item.replacement_message)
  )
  return buildCsv(header, rows)
}

// ---------------------------------------------------------------------------
// all: セクション区切りで1ファイルに結合
// ---------------------------------------------------------------------------

interface AllCsvInput {
  rating_points: RatingPoint[]
  complaints: Complaint[]
  purchase_reasons: PurchaseReason[]
  customer_types: CustomerType[]
  appeal_words: AppealWord[]
  marketing_insights: MarketingInsight[]
  lp_suggestions: LpSuggestion[]
  ad_copy_suggestions: AdCopySuggestion[]
  content_ideas: ContentIdea[]
  demand_points?: DemandPoint[]
  occasion_insights?: OccasionInsight[]
  avoid_appeals?: AvoidAppeal[]
}

function stripBom(csv: string): string {
  return csv.startsWith('﻿') ? csv.slice(1) : csv
}

export function generateAllCsv(data: AllCsvInput): string {
  const BOM = '﻿'

  const sections: { title: string; csv: string }[] = [
    { title: '■ 評価ポイント', csv: generateRatingPointsCsv(data.rating_points) },
    { title: '■ 不満点', csv: generateComplaintsCsv(data.complaints) },
    { title: '■ 購入理由', csv: generatePurchaseReasonsCsv(data.purchase_reasons) },
    { title: '■ 顧客タイプ', csv: generateCustomerTypesCsv(data.customer_types) },
    { title: '■ 訴求ワード', csv: generateAppealWordsCsv(data.appeal_words) },
    { title: '■ マーケティング示唆', csv: generateMarketingInsightsCsv(data.marketing_insights) },
    { title: '■ LP改善案', csv: generateLpSuggestionsCsv(data.lp_suggestions) },
    { title: '■ 広告コピー案', csv: generateAdCopySuggestionsCsv(data.ad_copy_suggestions) },
    { title: '■ コンテンツアイデア', csv: generateContentIdeasCsv(data.content_ideas) },
    ...(data.demand_points && data.demand_points.length > 0
      ? [{ title: '■ 求められているポイント', csv: generateDemandPointsCsv(data.demand_points) }]
      : []),
    ...(data.occasion_insights && data.occasion_insights.length > 0
      ? [{ title: '■ 想起シーン', csv: generateOccasionInsightsCsv(data.occasion_insights) }]
      : []),
    ...(data.avoid_appeals && data.avoid_appeals.length > 0
      ? [{ title: '■ 捨てるべき訴求', csv: generateAvoidAppealsCsv(data.avoid_appeals) }]
      : []),
  ]

  const body = sections
    .map(({ title, csv }) => `${title}\r\n${stripBom(csv)}`)
    .join('\r\n\r\n')

  return BOM + body
}
