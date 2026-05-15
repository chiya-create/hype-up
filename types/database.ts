// Typed stub until `supabase gen types typescript` is run against the real project.
// Must satisfy GenericSchema constraint from @supabase/supabase-js.
// NOTE: Row/Insert/Update must be `type` aliases (not `interface`) so TypeScript
//       resolves them as assignable to Record<string, unknown> in conditional types.
//
// Step 87-A: migration 010_add_review_sources
//   - ReviewRow / ReviewInsert に review_source_id / external_id / collected_at 追加
//   - ReviewSourceRow / ReviewCollectionJobRow 新規追加

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type ProjectStatus = 'pending' | 'analyzing' | 'done' | 'error'
export type ChunkStatus = 'pending' | 'processing' | 'done' | 'error'

// ---------------------------------------------------------------------------
// Row types  (type aliases — not interfaces)
// ---------------------------------------------------------------------------

// ── Multi-tenancy

type OrganizationRow = {
  id: string
  name: string
  plan: string
  status: string
  created_at: string
  updated_at: string
}

type OrganizationMemberRow = {
  id: string
  organization_id: string
  user_id: string | null
  email: string
  role: string
  created_at: string
  updated_at: string
}

// ── Core data (organization_id added for multi-tenancy)

type ProjectRow = {
  id: string
  name: string
  description: string | null
  industry: string
  status: ProjectStatus
  review_count: number
  analysis_started_at: string | null
  analysis_completed_at: string | null
  error_message: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
}

type ReviewRow = {
  id: string
  project_id: string
  body: string
  rating: number | null
  reviewer: string | null
  reviewed_at: string | null
  source: string | null
  body_hash: string
  raw: Json
  created_at: string
  updated_at: string
  // Step 87-A: migration 010_add_review_sources
  review_source_id: string | null  // review_sources.id への FK。旧来の CSV データは NULL。
  external_id:      string | null  // 収集元でのレビューID（重複排除キー）
  collected_at:     string | null  // 収集実行日時
}

type AnalysisChunkRow = {
  id: string
  project_id: string
  chunk_index: number
  review_ids: string[]
  status: ChunkStatus
  rating_points: Json | null
  complaints: Json | null
  purchase_reasons: Json | null
  customer_types: Json | null
  appeal_words: Json | null
  summary: string | null
  token_used: number | null
  raw_response: Json | null
  error_message: string | null
  created_at: string
  updated_at: string
}

type ProjectAnalysisRow = {
  id: string
  project_id: string
  rating_points: Json
  complaints: Json
  purchase_reasons: Json
  customer_types: Json
  appeal_words: Json
  summary: string
  marketing_insights: Json
  lp_suggestions: Json
  ad_copy_suggestions: Json
  content_ideas: Json
  // Step 51: migration 008
  demand_points: Json | null
  occasion_insights: Json | null
  avoid_appeals: Json | null
  total_tokens_used: number | null
  chunk_count: number
  raw_response: Json | null
  created_at: string
  updated_at: string
}

type ComparisonReportRow = {
  id: string
  project_ids: string[]
  industry: string | null
  title: string | null
  comparison_summary: string | null
  winning_appeals: Json
  strengths: Json
  weaknesses: Json
  shared_complaints: Json
  recommended_actions: Json
  raw_response: Json | null
  token_used: number | null
  organization_id: string | null
  created_at: string
}

type FeedbackRow = {
  id: string
  target_type: 'project_analysis' | 'comparison_report'
  target_id: string
  summary_quality: number | null
  insight_quality: number | null
  copy_quality: number | null
  action_quality: number | null
  pptx_quality: number | null
  overall_score: number | null
  notes: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
}

// ── Usage & Aggregation

type UsageLogRow = {
  id: string
  organization_id: string
  user_id: string | null
  project_id: string | null
  event_type: string
  token_used: number | null
  metadata: Json
  created_at: string
}

type AggregatedInsightRow = {
  id: string
  industry: string
  insight_type: string
  label: string
  count: number
  examples_anonymized: Json
  confidence_score: number | null
  created_at: string
  updated_at: string
}

// ── Review Sources (Step 87-A: migration 010_add_review_sources)

/**
 * review_sources テーブルの行型。
 * ⚠️ credentials フィールドを含むためサーバーサイドのみで使用すること。
 *    クライアントへのレスポンスでは credentials を除外した ReviewSource 型を使用する。
 *    詳細は types/sources.ts の ReviewSource を参照。
 */
type ReviewSourceRow = {
  id:                   string
  organization_id:      string
  project_id:           string | null
  source_type:          string  // 'csv_upload' | 'rakuten_ichiba' | 'rakuten_travel' | 'google_places' 等
  source_id:            string | null
  source_url:           string | null
  display_name:         string
  /** ⚠️ Phase 2 以降で使用。暗号化済み。フロントエンドには絶対に返さないこと。 */
  credentials:          Json    // { api_key: '...enc', access_token: '...enc' } 等
  sync_enabled:         boolean
  sync_interval_hours:  number | null
  last_synced_at:       string | null
  total_collected:      number
  status:               string  // 'active' | 'paused' | 'error' | 'pending_auth'
  error_message:        string | null
  created_at:           string
  updated_at:           string
}

/** review_collection_jobs テーブルの行型 */
type ReviewCollectionJobRow = {
  id:                string
  review_source_id:  string
  project_id:        string
  status:            string  // 'pending' | 'running' | 'done' | 'error'
  triggered_by:      string  // 'manual' | 'scheduled' | 'webhook'
  fetched_count:     number
  imported_count:    number
  skipped_dup_count: number
  skipped_err_count: number
  error_message:     string | null
  /** ⚠️ platform_admin のデバッグ用。クライアントへのレスポンスでは除外すること。 */
  error_detail:      Json    // スタックトレース等
  started_at:        string | null
  completed_at:      string | null
  created_at:        string
}

// ---------------------------------------------------------------------------
// Insert types — nullable columns are optional (match DB default behaviour)
// ---------------------------------------------------------------------------

// ── Multi-tenancy

type OrganizationInsert = {
  name: string
  plan?: string
  status?: string
}

type OrganizationMemberInsert = {
  organization_id: string
  email: string
  user_id?: string | null
  role?: string
}

// ── Core data

type ProjectInsert = {
  name: string
  description?: string | null
  industry?: string
  status?: ProjectStatus
  review_count?: number
  analysis_started_at?: string | null
  analysis_completed_at?: string | null
  error_message?: string | null
  organization_id?: string | null
}

type ReviewInsert = {
  project_id: string
  body: string
  body_hash: string
  raw: Json
  rating?: number | null
  reviewer?: string | null
  reviewed_at?: string | null
  source?: string | null
  // Step 87-A: migration 010_add_review_sources
  review_source_id?: string | null
  external_id?:      string | null
  collected_at?:     string | null
}

type AnalysisChunkInsert = {
  project_id: string
  chunk_index: number
  review_ids: string[]
  status?: ChunkStatus
  rating_points?: Json | null
  complaints?: Json | null
  purchase_reasons?: Json | null
  customer_types?: Json | null
  appeal_words?: Json | null
  summary?: string | null
  token_used?: number | null
  raw_response?: Json | null
  error_message?: string | null
}

type ProjectAnalysisInsert = {
  project_id: string
  rating_points: Json
  complaints: Json
  purchase_reasons: Json
  customer_types: Json
  appeal_words: Json
  summary: string
  marketing_insights: Json
  lp_suggestions: Json
  ad_copy_suggestions: Json
  content_ideas: Json
  // Step 51: migration 008
  demand_points?: Json | null
  occasion_insights?: Json | null
  avoid_appeals?: Json | null
  chunk_count: number
  total_tokens_used?: number | null
  raw_response?: Json | null
}

type ComparisonReportInsert = {
  project_ids: string[]
  industry?: string | null
  title?: string | null
  comparison_summary?: string | null
  winning_appeals?: Json
  strengths?: Json
  weaknesses?: Json
  shared_complaints?: Json
  recommended_actions?: Json
  raw_response?: Json | null
  token_used?: number | null
  organization_id?: string | null
}

type FeedbackInsert = {
  target_type: 'project_analysis' | 'comparison_report'
  target_id: string
  summary_quality?: number | null
  insight_quality?: number | null
  copy_quality?: number | null
  action_quality?: number | null
  pptx_quality?: number | null
  overall_score?: number | null
  notes?: string | null
  organization_id?: string | null
  updated_at?: string
}

// ── Usage & Aggregation

type UsageLogInsert = {
  organization_id: string
  event_type: string
  user_id?: string | null
  project_id?: string | null
  token_used?: number | null
  metadata?: Json
}

type AggregatedInsightInsert = {
  industry: string
  insight_type: string
  label: string
  count?: number
  examples_anonymized?: Json
  confidence_score?: number | null
  updated_at?: string
}

// ── Review Sources (Step 87-A: migration 010_add_review_sources)

type ReviewSourceInsert = {
  organization_id:     string
  display_name:        string
  source_type:         string
  project_id?:         string | null
  source_id?:          string | null
  source_url?:         string | null
  /** ⚠️ Phase 2以降で使用。アプリ層でAES-256-GCM暗号化してから保存すること。 */
  credentials?:        Json
  sync_enabled?:       boolean
  sync_interval_hours?: number | null
  last_synced_at?:     string | null
  total_collected?:    number
  status?:             string
  error_message?:      string | null
}

type ReviewCollectionJobInsert = {
  review_source_id:  string
  project_id:        string
  status?:           string
  triggered_by?:     string
  fetched_count?:    number
  imported_count?:   number
  skipped_dup_count?: number
  skipped_err_count?: number
  error_message?:    string | null
  error_detail?:     Json
  started_at?:       string | null
  completed_at?:     string | null
}

// ---------------------------------------------------------------------------
// Database schema — must satisfy GenericSchema from @supabase/supabase-js
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      // ── Multi-tenancy
      organizations: {
        Row: OrganizationRow
        Insert: OrganizationInsert
        Update: Partial<OrganizationInsert>
        Relationships: []
      }
      organization_members: {
        Row: OrganizationMemberRow
        Insert: OrganizationMemberInsert
        Update: Partial<OrganizationMemberInsert>
        Relationships: []
      }
      // ── Core data
      projects: {
        Row: ProjectRow
        Insert: ProjectInsert
        Update: Partial<ProjectInsert>
        Relationships: []
      }
      reviews: {
        Row: ReviewRow
        Insert: ReviewInsert
        Update: Partial<ReviewInsert>
        Relationships: []
      }
      analysis_chunks: {
        Row: AnalysisChunkRow
        Insert: AnalysisChunkInsert
        Update: Partial<AnalysisChunkInsert>
        Relationships: []
      }
      project_analyses: {
        Row: ProjectAnalysisRow
        Insert: ProjectAnalysisInsert
        Update: Partial<ProjectAnalysisInsert>
        Relationships: []
      }
      comparison_reports: {
        Row: ComparisonReportRow
        Insert: ComparisonReportInsert
        Update: Partial<ComparisonReportInsert>
        Relationships: []
      }
      analysis_feedback: {
        Row: FeedbackRow
        Insert: FeedbackInsert
        Update: Partial<FeedbackInsert>
        Relationships: []
      }
      // ── Usage & Aggregation
      usage_logs: {
        Row: UsageLogRow
        Insert: UsageLogInsert
        Update: Partial<UsageLogInsert>
        Relationships: []
      }
      aggregated_insights: {
        Row: AggregatedInsightRow
        Insert: AggregatedInsightInsert
        Update: Partial<AggregatedInsightInsert>
        Relationships: []
      }
      // ── Review Sources (Step 87-A: migration 010_add_review_sources)
      review_sources: {
        /**
         * ⚠️ Row 型は credentials フィールドを含む。
         *    クライアントへのレスポンスでは credentials を除外した
         *    ReviewSource 型（types/sources.ts）を使用すること。
         */
        Row: ReviewSourceRow
        Insert: ReviewSourceInsert
        Update: Partial<ReviewSourceInsert>
        Relationships: []
      }
      review_collection_jobs: {
        /**
         * ⚠️ Row 型は error_detail フィールドを含む（platform_admin 用）。
         *    クライアントへのレスポンスでは error_detail を除外すること。
         */
        Row: ReviewCollectionJobRow
        Insert: ReviewCollectionJobInsert
        Update: Partial<ReviewCollectionJobInsert>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      project_status: ProjectStatus
      chunk_status: ChunkStatus
    }
    CompositeTypes: Record<string, never>
  }
}
