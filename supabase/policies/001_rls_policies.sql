-- =============================================================================
-- 001_rls_policies.sql
-- RLS ポリシー設計書（参照用）
--
-- 実際の適用は supabase/migrations/007_enable_rls.sql で行う。
-- このファイルは設計意図の記録・レビュー用として管理する。
-- 内容は 007_enable_rls.sql と同期している。
--
-- 最終更新: Step 39（auth schema → public schema 修正）
-- =============================================================================

-- =============================================================================
-- 【重要】Supabase における helper function のスキーマ方針
-- =============================================================================
--
-- Supabase の auth schema はマネージドであり、独自関数を作成できない。
-- → RLS helper functions は必ず public schema に作成する。
-- → Supabase 標準の auth.uid() はそのまま使用する（変更しない）。
--
-- NG: CREATE FUNCTION auth.get_user_org_ids() ...  ← permission denied for schema auth
-- OK: CREATE FUNCTION public.get_user_org_ids() ... ← 正しい

-- =============================================================================
-- Helper Functions（public schema）
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_user_org_ids();
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP FUNCTION IF EXISTS public.user_belongs_to_org(UUID);

-- ユーザーが所属する organization_id の配列を返す
-- COALESCE で NULL → {} に変換（ANY(NULL) が常に false になるのを防ぐ）
-- SET search_path = public でセキュリティリスクを軽減
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
-- ポリシー設計サマリー
-- =============================================================================
--
-- テーブル              | client SELECT        | client INSERT/UPDATE | 備考
-- ---------------------|----------------------|----------------------|------
-- organizations        | 自組織のみ           | ✗ service role のみ  |
-- organization_members | 自分の行のみ         | UPDATE: uid 補完のみ | 招待は service role
-- projects             | 自組織のみ           | 自組織のみ           | upload は service role
-- reviews              | 自組織 project のみ  | 自組織 project のみ  | upload は service role
-- analysis_chunks      | 自組織 project のみ  | ✗ service role のみ  | analyze は service role
-- project_analyses     | 自組織 project のみ  | ✗ service role のみ  | analyze は service role
-- comparison_reports   | 自組織のみ           | 自組織のみ           | compare は service role
-- analysis_feedback    | 自組織のみ           | 自組織のみ           | feedback API は anon+JWT
-- usage_logs           | ✗ platform_admin のみ| ✗ service role のみ  | logUsageEvent は service role
-- aggregated_insights  | ✗ platform_admin のみ| ✗ service role のみ  | Step 38 で client 直接参照廃止済み
--
-- platform_admin は全テーブルを SELECT 可能。
-- service role はすべての RLS をバイパスする。
--
-- NULL organization_id の扱い:
--    移行期間中に organization_id = NULL のレコードが残っている場合、
--    SELECT ポリシーに `OR organization_id IS NULL` 条件を追加している。
--    005_add_multitenancy.sql で大半は補完済みだが、適用前に NULL がないことを確認する。

-- =============================================================================
-- 各テーブルのポリシー（詳細は 007_enable_rls.sql を参照）
-- =============================================================================

-- organizations: 自組織 SELECT / platform_admin 全件
-- organization_members: 自分の行 SELECT（auth.email() で未リンク行も参照可）/ uid 補完 UPDATE
-- projects: 自組織 SELECT + INSERT + UPDATE
-- reviews: 自組織 project SELECT + INSERT
-- analysis_chunks: 自組織 project SELECT のみ
-- project_analyses: 自組織 project SELECT のみ
-- comparison_reports: 自組織 SELECT + INSERT
-- analysis_feedback: 自組織 SELECT + INSERT + UPDATE（upsert 対応）
-- usage_logs: platform_admin のみ SELECT
-- aggregated_insights: platform_admin のみ SELECT
