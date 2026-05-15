-- =============================================================================
-- 010_add_review_sources.sql
-- レビュー・口コミ自動収集機能 Phase 1 — DB schema
--
-- 概要:
--   review_sources       : 収集ソース設定（楽天市場・楽天トラベル・Google Places 等）
--   review_collection_jobs : 収集ジョブの実行履歴
--   reviews (ALTER)      : review_source_id / external_id / collected_at カラム追加
--
-- 設計方針:
--   - 既存 reviews テーブルへの追加はすべて NULL 許容で行う（既存データへの影響なし）
--   - 書き込み（INSERT/UPDATE/DELETE）は service role 経由のみ
--   - SELECT は同組織メンバーおよび platform_admin に許可
--   - credentials カラムは Phase 2 (Shopify OAuth 等) のために型として確保するが
--     Phase 1 では使用しない。API キーはサーバー環境変数で管理する。
--   - このファイルは idempotent（べき等）に設計されている
-- =============================================================================

-- =============================================================================
-- review_sources
-- =============================================================================

CREATE TABLE IF NOT EXISTS review_sources (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- project_id: NULL = 組織共通ソース（将来用）/ NOT NULL = プロジェクト専用ソース
  project_id      uuid        REFERENCES projects(id) ON DELETE SET NULL,

  -- SourceType: 'csv_upload' | 'rakuten_ichiba' | 'rakuten_travel' | 'google_places'
  -- Phase 2以降: 'tripadvisor' | 'shopify' | 'hotpepper' 等を追加予定
  source_type     text        NOT NULL,

  -- 収集元の識別子（楽天: "shopCode:itemCode" / 楽天トラベル: "hotelNo" / Google: "place_id"）
  source_id       text,

  -- ユーザーが入力した元URL（解析・表示目的。実際の収集は source_id を使用）
  source_url      text,

  -- UI 表示名（例: "楽天市場 ○○クリーム"）
  display_name    text        NOT NULL,

  -- API 資格情報（Phase 2: Shopify OAuth トークン等に使用）
  -- ⚠️ Phase 1 では未使用。使用時はアプリ層で AES-256-GCM 暗号化してから保存すること。
  -- ⚠️ フロントエンドには絶対に返さないこと（API レスポンスで credentials カラムを除外する）。
  credentials     jsonb,

  -- 定期同期設定（Phase 2: pg_cron / Edge Functions cron で使用）
  sync_enabled    boolean     NOT NULL DEFAULT false,
  sync_interval_hours int,    -- NULL = 手動のみ

  -- 同期状態
  last_synced_at  timestamptz,
  total_collected int         NOT NULL DEFAULT 0,  -- 累計収集件数（重複除く）

  -- ソースの状態管理
  -- 'active'       : 正常稼働中
  -- 'paused'       : 一時停止（手動）
  -- 'error'        : 収集エラーが発生中
  -- 'pending_auth' : 認証待ち（Phase 2: OAuth フロー中）
  status          text        NOT NULL DEFAULT 'active',
  error_message   text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE review_sources IS 'レビュー収集ソース設定。1プロジェクトに複数ソース登録可能。';
COMMENT ON COLUMN review_sources.credentials IS
  'Phase 2以降で使用（Shopify OAuthトークン等）。アプリ層でAES-256-GCM暗号化して保存。フロントエンドには返さないこと。';
COMMENT ON COLUMN review_sources.source_type IS
  'Phase 1: csv_upload / rakuten_ichiba / rakuten_travel / google_places';

-- =============================================================================
-- review_collection_jobs
-- =============================================================================

CREATE TABLE IF NOT EXISTS review_collection_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_source_id  uuid        NOT NULL REFERENCES review_sources(id) ON DELETE CASCADE,
  project_id        uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- ジョブ状態
  -- 'pending' : 作成済み・未開始
  -- 'running' : 実行中
  -- 'done'    : 完了（imported_count=0 でも done）
  -- 'error'   : 致命的エラーで中断
  status            text        NOT NULL DEFAULT 'pending',

  -- トリガー種別
  -- 'manual'    : ユーザーが UI から手動実行
  -- 'scheduled' : Phase 2: pg_cron / Edge Functions cron
  -- 'webhook'   : Phase 2: 外部 Webhook
  triggered_by      text        NOT NULL DEFAULT 'manual',

  -- 収集結果カウンタ
  fetched_count     int         NOT NULL DEFAULT 0,   -- API/ファイルから取得した生件数
  imported_count    int         NOT NULL DEFAULT 0,   -- reviews に新規 INSERT した件数（重複除く）
  skipped_dup_count int         NOT NULL DEFAULT 0,   -- 重複スキップ件数
  skipped_err_count int         NOT NULL DEFAULT 0,   -- 変換エラースキップ件数

  -- エラー情報
  error_message     text,
  error_detail      jsonb,      -- スタックトレース等（platform_admin 参照用）

  -- タイムスタンプ
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()

  -- ※ updated_at は不要（ジョブは pending→running→done/error と単方向に進む）
);

COMMENT ON TABLE review_collection_jobs IS '収集ジョブの実行履歴。書き込みは service role 経由のみ。';
COMMENT ON COLUMN review_collection_jobs.error_detail IS
  'スタックトレース等の詳細。platform_adminのデバッグ用。';

-- =============================================================================
-- reviews テーブルへの追加カラム
-- ※ ADD COLUMN IF NOT EXISTS で冪等性確保。NULL 許容で既存データへの影響なし。
-- =============================================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS review_source_id uuid
    REFERENCES review_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id      text,
  ADD COLUMN IF NOT EXISTS collected_at     timestamptz;

COMMENT ON COLUMN reviews.review_source_id IS
  '収集元ソースへの参照。CSVアップロード時も csv_upload ソースを登録して付与する。NULL = 旧来のCSVアップロード（移行前データ）。';
COMMENT ON COLUMN reviews.external_id IS
  '収集元でのレビューID（楽天: reviewId / Google: places/{id}/reviews/{id} 等）。同ソース内の重複排除キー。';
COMMENT ON COLUMN reviews.collected_at IS
  '収集実行日時。CSVアップロードの場合はアップロード日時を設定する。';

-- =============================================================================
-- Indexes
-- =============================================================================

-- review_sources: 組織・プロジェクト検索
CREATE INDEX IF NOT EXISTS review_sources_org_idx
  ON review_sources (organization_id);

CREATE INDEX IF NOT EXISTS review_sources_project_idx
  ON review_sources (project_id)
  WHERE project_id IS NOT NULL;

-- review_collection_jobs: ソース別・プロジェクト+ステータス別検索
CREATE INDEX IF NOT EXISTS review_collection_jobs_source_idx
  ON review_collection_jobs (review_source_id);

CREATE INDEX IF NOT EXISTS review_collection_jobs_project_status_idx
  ON review_collection_jobs (project_id, status);

-- reviews: ソース別検索
CREATE INDEX IF NOT EXISTS reviews_source_idx
  ON reviews (review_source_id)
  WHERE review_source_id IS NOT NULL;

-- 外部 ID による重複排除インデックス
-- 同一プロジェクト・同一ソース内での external_id ユニーク制約
-- NULL は UNIQUE 制約から除外（PostgreSQL 仕様: NULL = NULL は false）
CREATE UNIQUE INDEX IF NOT EXISTS reviews_source_external_uniq
  ON reviews (project_id, review_source_id, external_id)
  WHERE external_id IS NOT NULL AND review_source_id IS NOT NULL;

-- =============================================================================
-- updated_at trigger for review_sources
-- set_updated_at 関数は他のマイグレーションで定義済みの可能性があるため
-- CREATE OR REPLACE で冪等性を確保する
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_review_sources_updated_at ON review_sources;
CREATE TRIGGER set_review_sources_updated_at
  BEFORE UPDATE ON review_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS — Row Level Security
-- =============================================================================

ALTER TABLE review_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_collection_jobs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- review_sources: 同組織メンバーが SELECT/INSERT/UPDATE/DELETE 可
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "review_sources_select" ON review_sources;
CREATE POLICY "review_sources_select"
ON review_sources FOR SELECT
USING (
  public.is_platform_admin()
  OR organization_id = ANY(public.get_user_org_ids())
);

-- INSERT: 自組織にのみ作成可（API では service role 経由だが念のため設定）
DROP POLICY IF EXISTS "review_sources_insert" ON review_sources;
CREATE POLICY "review_sources_insert"
ON review_sources FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR public.user_belongs_to_org(organization_id)
);

DROP POLICY IF EXISTS "review_sources_update" ON review_sources;
CREATE POLICY "review_sources_update"
ON review_sources FOR UPDATE
USING (
  public.is_platform_admin()
  OR organization_id = ANY(public.get_user_org_ids())
);

DROP POLICY IF EXISTS "review_sources_delete" ON review_sources;
CREATE POLICY "review_sources_delete"
ON review_sources FOR DELETE
USING (
  public.is_platform_admin()
  OR organization_id = ANY(public.get_user_org_ids())
);

-- ---------------------------------------------------------------------------
-- review_collection_jobs: SELECT のみ許可
-- INSERT / UPDATE / DELETE は service role 経由のみ（ポリシー設定なし = service role pass）
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "collection_jobs_select" ON review_collection_jobs;
CREATE POLICY "collection_jobs_select"
ON review_collection_jobs FOR SELECT
USING (
  public.is_platform_admin()
  OR project_id IN (
    SELECT id FROM projects
    WHERE organization_id IS NULL
       OR organization_id = ANY(public.get_user_org_ids())
  )
);
