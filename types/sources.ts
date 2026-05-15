// =============================================================================
// types/sources.ts
// レビュー・口コミ自動収集機能 Phase 1 — 型定義
//
// 設計原則:
//   - ReviewSourceRow は DB の生行型。サーバーサイドのみ使用。
//   - ReviewSource は ReviewSourceRow から credentials を除外したクライアント安全型。
//     ⚠️ API レスポンスでは必ず ReviewSource（credentials 除外）を返すこと。
//   - NormalizedReview は全 Collector が返す共通型。分析パイプラインへの入力フォーマット。
//   - CollectorResult / SourcePreviewResult は lib/collectors/ 内でのみ使用。
//
// Phase 1 対応ソース:
//   csv_upload    : 既存 CSV アップロードのソース化（既存フロー改修）
//   rakuten_ichiba: 楽天市場口コミAPI
//   rakuten_travel: 楽天トラベルクチコミAPI
//   google_places : Google Places API (New)
//
// Phase 2 以降で追加予定:
//   tripadvisor   : Tripadvisor Content API v3
//   shopify       : Shopify Admin API + レビューアプリ連携
//   hotpepper     : ホットペッパーグルメAPI（飲食）
// =============================================================================

// ---------------------------------------------------------------------------
// SourceType
// ---------------------------------------------------------------------------

export const SOURCE_TYPES = [
  'csv_upload',
  'rakuten_ichiba',
  'rakuten_travel',
  'google_places',
  // Phase 2以降で追加:
  // 'tripadvisor',
  // 'shopify',
  // 'hotpepper',
] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  csv_upload:     'CSVアップロード',
  rakuten_ichiba: '楽天市場',
  rakuten_travel: '楽天トラベル',
  google_places:  'Googleマップ',
}

// ---------------------------------------------------------------------------
// ReviewSource 状態
// ---------------------------------------------------------------------------

export type ReviewSourceStatus =
  | 'active'       // 正常稼働中
  | 'paused'       // 一時停止（手動）
  | 'error'        // 収集エラーが発生中
  | 'pending_auth' // 認証待ち（Phase 2: OAuth フロー中）

// ---------------------------------------------------------------------------
// ReviewSourceRow — DB 生行型（サーバーサイドのみ使用）
// ---------------------------------------------------------------------------

/**
 * DB の review_sources テーブルの行型。
 * ⚠️ credentials フィールドを含むため、サーバーサイドのみで使用すること。
 *    クライアントへのレスポンスには ReviewSource（credentials 除外）を使用すること。
 */
export type ReviewSourceRow = {
  id:                   string
  organization_id:      string
  project_id:           string | null
  source_type:          SourceType
  source_id:            string | null
  source_url:           string | null
  display_name:         string
  /**
   * API 資格情報（Phase 2: Shopify OAuthトークン等）。
   * Phase 1 では未使用。使用時はアプリ層で AES-256-GCM 暗号化してから保存する。
   * ⚠️ フロントエンドには絶対に返さないこと。
   */
  credentials:          Record<string, string> | null
  sync_enabled:         boolean
  sync_interval_hours:  number | null
  last_synced_at:       string | null
  total_collected:      number
  status:               ReviewSourceStatus
  error_message:        string | null
  created_at:           string
  updated_at:           string
}

/**
 * クライアントへのレスポンスに使用する安全型。
 * ReviewSourceRow から credentials を除外したもの。
 * API レスポンスでは必ずこの型を使用すること。
 */
export type ReviewSource = Omit<ReviewSourceRow, 'credentials'>

// ---------------------------------------------------------------------------
// ReviewCollectionJob
// ---------------------------------------------------------------------------

export type CollectionJobStatus = 'pending' | 'running' | 'done' | 'error'

export type ReviewCollectionJob = {
  id:                string
  review_source_id:  string
  project_id:        string
  status:            CollectionJobStatus
  triggered_by:      'manual' | 'scheduled' | 'webhook'
  fetched_count:     number
  imported_count:    number
  skipped_dup_count: number
  skipped_err_count: number
  error_message:     string | null
  /** error_detail は platform_admin のみ参照する。クライアントへのレスポンスでは除外すること。 */
  error_detail?:     Record<string, unknown> | null
  started_at:        string | null
  completed_at:      string | null
  created_at:        string
}

// ---------------------------------------------------------------------------
// Collector 共通型（lib/collectors/ 内で使用）
// ---------------------------------------------------------------------------

/**
 * 全 Collector が返す正規化済みレビュー型。
 * 分析パイプライン（reviews INSERT → analysis_chunks → Claude API）への入力フォーマット。
 *
 * 設計原則:
 *   - body は Collector 側で空チェックして除外済みであること
 *   - reviewer は Collector 側で anonymizeReviewer() を通すこと
 *   - external_id は収集元でのユニークID（重複排除キー）。取得できない場合は null
 *   - title がある場合は lib/collectors/normalize.ts の mergeTitle() で body に結合する
 */
export interface NormalizedReview {
  body:          string          // レビュー本文（必須・空文字は除外済み）
  rating:        number | null   // 1–5 の整数 or null
  reviewer:      string | null   // anonymizeReviewer() 適用済みのニックネーム or null
  reviewed_at:   string | null   // 'YYYY-MM-DD' or null
  external_id:   string | null   // 収集元でのレビューID（重複排除キー）
  title:         string | null   // レビュータイトル（normalize で body に結合）
  helpful_count: number | null   // 参考になった数（分析には使用しない）
  source_label:  string          // UI/分析表示用ソースラベル（例: '楽天市場'）
}

/**
 * Collector の収集結果。
 * reviews は NormalizedReview[] として返す。
 * エラーは原則 errors に格納し、例外は致命的なケースのみ投げること。
 */
export interface CollectorResult {
  reviews:       NormalizedReview[]
  total_fetched: number        // ページング込みの取得総数（重複除去前）
  has_more:      boolean       // 続きがある場合 true（Phase 2: 差分同期で使用）
  next_cursor:   string | null // 次ページ取得用カーソル（Phase 2）
  errors:        string[]      // 非致命的なエラーメッセージ
}

/**
 * ソース追加前のプレビュー結果。
 * POST /api/projects/[id]/sources/preview のレスポンス型。
 *
 * ⚠️ 後続実装注意:
 *    preview API エンドポイント（POST /api/projects/[id]/sources/preview）には
 *    必ずプロジェクトのアクセス権限チェックを実装すること。
 *    具体的には getCurrentUserAccessContext() + プロジェクトの organization_id 一致確認。
 *    ソース登録は行わないが、外部 API を呼び出すため認証なし呼び出しを防ぐ必要がある。
 */
export interface SourcePreviewResult {
  display_name:      string              // Collector が解決した表示名
  source_id:         string              // 解決されたソース識別子
  estimated_count:   number | null       // 取得見込み件数（不明な場合 null）
  sample_reviews:    NormalizedReview[]  // 先頭3件程度のサンプル
  errors:            string[]
}

// ---------------------------------------------------------------------------
// API Request / Response 型
// ---------------------------------------------------------------------------

/**
 * POST /api/projects/[id]/sources
 * ソース登録リクエスト。
 */
export interface CreateSourceRequest {
  source_type:    SourceType
  source_url?:    string      // URL 入力型（楽天・Google）
  source_id?:     string      // ID 直接指定型（source_url と排他）
  display_name?:  string      // 省略時は Collector が自動解決
}

/**
 * POST /api/projects/[id]/sources のレスポンス。
 * credentials は含まない。
 */
export interface CreateSourceResponse {
  source: ReviewSource
}

/**
 * GET /api/projects/[id]/sources のレスポンス。
 */
export interface ListSourcesResponse {
  sources: ReviewSource[]
}

/**
 * POST /api/projects/[id]/sources/preview
 * プレビュー取得リクエスト（ソース登録は行わない）。
 *
 * ⚠️ 実装時注意: このエンドポイントにはプロジェクトアクセス権限チェックを必ず入れること。
 *    外部 API を呼び出すため、認証なし・組織外からの呼び出しを防ぐ必要がある。
 */
export interface SourcePreviewRequest {
  source_type:  SourceType
  source_url?:  string
  source_id?:   string
}

/**
 * POST /api/projects/[id]/sources/[sourceId]/collect
 * 収集ジョブ開始リクエスト。
 */
export interface CollectRequest {
  /** 最大取得件数。省略時は MAX_REVIEWS_PER_PROJECT から既存件数を引いた値を使用。 */
  max_reviews?: number
}

/**
 * POST /api/projects/[id]/sources/[sourceId]/collect のレスポンス。
 * Phase 1 では同期実行のため status は即時 'done' or 'error'。
 * Phase 2 で非同期化した際は 'running' も返る。
 */
export interface CollectResponse {
  job_id:         string
  status:         CollectionJobStatus
  imported_count: number
  skipped_count:  number
  message?:       string
}

/**
 * GET /api/projects/[id]/collection-jobs/[jobId] のレスポンス。
 * error_detail は platform_admin 以外には返さないこと。
 */
export interface CollectionJobResponse {
  job: Omit<ReviewCollectionJob, 'error_detail'>
}
