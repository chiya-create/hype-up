CREATE TABLE IF NOT EXISTS comparison_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_ids uuid[]      NOT NULL,
  industry    text,
  title       text,
  comparison_summary  text,
  winning_appeals     jsonb NOT NULL DEFAULT '[]',
  strengths           jsonb NOT NULL DEFAULT '[]',
  weaknesses          jsonb NOT NULL DEFAULT '[]',
  shared_complaints   jsonb NOT NULL DEFAULT '[]',
  recommended_actions jsonb NOT NULL DEFAULT '[]',
  raw_response        jsonb,
  token_used          int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comparison_reports_project_ids_gin
  ON comparison_reports USING gin(project_ids);

CREATE INDEX IF NOT EXISTS comparison_reports_created_at_idx
  ON comparison_reports (created_at DESC);
