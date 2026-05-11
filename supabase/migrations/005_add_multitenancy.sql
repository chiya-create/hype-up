-- =============================================================================
-- 005_add_multitenancy.sql
-- マルチテナント基盤の追加
-- 目的: クライアント組織ごとのデータ分離 + 運営側横断集計の両立
-- 注意: RLS / 認証は Phase 2 で追加。今回は DB 構造のみ。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. organizations テーブル
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  plan       TEXT        NOT NULL DEFAULT 'free',
  status     TEXT        NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Default Organization を作成（既存データのフォールバック先）
--    名前で識別できるよう固定名を使用
-- ---------------------------------------------------------------------------

INSERT INTO organizations (name, plan, status)
VALUES ('Default Organization', 'free', 'active')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. organization_members テーブル
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID,
  email           TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'member',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);

-- ---------------------------------------------------------------------------
-- 4. projects に organization_id を追加
--    nullable で追加 → 既存行を Default Org で埋める
-- ---------------------------------------------------------------------------

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE projects
SET organization_id = (
  SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1
)
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);

-- ---------------------------------------------------------------------------
-- 5. comparison_reports に organization_id を追加
-- ---------------------------------------------------------------------------

ALTER TABLE comparison_reports
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE comparison_reports
SET organization_id = (
  SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1
)
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_comparison_reports_organization_id ON comparison_reports(organization_id);

-- ---------------------------------------------------------------------------
-- 6. analysis_feedback に organization_id を追加
--    紐づく project / comparison_report から org_id を推定する
-- ---------------------------------------------------------------------------

ALTER TABLE analysis_feedback
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- project_analysis フィードバック: project_analyses → projects の org_id を参照
UPDATE analysis_feedback af
SET organization_id = (
  SELECT p.organization_id
  FROM project_analyses pa
  JOIN projects p ON p.id = pa.project_id
  WHERE pa.id = af.target_id
  LIMIT 1
)
WHERE af.target_type = 'project_analysis'
  AND af.organization_id IS NULL;

-- comparison_report フィードバック: comparison_reports の org_id を参照
UPDATE analysis_feedback af
SET organization_id = (
  SELECT cr.organization_id
  FROM comparison_reports cr
  WHERE cr.id = af.target_id
  LIMIT 1
)
WHERE af.target_type = 'comparison_report'
  AND af.organization_id IS NULL;

-- 推定できなかった残りは Default Org にフォールバック
UPDATE analysis_feedback
SET organization_id = (
  SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1
)
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_feedback_organization_id ON analysis_feedback(organization_id);

-- ---------------------------------------------------------------------------
-- 7. usage_logs テーブル
--    API 呼び出し・エクスポート等のイベントを記録する
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usage_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  token_used      INTEGER,
  metadata        JSONB       NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_organization_id ON usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_event_type     ON usage_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at     ON usage_logs(created_at);

-- ---------------------------------------------------------------------------
-- 8. aggregated_insights テーブル
--    クライアント生データを匿名化・集計した業界別インサイト蓄積
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aggregated_insights (
  id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  industry            TEXT      NOT NULL,
  insight_type        TEXT      NOT NULL,
  label               TEXT      NOT NULL,
  count               INTEGER   NOT NULL DEFAULT 0,
  examples_anonymized JSONB     NOT NULL DEFAULT '[]'::JSONB,
  confidence_score    NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (industry, insight_type, label)
);

CREATE INDEX IF NOT EXISTS idx_aggregated_insights_industry     ON aggregated_insights(industry);
CREATE INDEX IF NOT EXISTS idx_aggregated_insights_insight_type ON aggregated_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_aggregated_insights_label        ON aggregated_insights(label);

-- ---------------------------------------------------------------------------
-- 9. updated_at トリガー（冪等: CREATE OR REPLACE）
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- organizations
DROP TRIGGER IF EXISTS set_organizations_updated_at ON organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- organization_members
DROP TRIGGER IF EXISTS set_organization_members_updated_at ON organization_members;
CREATE TRIGGER set_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- aggregated_insights
DROP TRIGGER IF EXISTS set_aggregated_insights_updated_at ON aggregated_insights;
CREATE TRIGGER set_aggregated_insights_updated_at
  BEFORE UPDATE ON aggregated_insights
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
