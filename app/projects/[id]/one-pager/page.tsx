import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/permissions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import { OnePagerLayout } from '@/components/one-pager/OnePagerLayout'
import { SummaryBlock } from '@/components/one-pager/SummaryBlock'
import { OnePagerList } from '@/components/one-pager/OnePagerList'
import { PptxExportButton } from '@/components/one-pager/PptxExportButton'
import { GoogleSlidesExportButton } from '@/components/one-pager/GoogleSlidesExportButton'
import { getProjectBenchmark } from '@/lib/insights/get-project-benchmark'
import type {
  ProjectAnalysis,
  RatingPoint,
  Complaint,
  AppealWord,
  MarketingInsight,
  LpSuggestion,
  AdCopySuggestion,
  OccasionInsight,
  AvoidAppeal,
} from '@/types/analysis'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateSummary(text: string, max = 300): string {
  if (!text) return ''
  if (text.length <= max) return text
  // Try to cut at sentence boundary (。！？) within the limit
  const cutTarget = text.slice(0, max)
  const lastSentenceEnd = Math.max(
    cutTarget.lastIndexOf('。'),
    cutTarget.lastIndexOf('！'),
    cutTarget.lastIndexOf('？'),
  )
  if (lastSentenceEnd > max * 0.6) {
    return text.slice(0, lastSentenceEnd + 1)
  }
  return cutTarget.slice(0, max - 1) + '…'
}

export default async function ProjectOnePagerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireClientAccess()
  const { id } = await params
  const supabase = await createServerUserClient()

  const [{ data: project }, { data: analysisRow }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase
      .from('project_analyses')
      .select('*')
      .eq('project_id', id)
      .maybeSingle(),
  ])

  if (!project) notFound()
  if (project.organization_id !== null && project.organization_id !== ctx.activeOrganizationId) {
    notFound()
  }

  if (!analysisRow) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <p className="text-lg font-medium">1枚サマリーを作成できません</p>
          <p className="text-sm text-muted-foreground">分析が完了するとサマリーを表示できます。</p>
          <Link
            href={`/projects/${id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <ArrowLeft className="h-4 w-4" />
            プロジェクトへ戻る
          </Link>
        </div>
      </div>
    )
  }

  const analysis = analysisRow as unknown as ProjectAnalysis

  // データ選定
  const ratingPoints = (analysis.rating_points ?? []) as RatingPoint[]
  const complaints = (analysis.complaints ?? []) as Complaint[]
  const appealWords = (analysis.appeal_words ?? []) as AppealWord[]
  const insights = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const lpSuggestions = (analysis.lp_suggestions ?? []) as LpSuggestion[]
  const adCopies = (analysis.ad_copy_suggestions ?? []) as AdCopySuggestion[]
  const occasionInsights = (analysis.occasion_insights ?? []) as OccasionInsight[]
  const avoidAppeals = (analysis.avoid_appeals ?? []) as AvoidAppeal[]

  const highInsights = insights.filter((i) => i.priority === 'high')

  // 勝ち筋: rating_points 上位3件 + high priority insights
  const strengthItems: string[] = [
    ...ratingPoints.slice(0, 3).map((r) => `${r.label}（${r.count}件）`),
    ...highInsights.slice(0, 2).map((i) => i.insight),
  ]

  // 課題: complaints 上位3件
  const issueItems: string[] = complaints
    .slice(0, 3)
    .map((c) => `${c.label}（${c.count}件）`)

  // 訴求ワード: score 上位5件
  const appealItems: string[] = appealWords
    .slice(0, 5)
    .map((w) => `${w.word}（スコア ${w.score}）`)

  // LP/広告メッセージ: lp_suggestions + ad_copy_suggestions 上位
  const messageItems: string[] = [
    ...lpSuggestions.slice(0, 2).map((l) => `[LP] ${l.headline}`),
    ...adCopies.slice(0, 2).map((a) => `[${a.platform}] ${a.headline}`),
  ]

  // 次アクション: high priority を優先
  const actionItems: string[] = [
    ...highInsights.slice(0, 3).map((i) => i.suggested_action || i.insight),
    ...insights.filter((i) => i.priority === 'medium').slice(0, 2).map((i) => i.suggested_action || i.insight),
  ]

  // 業界ベンチマーク: aggregated_insights は service role 経由で取得（RLS 有効化後も anon key では読めない）
  const benchmark = await getProjectBenchmark(project.industry ?? 'general', analysis)
  const allBenchmarkItems = [
    ...benchmark.rating_points,
    ...benchmark.complaints,
    ...benchmark.purchase_reasons,
    ...benchmark.appeal_words,
  ]
  const uniqueItems = allBenchmarkItems.filter((i) => i.benchmark_level === 'unique').slice(0, 3)
  const benchmarkMemoItems = uniqueItems.length > 0
    ? uniqueItems
    : allBenchmarkItems.filter((i) => i.benchmark_level === 'common').slice(0, 3)

  const industryLabel =
    INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId]?.label ?? project.industry

  const meta = [
    { label: '業界', value: industryLabel },
    { label: 'レビュー', value: `${project.review_count.toLocaleString()} 件` },
    { label: '分析完了', value: formatDateTime(project.analysis_completed_at) },
    { label: '印刷日', value: new Date().toLocaleDateString('ja-JP') },
  ]

  return (
    <>
      {/* 戻るリンク (印刷時非表示) */}
      <div className="no-print max-w-[210mm] mx-auto px-8 pt-4 pb-0">
        <Link
          href={`/projects/${id}/report`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-muted-foreground')}
        >
          <ArrowLeft className="h-4 w-4" />
          レポートへ戻る
        </Link>
      </div>

      <OnePagerLayout
        title="レビュー分析サマリー"
        subtitle={project.name}
        meta={meta}
        actions={
          <>
            <GoogleSlidesExportButton />
            <PptxExportButton href={`/api/projects/${id}/export-pptx`} />
          </>
        }
      >
        <div className="space-y-3 one-pager-grid">
          {/* 結論サマリー */}
          <SummaryBlock title="結論サマリー" variant="conclusion">
            <p className="text-sm leading-relaxed">
              {truncateSummary(analysis.summary) || '該当データはありません'}
            </p>
          </SummaryBlock>

          {/* 2列グリッド */}
          <div className="grid grid-cols-2 gap-3 one-pager-grid">
            <SummaryBlock title="主要な勝ち筋（評価ポイント）" variant="strength">
              <OnePagerList items={strengthItems} maxItems={5} numbered />
            </SummaryBlock>

            <SummaryBlock title="主要な課題（不満点）" variant="issue">
              <OnePagerList items={issueItems} maxItems={3} numbered />
            </SummaryBlock>
          </div>

          {/* 2列グリッド */}
          <div className="grid grid-cols-2 gap-3 one-pager-grid">
            <SummaryBlock title="売れる訴求ワード" variant="strength">
              <OnePagerList items={appealItems} maxItems={5} />
            </SummaryBlock>

            <SummaryBlock title="LP / 広告で使うべきメッセージ" variant="conclusion">
              <OnePagerList items={messageItems} maxItems={4} />
            </SummaryBlock>
          </div>

          {/* 想起シーン × 推奨メッセージ */}
          {occasionInsights.length > 0 && (
            <div className="grid grid-cols-2 gap-3 one-pager-grid">
              <SummaryBlock title="想起シーン（Demand Moment）" variant="conclusion">
                <OnePagerList
                  items={occasionInsights.slice(0, 3).map((oi) => oi.occasion)}
                  maxItems={3}
                />
              </SummaryBlock>

              <SummaryBlock title="捨てるべき訴求 → 代替案" variant="issue">
                <OnePagerList
                  items={avoidAppeals.slice(0, 3).map(
                    (aa) => `${aa.appeal} → ${aa.replacement_message}`
                  )}
                  maxItems={3}
                />
              </SummaryBlock>
            </div>
          )}

          {/* 次アクション */}
          <SummaryBlock title="次に取るべきアクション" variant="action">
            <OnePagerList items={actionItems} maxItems={5} numbered />
          </SummaryBlock>

          {/* 業界比較メモ */}
          {benchmarkMemoItems.length > 0 && (
            <SummaryBlock title="業界比較メモ" variant="conclusion">
              <OnePagerList
                items={benchmarkMemoItems.map(
                  (i) =>
                    `${i.label}（${i.benchmark_level === 'unique' ? '差別化' : '業界共通'}・自社${i.project_count}件）`
                )}
                maxItems={3}
              />
            </SummaryBlock>
          )}

          {/* 免責 */}
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            本サマリーはアップロードされたレビューをもとにした分析結果です。最終的な施策判断は、商材特性・事業状況・追加調査と合わせてご判断ください。
          </p>
        </div>
      </OnePagerLayout>
    </>
  )
}
