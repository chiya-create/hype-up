// =============================================================================
// Hype Up AI — Analysis Types
//
// 設計思想:
//   レビューを「分析結果」ではなく「次に取るべき施策」に変換する。
//   顧客の生の言葉を広告・LP・SNS投稿に転用できる形で抽出する。
//   不満点は商品改善だけでなく、訴求改善・FAQ改善にも転用する。
//   購買理由は表面的な理由と深層心理に分けて扱う。
// =============================================================================

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

export interface ParsedReviewRow {
  body: string
  rating: number | null
  reviewer: string | null
  reviewed_at: string | null
  source: string | null
  raw: Record<string, string>
}

// ---------------------------------------------------------------------------
// Claude への入力型 — チャンク分析で渡すレビュー情報
// ---------------------------------------------------------------------------

/** Claude のチャンク分析プロンプトに渡すレビュー単位の入力 */
export interface ReviewForAnalysis {
  id: string
  body: string
  rating?: number | null
  source?: string | null
  reviewer?: string | null
  reviewed_at?: string | null
}

// ---------------------------------------------------------------------------
// MVP 5軸 — マーケティング志向の型定義
// ---------------------------------------------------------------------------

/** 評価ポイント: 強みを広告・LP訴求に転用するための構造 */
export interface RatingPoint {
  label: string
  count: number
  /** そのまま広告・LP・SNS投稿に使える顧客の生の言葉 */
  examples: string[]
  /** ヘッドコピー・ボディコピー候補として抽出した印象的なフレーズ */
  copyworthy_phrases: string[]
}

/** 不満点: 商品改善だけでなく、FAQ改善・訴求改善にも転用する */
export interface Complaint {
  label: string
  count: number
  examples: string[]
  /** この不満に対するFAQ回答案（購入ページ・LP下部に掲載する想定） */
  faq_suggestion: string
  /** LPのどのセクションでこの不安を払拭すべきかの提案 */
  lp_counter_suggestion: string
}

/** 購買理由: 表面的な理由と深層心理を分けて扱う */
export interface PurchaseReason {
  label: string
  count: number
  examples: string[]
  /** 顧客が意識的に言語化している購入理由 */
  surface_reason: string
  /** 顧客が意識しない深層の動機・感情的ベネフィット */
  deep_psychology: string
}

/** 顧客タイプ: 広告ターゲティング・ペルソナ設計に転用する */
export interface CustomerType {
  label: string
  count: number
  description: string
  /** このペルソナへの広告ターゲティング・クリエイティブの方向性 */
  ad_targeting_hint: string
}

/** 訴求ワード: LP・広告・SNS投稿での活用方法を明示する */
export interface AppealWord {
  word: string
  /** 広告効果の高さ。レビュー頻度・感情強度・独自性を総合した 0–100 のスコア */
  score: number
  frequency: number
  /** レビュー内での使われ方・文脈 */
  context: string
  /** LP・広告・SNSのどこで使うと効果的か */
  suggested_use: string
}

// ---------------------------------------------------------------------------
// マーケティング施策出力
// ---------------------------------------------------------------------------

export interface MarketingInsight {
  insight: string
  rationale: string
  /** 優先度: high = 即実施推奨 / medium = 次フェーズ / low = 中長期検討 */
  priority: 'high' | 'medium' | 'low'
  /** 具体的に次に取るべきアクション */
  suggested_action: string
}

export interface LpSuggestion {
  section: string
  headline: string
  body: string
  /** この提案の根拠となったレビューの傾向・証拠 */
  evidence: string
}

export interface AdCopySuggestion {
  platform: string
  headline: string
  body: string
  cta: string
  /** このコピーが最も刺さる顧客タイプ */
  target_persona: string
}

export interface ContentIdea {
  format: string
  title: string
  angle: string
  /** コンテンツが伝えるべきコアメッセージ */
  key_message: string
}

// ---------------------------------------------------------------------------
// 将来追加予定の分析軸 (MVP では非表示・型のみ定義)
//
// 追加タイミング: Phase 2 以降で project_analyses の jsonb カラムとして格納
// ---------------------------------------------------------------------------

/** 購買トリガー: 「最後の一押し」になった具体的なきっかけ */
export interface PurchaseTrigger {
  trigger: string
  description: string
  frequency: number
  /** 広告の CTA・ラストクリック訴求に転用可能か */
  is_copyworthy: boolean
  ad_use_suggestion: string
}

/** 購入前不安: LP・FAQで払拭すべき懸念事項 */
export interface PrePurchaseAnxiety {
  anxiety: string
  category: 'price' | 'quality' | 'fit' | 'efficacy' | 'delivery' | 'other'
  frequency: number
  /** FAQエントリ案 */
  faq_answer_suggestion: string
  /** LPでの払拭方法 */
  lp_counter_suggestion: string
}

/** 感情的報酬: 購入後に得られる感情的ベネフィット */
export interface EmotionalReward {
  reward: string
  /** 喜び / 安心 / 誇り / 解放 / 変化 など */
  emotion_category: string
  frequency: number
  /** そのまま広告コピーに転用できる顧客の言葉 */
  copyworthy_phrase: string
}

/** リピート要因: LTV向上・CRM施策に転用する */
export interface RepeatDriver {
  driver: string
  frequency: number
  /** リピーター向けメール・LINE施策への転用案 */
  crm_suggestion: string
}

/** 摩擦点: 購入・継続を妨げる体験上の障壁 */
export interface FrictionPoint {
  friction: string
  category: 'packaging' | 'usage' | 'expectation_gap' | 'price' | 'delivery' | 'support' | 'other'
  frequency: number
  /** 商品・UX改善案 */
  product_improvement: string
  /** 訴求・説明改善案（商品は変えずに対応できるもの） */
  messaging_fix: string
}

/** 競合優位性: 差別化ポイントを広告訴求に転用する */
export interface CompetitiveEdge {
  edge: string
  frequency: number
  /** 競合比較広告・差別化訴求への転用案 */
  ad_copy_suggestion: string
}

/** 使える顧客の声: そのまま広告・SNS・LPに転用できる生のフレーズ */
export interface CopyworthyPhrase {
  phrase: string
  /** この発言が出た文脈 */
  context: string
  /** 推奨用途 */
  suggested_use: 'headline' | 'body_copy' | 'testimonial' | 'social_proof' | 'cta' | 'email_subject'
  /** 効果が高いと想定されるプラットフォーム */
  platform_fit: string[]
}

// ---------------------------------------------------------------------------
// Step 51: 追加3軸 — 求められているポイント / 想起シーン / 捨てるべき訴求
// ---------------------------------------------------------------------------

/** 求められているポイント (DemandPoint): 購買前に顧客が強く求めていた機能・属性 */
export interface DemandPoint {
  label: string
  count: number
  description: string
  /** 顧客が「これが決め手だった」と語る具体的な証拠フレーズ */
  evidence_examples: string[]
  /** LP・広告での活用方法 */
  marketing_use: string
}

/** 想起シーン (OccasionInsight): 商品を思い出す・欲しくなる具体的な生活シーン */
export interface OccasionInsight {
  occasion: string
  /** シーンが発生するトリガー（例: 朝のスキンケア中、友人の口コミを見た時） */
  trigger: string
  /** そのシーンでの顧客の心理状態 */
  customer_state: string
  /** このシーンに刺さるメッセージ訴求 */
  recommended_message: string
  evidence_examples: string[]
}

/** 捨てるべき訴求 (AvoidAppeal): レビューから逆算した「刺さらない・逆効果な」訴求 */
export interface AvoidAppeal {
  appeal: string
  /** なぜこの訴求が逆効果か */
  reason: string
  /** 採用した場合のリスク（例: 期待値を上げすぎて返品につながる） */
  risk: string
  /** 代わりに使うべき訴求 */
  replacement_message: string
}

/** 将来追加予定の分析軸をまとめたオブジェクト型 (MVP では未使用) */
export interface FutureAxes {
  purchase_triggers?: PurchaseTrigger[]
  pre_purchase_anxieties?: PrePurchaseAnxiety[]
  emotional_rewards?: EmotionalReward[]
  repeat_drivers?: RepeatDriver[]
  friction_points?: FrictionPoint[]
  competitive_edges?: CompetitiveEdge[]
  copyworthy_phrases?: CopyworthyPhrase[]
}

// ---------------------------------------------------------------------------
// チャンク単位の分析結果 (analysis_chunks に保存)
// ---------------------------------------------------------------------------

export interface ChunkAnalysisResult {
  rating_points: RatingPoint[]
  complaints: Complaint[]
  purchase_reasons: PurchaseReason[]
  customer_types: CustomerType[]
  appeal_words: AppealWord[]
  summary: string
}

// ---------------------------------------------------------------------------
// プロジェクト全体の分析結果 (project_analyses に保存)
// ---------------------------------------------------------------------------

export interface ProjectAnalysisResult {
  // MVP 5軸
  rating_points: RatingPoint[]
  complaints: Complaint[]
  purchase_reasons: PurchaseReason[]
  customer_types: CustomerType[]
  appeal_words: AppealWord[]
  // Step 51: 追加3軸
  demand_points: DemandPoint[]
  occasion_insights: OccasionInsight[]
  avoid_appeals: AvoidAppeal[]
  // 総評
  summary: string
  // マーケティング施策出力
  marketing_insights: MarketingInsight[]
  lp_suggestions: LpSuggestion[]
  ad_copy_suggestions: AdCopySuggestion[]
  content_ideas: ContentIdea[]
  // 将来拡張用 (MVP では null)
  future_axes: FutureAxes | null
  // Step 62: 3C分析
  strategy_3c?: Strategy3C | null
}

// ---------------------------------------------------------------------------
// Step 62: 3C分析 (Strategy3C)
// ---------------------------------------------------------------------------

/** 3C分析の1セクション（Customer / Competitor / Company / Winning Strategy） */
export interface Strategy3CSection {
  title: string
  /** 1文サマリー */
  summary: string
  /** 箇条書きポイント（最大5件） */
  bullets: string[]
  /** 強調表示するキーメッセージ（省略可） */
  key_message?: string
}

/** 3C分析全体 */
export interface Strategy3C {
  customer: Strategy3CSection
  competitor: Strategy3CSection
  company: Strategy3CSection
  winning_strategy: Strategy3CSection
}

// ---------------------------------------------------------------------------
// ステータス enum
// ---------------------------------------------------------------------------

export type ProjectStatus = 'pending' | 'analyzing' | 'done' | 'error'
export type ChunkStatus = 'pending' | 'processing' | 'done' | 'error'

// ---------------------------------------------------------------------------
// 競合比較 (comparison_reports)
// ---------------------------------------------------------------------------

/** 比較に渡す1プロジェクトのスナップショット */
export interface ComparisonProject {
  id: string
  name: string
  industry: string
  review_count: number
  rating_points: RatingPoint[]
  complaints: Complaint[]
  purchase_reasons: PurchaseReason[]
  customer_types: CustomerType[]
  appeal_words: AppealWord[]
}

/** 特定プロジェクトの勝てる訴求 */
export interface WinningAppeal {
  project_name: string
  appeal: string
  why_it_wins: string
  suggested_copy: string
}

/** 強み（project_name が null なら全プロジェクト共通） */
export interface ComparisonStrength {
  project_name: string | null
  label: string
  is_unique: boolean
  description: string
}

/** 弱み（改善余地のある要素） */
export interface ComparisonWeakness {
  project_name: string
  label: string
  description: string
  improvement_suggestion: string
}

/** 市場共通の不満（複数プロジェクトに共通） */
export interface SharedComplaint {
  label: string
  description: string
  affected_projects: string[]
}

/** 推奨アクション（project_name が null なら全プロジェクト向け） */
export interface ComparisonAction {
  project_name: string | null
  priority: 'high' | 'medium' | 'low'
  action: string
  rationale: string
}

/** Claude 比較分析の出力 */
export interface ComparisonResult {
  comparison_summary: string
  winning_appeals: WinningAppeal[]
  strengths: ComparisonStrength[]
  weaknesses: ComparisonWeakness[]
  shared_complaints: SharedComplaint[]
  recommended_actions: ComparisonAction[]
}

// ---------------------------------------------------------------------------
// DB 行型
// ---------------------------------------------------------------------------

export interface Project {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  review_count: number
  analysis_started_at: string | null
  analysis_completed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  project_id: string
  body: string
  rating: number | null
  reviewer: string | null
  reviewed_at: string | null
  source: string | null
  body_hash: string
  raw: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AnalysisChunk {
  id: string
  project_id: string
  chunk_index: number
  review_ids: string[]
  status: ChunkStatus
  rating_points: RatingPoint[] | null
  complaints: Complaint[] | null
  purchase_reasons: PurchaseReason[] | null
  customer_types: CustomerType[] | null
  appeal_words: AppealWord[] | null
  summary: string | null
  token_used: number | null
  raw_response: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ProjectAnalysis {
  id: string
  project_id: string
  rating_points: RatingPoint[]
  complaints: Complaint[]
  purchase_reasons: PurchaseReason[]
  customer_types: CustomerType[]
  appeal_words: AppealWord[]
  // Step 51: 追加3軸 (DB migration 008)
  demand_points: DemandPoint[] | null
  occasion_insights: OccasionInsight[] | null
  avoid_appeals: AvoidAppeal[] | null
  summary: string
  marketing_insights: MarketingInsight[]
  lp_suggestions: LpSuggestion[]
  ad_copy_suggestions: AdCopySuggestion[]
  content_ideas: ContentIdea[]
  future_axes: FutureAxes | null
  // Step 62: 3C分析
  strategy_3c?: Strategy3C | null
  total_tokens_used: number | null
  chunk_count: number
  raw_response: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
