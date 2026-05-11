-- Add industry column to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT 'general';

-- Backfill existing rows (already covered by DEFAULT, but explicit for clarity)
UPDATE projects SET industry = 'general' WHERE industry IS NULL;
