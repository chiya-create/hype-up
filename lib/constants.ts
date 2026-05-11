// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/** Number of reviews sent to Claude API per chunk */
export const CHUNK_SIZE = 50

/**
 * MVP でのプロジェクトあたり最大レビュー件数。
 * Vercel の関数タイムアウト（maxDuration=300）内に収まる上限として設定。
 * 1,000 件 ÷ 50件/チャンク = 20 チャンク × ~10秒/チャンク ≒ 最大 200 秒。
 * 大規模分析（数千件以上）は将来の非同期ジョブキュー化（Inngest / Supabase Edge Functions）で対応予定。
 */
export const MAX_REVIEWS_PER_PROJECT = 1_000

/**
 * この件数を超えると分析に時間がかかる可能性がある旨をフォームで警告する閾値。
 */
export const WARNING_REVIEWS_THRESHOLD = 500

// ---------------------------------------------------------------------------
// Claude model
// ---------------------------------------------------------------------------

/** Default model for chunk-level analysis (cost-optimised) */
export const CLAUDE_CHUNK_MODEL = 'claude-haiku-4-5-20251001'

/** Model for synthesis + marketing output generation (higher quality) */
export const CLAUDE_SYNTHESIS_MODEL = 'claude-sonnet-4-6'

// ---------------------------------------------------------------------------
// Analysis axes
// ---------------------------------------------------------------------------

/**
 * MVP で表示する分析軸。
 * 将来軸 (FutureAxes) はここには含めず、types/analysis.ts の FutureAxes に定義する。
 */
export const MVP_AXES = [
  'rating_points',
  'complaints',
  'purchase_reasons',
  'customer_types',
  'appeal_words',
] as const

export type MvpAxis = (typeof MVP_AXES)[number]

/**
 * 将来追加予定の分析軸（Phase 2 以降）。
 * DB・プロンプト変更なしで有効化できるよう、types/analysis.ts の FutureAxes と対応させる。
 */
export const FUTURE_AXES = [
  'purchase_triggers',
  'pre_purchase_anxieties',
  'emotional_rewards',
  'repeat_drivers',
  'friction_points',
  'competitive_edges',
  'copyworthy_phrases',
] as const

export type FutureAxis = (typeof FUTURE_AXES)[number]

// ---------------------------------------------------------------------------
// Industry templates
// ---------------------------------------------------------------------------

export type IndustryId = 'cosmetics' | 'education' | 'hotel' | 'general'

export interface IndustryTemplate {
  id: IndustryId
  label: string
  description: string
  /** 分析時にプロンプトへ差し込む業界別の観点 */
  analysisFocus: string[]
  /** このカテゴリのレビューでよく言及される観点（参考情報） */
  commonReviewAspects: string[]
  /** 分析結果の活用ユースケース */
  marketingUseCases: string[]
}

export const INDUSTRY_TEMPLATES: Record<IndustryId, IndustryTemplate> = {
  cosmetics: {
    id: 'cosmetics',
    label: '美容・コスメ',
    description: 'スキンケア・メイク・ヘアケアなど美容製品のレビュー分析',
    analysisFocus: [
      '使用感・テクスチャー・香りなど感覚的なベネフィットを具体的に抽出する',
      '肌質（乾燥肌・敏感肌・混合肌など）別の評価差異に注目する',
      '使用前後の変化（before/after）に関する言及を重視する',
      '「続けやすさ」「リピート購入意向」に関する記述を評価する',
      '競合ブランドとの比較言及（百貨店ブランド・ドラッグストア品等）を拾う',
      'コスパ認識（高い・安い・価値がある）の文脈を正確に把握する',
    ],
    commonReviewAspects: ['保湿力', '伸び', '香り', '成分', 'コスパ', '肌への刺激', 'パッケージ'],
    marketingUseCases: [
      'LPビフォーアフターセクションの強化',
      '肌質別ターゲティング広告の訴求軸設計',
      '成分・処方の訴求コピー最適化',
      'リピーター向けCRM施策の設計',
    ],
  },
  education: {
    id: 'education',
    label: '英語スクール・教育',
    description: '英語学習・教育サービス・オンライン学習のレビュー分析',
    analysisFocus: [
      '学習成果・上達実感に関する具体的な記述を最重視する',
      '学習継続のモチベーション維持要因と離脱要因を明確に分ける',
      '講師・コーチの質・対応に関する評価を詳細に抽出する',
      '受講生の目的（ビジネス英語・旅行・試験対策・転職など）を分類する',
      '「始める前の不安」と「受講後の感想」のギャップを把握する',
      'オンライン・対面の学習形式に対する満足度の違いを拾う',
    ],
    commonReviewAspects: ['講師の質', '教材', 'スケジュール柔軟性', '価格', '上達実感', 'サポート体制'],
    marketingUseCases: [
      '無料体験→入会転換率向上のLP設計',
      '目的別（ビジネス・旅行・資格）ターゲティング訴求',
      '講師紹介コンテンツの強化ポイント抽出',
      '入会前不安を払拭するFAQページ改善',
    ],
  },
  hotel: {
    id: 'hotel',
    label: 'ホテル・観光・インバウンド',
    description: 'ホテル・旅館・観光施設のレビュー分析（インバウンド対応含む）',
    analysisFocus: [
      'チェックイン〜チェックアウトまでの体験を時系列で把握する',
      'スタッフの対応・ホスピタリティへの言及を特に重視する',
      '部屋の品質（清潔感・広さ・眺望・設備）と朝食・食事への評価を分離する',
      'リピート宿泊意向と友人・家族への推薦意向を拾う',
      'インバウンド旅行者（外国語レビュー含む）の視点・期待との差異に注目する',
      'ロケーション・アクセス・周辺観光との連携に関する評価を抽出する',
    ],
    commonReviewAspects: ['立地', 'スタッフ対応', '清潔感', '朝食', '部屋の広さ', 'アメニティ', 'コスパ'],
    marketingUseCases: [
      'OTA（楽天・じゃらん）プロフィール・写真改善',
      'インバウンド向け多言語LP・SNS訴求の最適化',
      'リピーター向けロイヤリティ施策の設計',
      'スタッフホスピタリティを前面に出した広告クリエイティブ制作',
    ],
  },
  general: {
    id: 'general',
    label: '汎用',
    description: '業界を問わない汎用レビュー分析',
    analysisFocus: [
      '製品・サービスの中核的なベネフィットを具体的に抽出する',
      '購入前の期待と使用後の実感のギャップを把握する',
      '継続利用・リピート購入を促す要因と阻害する要因を分ける',
      'コスパ認識（価格対価値）の文脈を正確に把握する',
    ],
    commonReviewAspects: ['品質', 'コスパ', '使いやすさ', '対応', '配送', 'パッケージ'],
    marketingUseCases: [
      'LP訴求軸の最適化',
      '広告クリエイティブの改善',
      'FAQ・サポートページの強化',
      '顧客ターゲティングの精緻化',
    ],
  },
}

export const INDUSTRY_IDS = Object.keys(INDUSTRY_TEMPLATES) as IndustryId[]

/** industry key（または「,」区切り複数キー）→ 日本語ラベル。「 / 」区切りで結合 */
export function getIndustryLabel(industry: string | null | undefined): string {
  if (!industry) return '—'
  if (industry.includes(',')) {
    return industry
      .split(',')
      .map((k) => INDUSTRY_TEMPLATES[k.trim() as IndustryId]?.label ?? k.trim())
      .join(' / ')
  }
  return INDUSTRY_TEMPLATES[industry as IndustryId]?.label ?? industry
}

// ---------------------------------------------------------------------------
// Multi-tenancy
// ---------------------------------------------------------------------------

export const DEFAULT_ORGANIZATION_NAME = 'Default Organization'

export const ORGANIZATION_ROLES = ['client_owner', 'client_member', 'platform_admin'] as const
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]

export const USAGE_EVENT_TYPES = [
  'csv_uploaded',
  'analysis_started',
  'analysis_completed',
  'report_exported',
  'pptx_exported',
  'comparison_created',
  'feedback_submitted',
] as const
export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number]
