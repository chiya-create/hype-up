-- ============================================================
-- Hype Up AI — Initial Schema
-- ============================================================

-- ------------------------------------------------------------
-- Enum types
-- ------------------------------------------------------------

CREATE TYPE project_status AS ENUM ('pending', 'analyzing', 'done', 'error');
CREATE TYPE chunk_status   AS ENUM ('pending', 'processing', 'done', 'error');

-- ------------------------------------------------------------
-- projects
-- ------------------------------------------------------------

CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT,
  status                project_status NOT NULL DEFAULT 'pending',
  review_count          INT NOT NULL DEFAULT 0,
  analysis_started_at   TIMESTAMPTZ,
  analysis_completed_at TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- reviews
-- ------------------------------------------------------------

CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  rating      INT CHECK (rating BETWEEN 1 AND 5),
  reviewer    TEXT,
  reviewed_at DATE,
  source      TEXT,
  body_hash   TEXT NOT NULL,   -- SHA-256 of body for dedup
  raw         JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- analysis_chunks
-- ------------------------------------------------------------

CREATE TABLE analysis_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chunk_index     INT NOT NULL,
  review_ids      UUID[] NOT NULL DEFAULT '{}',
  status          chunk_status NOT NULL DEFAULT 'pending',
  rating_points   JSONB,
  complaints      JSONB,
  purchase_reasons JSONB,
  customer_types  JSONB,
  appeal_words    JSONB,
  summary         TEXT,
  token_used      INT,
  raw_response    JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- project_analyses
-- ------------------------------------------------------------

CREATE TABLE project_analyses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rating_points       JSONB NOT NULL DEFAULT '[]',
  complaints          JSONB NOT NULL DEFAULT '[]',
  purchase_reasons    JSONB NOT NULL DEFAULT '[]',
  customer_types      JSONB NOT NULL DEFAULT '[]',
  appeal_words        JSONB NOT NULL DEFAULT '[]',
  summary             TEXT NOT NULL DEFAULT '',
  marketing_insights  JSONB NOT NULL DEFAULT '[]',
  lp_suggestions      JSONB NOT NULL DEFAULT '[]',
  ad_copy_suggestions JSONB NOT NULL DEFAULT '[]',
  content_ideas       JSONB NOT NULL DEFAULT '[]',
  total_tokens_used   INT,
  chunk_count         INT NOT NULL DEFAULT 0,
  raw_response        JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

-- reviews
CREATE INDEX idx_reviews_project_id
  ON reviews(project_id);

CREATE UNIQUE INDEX idx_reviews_project_body_hash
  ON reviews(project_id, body_hash);

-- analysis_chunks
CREATE INDEX idx_analysis_chunks_project_id
  ON analysis_chunks(project_id);

CREATE INDEX idx_analysis_chunks_status
  ON analysis_chunks(status);

-- project_analyses
CREATE UNIQUE INDEX idx_project_analyses_project_id
  ON project_analyses(project_id);

-- ------------------------------------------------------------
-- updated_at auto-update trigger
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_analysis_chunks
  BEFORE UPDATE ON analysis_chunks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_project_analyses
  BEFORE UPDATE ON project_analyses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
