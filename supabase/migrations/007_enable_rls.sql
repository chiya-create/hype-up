-- =============================================================================
-- 007_enable_rls.sql
-- Row Level Security 有効化
--
-- 目的: organization_id によるデータ分離を DB レベルで担保する
--
-- 【重要】Supabase では auth schema に独自関数を作成できないため、
-- RLS helper functions は public schema に作成する。
-- Supabase 標準の auth.uid() はそのまま使用する（変更しない）。
--
-- このファイルは idempotent（べき等）に設計されている。
-- 再実行しても既存ポリシーを DROP してから CREATE し直すため安全。
-- =============================================================================

-- =============================================================================
-- Helper Functions（public schema）
-- =============================================================================

-- 既存関数を削除してから再作成（idempotent）
DROP FUNCTION IF EXISTS public.get_user_org_ids();
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP FUNCTION IF EXISTS public.user_belongs_to_org(UUID);

-- ユーザーが所属する organization_id の配列を返す
-- STABLE + SECURITY DEFINER でトランザクション内キャッシュが効く
-- COALESCE で NULL → {} に変換（ANY(NULL) が常に false になるのを防ぐ）
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT organization_id), '{}')
  FROM organization_members
  WHERE user_id = auth.uid()
$$;

-- ユーザーが platform_admin かどうか
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND role = 'platform_admin'
  )
$$;

-- ユーザーが指定 org に所属するかどうか（INSERT WITH CHECK 用）
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
  )
$$;

-- =============================================================================
-- organizations
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select"
ON organizations FOR SELECT
USING (
  public.is_platform_admin()
  OR id = ANY(public.get_user_org_ids())
);

-- INSERT / UPDATE / DELETE: service role のみ（クライアントから組織を直接作成・変更しない）

-- =============================================================================
-- organization_members
-- =============================================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- SELECT: 自分の行のみ / platform_admin は全件
-- メールが一致する未リンク行（user_id IS NULL）も自分で参照できる
-- NOTE: auth.email() を使う。(SELECT email FROM auth.users WHERE id = auth.uid()) は
--       authenticated ロールが auth.users を SELECT できないため使用不可。
DROP POLICY IF EXISTS "org_members_select" ON organization_members;
CREATE POLICY "org_members_select"
ON organization_members FOR SELECT
USING (
  public.is_platform_admin()
  OR user_id = auth.uid()
  OR (
    user_id IS NULL
    AND email = auth.email()
  )
);

-- UPDATE: 初回ログイン時の user_id 自動補完のみ許可
-- （招待メールで作成された行を自分の uid に紐付けるため）
-- NOTE: auth.email() を使う（同上）
DROP POLICY IF EXISTS "org_members_update_self" ON organization_members;
CREATE POLICY "org_members_update_self"
ON organization_members FOR UPDATE
USING (
  user_id IS NULL
  AND email = auth.email()
)
WITH CHECK (
  user_id = auth.uid()
);

-- INSERT / DELETE: service role のみ（招待・削除は管理者操作）

-- =============================================================================
-- projects
-- =============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select"
ON projects FOR SELECT
USING (
  public.is_platform_admin()
  OR organization_id IS NULL  -- レガシーレコード（移行期間中のみ）
  OR organization_id = ANY(public.get_user_org_ids())
);

-- INSERT: アップロード API は service role 経由だが、念のため anon key からも自組織なら許可
DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert"
ON projects FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR public.user_belongs_to_org(organization_id)
);

-- UPDATE: status 更新など（analyze API は service role 経由。念のため anon key も自組織は許可）
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update"
ON projects FOR UPDATE
USING (
  public.is_platform_admin()
  OR organization_id IS NULL
  OR organization_id = ANY(public.get_user_org_ids())
)
WITH CHECK (
  public.is_platform_admin()
  OR organization_id IS NULL
  OR public.user_belongs_to_org(organization_id)
);

-- DELETE: service role のみ（UI 削除機能は未実装）

-- =============================================================================
-- reviews
-- =============================================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select" ON reviews;
CREATE POLICY "reviews_select"
ON reviews FOR SELECT
USING (
  public.is_platform_admin()
  OR project_id IN (
    SELECT id FROM projects
    WHERE organization_id IS NULL
       OR organization_id = ANY(public.get_user_org_ids())
  )
);

-- INSERT: upload API は service role 経由。anon key からも自組織プロジェクトなら許可
DROP POLICY IF EXISTS "reviews_insert" ON reviews;
CREATE POLICY "reviews_insert"
ON reviews FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IS NULL
       OR organization_id = ANY(public.get_user_org_ids())
  )
);

-- UPDATE / DELETE: service role のみ

-- =============================================================================
-- analysis_chunks
-- =============================================================================

ALTER TABLE analysis_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analysis_chunks_select" ON analysis_chunks;
CREATE POLICY "analysis_chunks_select"
ON analysis_chunks FOR SELECT
USING (
  public.is_platform_admin()
  OR project_id IN (
    SELECT id FROM projects
    WHERE organization_id IS NULL
       OR organization_id = ANY(public.get_user_org_ids())
  )
);

-- INSERT / UPDATE: analyze API が service role 経由で行うため anon key ポリシー不要

-- =============================================================================
-- project_analyses
-- =============================================================================

ALTER TABLE project_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_analyses_select" ON project_analyses;
CREATE POLICY "project_analyses_select"
ON project_analyses FOR SELECT
USING (
  public.is_platform_admin()
  OR project_id IN (
    SELECT id FROM projects
    WHERE organization_id IS NULL
       OR organization_id = ANY(public.get_user_org_ids())
  )
);

-- INSERT / UPDATE: analyze API が service role 経由のため anon key ポリシー不要

-- =============================================================================
-- comparison_reports
-- =============================================================================

ALTER TABLE comparison_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comparison_reports_select" ON comparison_reports;
CREATE POLICY "comparison_reports_select"
ON comparison_reports FOR SELECT
USING (
  public.is_platform_admin()
  OR organization_id IS NULL
  OR organization_id = ANY(public.get_user_org_ids())
);

-- INSERT: compare API は service role 経由。anon key からも自組織なら許可（defense in depth）
DROP POLICY IF EXISTS "comparison_reports_insert" ON comparison_reports;
CREATE POLICY "comparison_reports_insert"
ON comparison_reports FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR organization_id IS NULL
  OR public.user_belongs_to_org(organization_id)
);

-- UPDATE / DELETE: service role のみ

-- =============================================================================
-- analysis_feedback
-- =============================================================================
-- NOTE: feedback API routes は createServerUserClient()（anon key + JWT）を使う。
--       INSERT と UPDATE の両方のポリシーが必要（upsert は両方チェックされる）。

ALTER TABLE analysis_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analysis_feedback_select" ON analysis_feedback;
CREATE POLICY "analysis_feedback_select"
ON analysis_feedback FOR SELECT
USING (
  public.is_platform_admin()
  OR organization_id IS NULL
  OR organization_id = ANY(public.get_user_org_ids())
);

DROP POLICY IF EXISTS "analysis_feedback_insert" ON analysis_feedback;
CREATE POLICY "analysis_feedback_insert"
ON analysis_feedback FOR INSERT
WITH CHECK (
  public.is_platform_admin()
  OR organization_id IS NULL
  OR public.user_belongs_to_org(organization_id)
);

-- UPDATE: upsert（onConflict）でも UPDATE ポリシーが必要
DROP POLICY IF EXISTS "analysis_feedback_update" ON analysis_feedback;
CREATE POLICY "analysis_feedback_update"
ON analysis_feedback FOR UPDATE
USING (
  public.is_platform_admin()
  OR organization_id IS NULL
  OR organization_id = ANY(public.get_user_org_ids())
)
WITH CHECK (
  public.is_platform_admin()
  OR organization_id IS NULL
  OR public.user_belongs_to_org(organization_id)
);

-- DELETE: service role のみ

-- =============================================================================
-- usage_logs
-- =============================================================================
-- NOTE: INSERT は lib/usage/log.ts が createServiceClient() 経由で行うため
--       anon key 向け INSERT ポリシーは不要。
--       SELECT は platform_admin のみ（/admin/usage で利用）。

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_logs_select_admin" ON usage_logs;
CREATE POLICY "usage_logs_select_admin"
ON usage_logs FOR SELECT
USING (
  public.is_platform_admin()
);

-- INSERT / UPDATE / DELETE: service role のみ（logUsageEvent() 経由）

-- =============================================================================
-- aggregated_insights
-- =============================================================================
-- NOTE: Step 38 で client ページの直接参照を廃止済み。
--       lib/insights/get-project-benchmark.ts が createServiceClient() 経由で取得。
--       platform_admin のみ SELECT 可。

ALTER TABLE aggregated_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aggregated_insights_select_admin" ON aggregated_insights;
CREATE POLICY "aggregated_insights_select_admin"
ON aggregated_insights FOR SELECT
USING (
  public.is_platform_admin()
);

-- INSERT / UPDATE: lib/insights/aggregate.ts が createServiceClient() 経由のため
-- anon key 向けポリシー不要

-- =============================================================================
-- 適用確認クエリ（コメントアウト済み — SQL Editor で個別実行する）
-- =============================================================================

-- RLS 有効テーブル一覧（全 10 テーブルが rowsecurity = true であること）
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;

-- ポリシー一覧
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- helper function 動作確認（ログイン済みセッションで実行）
-- SELECT public.get_user_org_ids();
-- SELECT public.is_platform_admin();
