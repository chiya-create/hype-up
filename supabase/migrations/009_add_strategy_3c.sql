-- 009_add_strategy_3c.sql
-- 3C分析結果を project_analyses に保存するためのカラム追加

alter table project_analyses
  add column if not exists strategy_3c jsonb not null default '{}'::jsonb;

comment on column project_analyses.strategy_3c is
  '3C分析結果（Customer/Competitor/Company/Winning Strategy）。初期値は空オブジェクト。アプリ側 buildStrategy3C() で生成。';
