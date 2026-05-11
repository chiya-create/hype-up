/**
 * get-project-benchmark.ts
 *
 * aggregated_insights を service role client 経由で取得し、
 * buildIndustryBenchmark() を実行する server-only helper。
 *
 * 使用理由:
 *   aggregated_insights は platform_admin のみ SELECT 可（RLS 有効化後）。
 *   client ページ（createServerUserClient / anon key）では読めないため、
 *   このヘルパーが createServiceClient() を使って取得する。
 *
 * 呼び出し元:
 *   - app/projects/[id]/page.tsx
 *   - app/projects/[id]/one-pager/page.tsx
 *   - app/projects/[id]/report/page.tsx
 *   - app/api/projects/[id]/benchmark/route.ts
 */

import { createServiceClient } from '@/lib/supabase/service'
import { buildIndustryBenchmark, type IndustryBenchmark, type AggregatedInsightRow } from './benchmark'
import type { ProjectAnalysis } from '@/types/analysis'

export type { IndustryBenchmark }

/**
 * 業界ベンチマークを取得する。
 *
 * @param industry  プロジェクトの業界 ID（例: 'general', 'beauty'）
 * @param analysis  project_analyses のレコード（ProjectAnalysis 型）
 * @returns IndustryBenchmark — 集計結果。aggregated_insights が空の場合もエラーにはならず空の結果を返す。
 */
export async function getProjectBenchmark(
  industry: string,
  analysis: ProjectAnalysis
): Promise<IndustryBenchmark> {
  // service role で aggregated_insights を取得（RLS をバイパス）
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('aggregated_insights')
    .select('*')
    .eq('industry', industry ?? 'general')

  const aggInsights = (data ?? []) as AggregatedInsightRow[]

  return buildIndustryBenchmark({ industry: industry ?? 'general', analysis, aggregatedInsights: aggInsights })
}
