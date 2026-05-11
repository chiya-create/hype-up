-- analysis_feedback: 分析結果に対するフィードバック（1-5星 × 6項目 + メモ）
-- target_type: 'project_analysis' or 'comparison_report'
-- target_id: project_analyses.id or comparison_reports.id

CREATE TABLE IF NOT EXISTS analysis_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     TEXT NOT NULL CHECK (target_type IN ('project_analysis', 'comparison_report')),
  target_id       UUID NOT NULL,
  summary_quality   INTEGER CHECK (summary_quality   BETWEEN 1 AND 5),
  insight_quality   INTEGER CHECK (insight_quality   BETWEEN 1 AND 5),
  copy_quality      INTEGER CHECK (copy_quality      BETWEEN 1 AND 5),
  action_quality    INTEGER CHECK (action_quality    BETWEEN 1 AND 5),
  pptx_quality      INTEGER CHECK (pptx_quality      BETWEEN 1 AND 5),
  overall_score     INTEGER CHECK (overall_score     BETWEEN 1 AND 5),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_type, target_id)
);
