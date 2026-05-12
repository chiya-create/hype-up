-- migration 008: Step 51 — 求められているポイント / 想起シーン / 捨てるべき訴求
-- 追加日: 2026-05-11

ALTER TABLE project_analyses
  ADD COLUMN IF NOT EXISTS demand_points     jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS occasion_insights jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS avoid_appeals     jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN project_analyses.demand_points     IS '求められているポイント: 購買前に顧客が強く求めていた機能・属性 (Step 51)';
COMMENT ON COLUMN project_analyses.occasion_insights IS '想起シーン: 商品を思い出す・欲しくなる具体的な生活シーン (Step 51)';
COMMENT ON COLUMN project_analyses.avoid_appeals     IS '捨てるべき訴求: レビューから逆算した逆効果な訴求 (Step 51)';
