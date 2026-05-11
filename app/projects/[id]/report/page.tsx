import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, ArrowLeft, ChevronRight, FileText } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import { ReportSection } from '@/components/report/ReportSection'
import { InsightList } from '@/components/report/InsightList'
import { SuggestionCards } from '@/components/report/SuggestionCards'
import { MarkdownExportButton } from '@/components/report/MarkdownExportButton'
import { ExportActions } from '@/components/dashboard/ExportActions'
import { QualityCheckCard } from '@/components/dashboard/QualityCheckCard'
import { PrintButton } from '@/components/print/PrintButton'
import { PrintableHeader } from '@/components/print/PrintableHeader'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { getProjectBenchmark } from '@/lib/insights/get-project-benchmark'
import type {
  ProjectAnalysis,
  ProjectStatus,
  ChunkStatus,
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
  MarketingInsight,
  LpSuggestion,
  AdCopySuggestion,
  ContentIdea,
} from '@/types/analysis'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireClientAccess()
  const { id } = await params
  const supabase = await createServerUserClient()

  const [{ data: project }, { data: analysisRow }, { data: chunks }] =
    await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase
        .from('project_analyses')
        .select('*')
        .eq('project_id', id)
        .maybeSingle(),
      supabase
        .from('analysis_chunks')
        .select('id, status')
        .eq('project_id', id),
    ])

  if (!project) notFound()
  if (project.organization_id !== null && project.organization_id !== ctx.activeOrganizationId) {
    notFound()
  }

  if (!analysisRow) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <p className="text-lg font-medium">まだレポートを生成できません</p>
          <p className="text-sm text-muted-foreground">
            分析が完了するとレポートを表示できます。
          </p>
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
  const chunkList = chunks ?? []
  const chunkStats = {
    total: chunkList.length,
    done: chunkList.filter((c) => c.status === 'done').length,
    error: chunkList.filter((c) => c.status === 'error').length,
  }

  const ratingPoints = (analysis.rating_points ?? []) as RatingPoint[]
  const complaints = (analysis.complaints ?? []) as Complaint[]
  const purchaseReasons = (analysis.purchase_reasons ?? []) as PurchaseReason[]
  const customerTypes = (analysis.customer_types ?? []) as CustomerType[]
  const appealWords = (analysis.appeal_words ?? []) as AppealWord[]
  const insights = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const lpSuggestions = (analysis.lp_suggestions ?? []) as LpSuggestion[]
  const adCopies = (analysis.ad_copy_suggestions ?? []) as AdCopySuggestion[]
  const contentIdeas = (analysis.content_ideas ?? []) as ContentIdea[]
  const highInsights = insights.filter((ins) => ins.priority === 'high')

  // aggregated_insights は service role 経由で取得（RLS 有効化後も anon key では読めない）
  const benchmark = await getProjectBenchmark(project.industry ?? 'general', analysis)

  const projectMeta = {
    name: project.name,
    description: project.description,
    review_count: project.review_count,
    analysis_completed_at: project.analysis_completed_at,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="border-b bg-background sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-bold">Hype Up AI</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              href={`/projects/${id}`}
              className="text-sm text-muted-foreground hover:text-foreground truncate max-w-xs"
            >
              {project.name}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">レポート</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/projects/${id}/one-pager`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <FileText className="h-4 w-4" />
              1枚サマリー
            </Link>
            <PrintButton />
            <ExportActions projectId={id} hasAnalysis />
            <MarkdownExportButton
              project={projectMeta}
              analysis={analysis}
              chunkStats={chunkStats}
            />
            <Link
              href={`/projects/${id}`}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'gap-1.5'
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              ダッシュボードへ
            </Link>
          </div>
        </div>
      </header>

      {/* レポート本体 */}
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-14">
        <PrintableHeader
          title={project.name}
          industry={INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId]?.label}
          reviewCount={project.review_count}
          analysisDate={formatDateTime(project.analysis_completed_at)}
        />

        {/* ── タイトル */}
        <div className="space-y-3 pb-6 border-b">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Marketing Research Report
          </p>
          <h1 className="text-3xl font-bold leading-tight">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}

          {/* メタ情報グリッド */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <div>
              <p className="text-xs text-muted-foreground">レビュー件数</p>
              <p className="text-xl font-bold tabular-nums">
                {project.review_count.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">分析チャンク</p>
              <p className="text-xl font-bold tabular-nums">
                {chunkStats.done}
                <span className="text-sm font-normal text-muted-foreground">
                  /{chunkStats.total}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">分析完了</p>
              <p className="text-sm font-medium tabular-nums">
                {formatDateTime(project.analysis_completed_at)}
              </p>
            </div>
            {analysis.total_tokens_used != null && (
              <div>
                <p className="text-xs text-muted-foreground">使用トークン</p>
                <p className="text-sm font-medium tabular-nums">
                  {analysis.total_tokens_used.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── 業界テンプレート情報 */}
        {(() => {
          const tmpl = INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId] ?? INDUSTRY_TEMPLATES.general
          return (
            <div className="rounded-md bg-muted/50 border px-4 py-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">業界テンプレート</span>
                <span className="text-sm font-medium">{tmpl.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{tmpl.description}</p>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">分析で重視した観点</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                  {tmpl.analysisFocus.map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {f}</li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })()}

        {/* ── 品質チェック */}
        <div className="print:hidden">
          <h2 className="text-base font-semibold mb-3 text-muted-foreground">
            このレポートの品質チェック
          </h2>
          <QualityCheckCard analysis={analysis} projectId={id} />
        </div>

        {/* ── エグゼクティブサマリー */}
        <ReportSection
          title="エグゼクティブサマリー"
          description="AI が全レビューを読み込み、マーケティング視点で総合評価したサマリーです"
        >
          {analysis.summary ? (
            <p className="text-base leading-relaxed">{analysis.summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">該当データはありません</p>
          )}
        </ReportSection>

        {/* ── 評価ポイント */}
        <ReportSection
          title="主要な評価ポイント"
          description="顧客が高く評価している点。LP・広告訴求に転用できる強みです"
        >
          {ratingPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当データはありません</p>
          ) : (
            <div className="space-y-4">
              {ratingPoints.slice(0, 8).map((rp, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-2xl font-bold text-muted-foreground/30 tabular-nums shrink-0 w-8 text-right">
                    {i + 1}
                  </span>
                  <div className="space-y-1 flex-1 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{rp.label}</p>
                      <span className="text-xs text-muted-foreground">
                        {rp.count} 件
                      </span>
                    </div>
                    {rp.copyworthy_phrases.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {rp.copyworthy_phrases.map((phrase, j) => (
                          <Badge
                            key={j}
                            variant="secondary"
                            className="text-xs"
                          >
                            {phrase}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {rp.examples[0] && (
                      <p className="text-xs text-muted-foreground italic">
                        「{rp.examples[0]}」
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        {/* ── 不満点 */}
        <ReportSection
          title="主要な不満点"
          description="顧客が不満を感じている点。FAQ改善・LP改善に転用できます"
        >
          {complaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当データはありません</p>
          ) : (
            <div className="space-y-5">
              {complaints.slice(0, 8).map((c, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{c.label}</p>
                    <span className="text-xs text-muted-foreground">{c.count} 件</span>
                  </div>
                  <div className="pl-0 space-y-1">
                    {c.faq_suggestion && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">FAQ案:</span> {c.faq_suggestion}
                      </p>
                    )}
                    {c.lp_counter_suggestion && (
                      <p className="text-xs text-primary font-medium">
                        → LP改善: {c.lp_counter_suggestion}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        {/* ── 購入理由 */}
        <ReportSection
          title="購入理由"
          description="表面的な理由と深層心理を分けて把握することで、より刺さる訴求を作れます"
        >
          {purchaseReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当データはありません</p>
          ) : (
            <div className="space-y-5">
              {purchaseReasons.slice(0, 6).map((pr, i) => (
                <div key={i} className="grid sm:grid-cols-[auto_1fr_1fr] gap-2 sm:gap-4 items-start">
                  <span className="text-muted-foreground/40 font-bold text-lg tabular-nums">
                    {i + 1}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground">表面的な理由</p>
                    <p className="text-sm font-semibold">{pr.label}</p>
                    {pr.surface_reason && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {pr.surface_reason}
                      </p>
                    )}
                  </div>
                  {pr.deep_psychology && (
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-primary">深層心理</p>
                      <p className="text-xs leading-relaxed">{pr.deep_psychology}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        {/* ── 顧客タイプ */}
        <ReportSection
          title="顧客タイプ"
          description="広告ターゲティングやペルソナ設計に活用できます"
        >
          {customerTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当データはありません</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {customerTypes.map((ct, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{ct.label}</p>
                    <span className="text-xs text-muted-foreground">{ct.count} 件</span>
                  </div>
                  {ct.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ct.description}
                    </p>
                  )}
                  {ct.ad_targeting_hint && (
                    <p className="text-xs font-medium text-primary">
                      <ChevronRight className="inline h-3 w-3 mr-0.5" />
                      {ct.ad_targeting_hint}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        {/* ── 訴求ワード */}
        <ReportSection
          title="訴求ワード"
          description="スコアが高いほど広告・LP・SNSへの転用効果が高いと判断されたワードです"
        >
          {appealWords.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当データはありません</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                {appealWords.map((w, i) => {
                  const size =
                    w.score >= 80
                      ? 'text-2xl font-bold'
                      : w.score >= 60
                        ? 'text-xl font-semibold'
                        : w.score >= 40
                          ? 'text-base font-medium'
                          : 'text-sm text-muted-foreground'
                  return (
                    <span key={i} className={size} title={`スコア: ${w.score}`}>
                      {w.word}
                    </span>
                  )
                })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">ワード</th>
                      <th className="text-right py-2 pr-4 font-medium">スコア</th>
                      <th className="text-right py-2 pr-4 font-medium">頻度</th>
                      <th className="text-left py-2 font-medium">活用法</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appealWords.slice(0, 12).map((w, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-semibold">{w.word}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{w.score}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{w.frequency}</td>
                        <td className="py-2 text-xs text-muted-foreground">{w.suggested_use || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ReportSection>

        {/* ── マーケティング示唆 */}
        <ReportSection
          title="マーケティング示唆"
          description="分析結果に基づく、優先度付きのマーケティング施策の提言です"
        >
          <InsightList insights={insights} />
        </ReportSection>

        {/* ── LP改善案 */}
        <ReportSection
          title="LP改善案"
          description="顧客の声をもとにした、ランディングページへの具体的な改善提案です"
        >
          <SuggestionCards type="lp" items={lpSuggestions} />
        </ReportSection>

        {/* ── 広告コピー案 */}
        <ReportSection
          title="広告コピー案"
          description="レビューから抽出したペルソナ別の広告クリエイティブ案です"
        >
          <SuggestionCards type="ad" items={adCopies} />
        </ReportSection>

        {/* ── コンテンツアイデア */}
        <ReportSection
          title="コンテンツアイデア"
          description="SNS・ブログ・動画などのコンテンツマーケティングに活用できる企画案です"
        >
          <SuggestionCards type="content" items={contentIdeas} />
        </ReportSection>

        {/* ── 次に取るべきアクション */}
        <ReportSection
          title="次に取るべきアクション"
          description="優先度「高」の示唆から抽出した、すぐに着手すべきアクションリストです"
        >
          {highInsights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              優先度「高」のアクションはありません
            </p>
          ) : (
            <ol className="space-y-3">
              {highInsights.map((ins, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="flex-none w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">
                      {ins.suggested_action || ins.insight}
                    </p>
                    {ins.rationale && (
                      <p className="text-xs text-muted-foreground">{ins.rationale}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ReportSection>

        {/* 業界ベンチマーク */}
        {(() => {
          const hasData = benchmark.summary.total > 0
          const industryLabel =
            INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId]?.label ??
            project.industry
          return (
            <ReportSection
              title="業界ベンチマーク"
              description={`${industryLabel} の集計データと比較した傾向分類です`}
            >
              {!hasData ? (
                <p className="text-sm text-muted-foreground">
                  まだ業界ベンチマークに十分なデータがありません。
                </p>
              ) : (
                <div className="space-y-4">
                  {/* サマリー */}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {benchmark.summary.unique > 0 && (
                      <span className="rounded-full border border-green-400 px-3 py-0.5 text-green-700 dark:text-green-400 font-medium text-xs">
                        差別化の可能性 {benchmark.summary.unique} 件
                      </span>
                    )}
                    {benchmark.summary.emerging > 0 && (
                      <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-0.5 text-amber-700 dark:text-amber-400 font-medium text-xs">
                        台頭中 {benchmark.summary.emerging} 件
                      </span>
                    )}
                    {benchmark.summary.common > 0 && (
                      <span className="rounded-full bg-muted px-3 py-0.5 text-muted-foreground font-medium text-xs">
                        業界共通 {benchmark.summary.common} 件
                      </span>
                    )}
                  </div>
                  {/* 各軸 — unique & emerging を優先表示 */}
                  {(
                    [
                      { label: '評価ポイント', items: benchmark.rating_points },
                      { label: '不満点', items: benchmark.complaints },
                      { label: '購買理由', items: benchmark.purchase_reasons },
                      { label: '訴求ワード', items: benchmark.appeal_words },
                    ] as const
                  )
                    .filter(({ items }) => items.some((i) => i.benchmark_level !== 'unknown'))
                    .map(({ label, items }) => {
                      const notable = items.filter(
                        (i) => i.benchmark_level === 'unique' || i.benchmark_level === 'emerging'
                      )
                      const common = items.filter((i) => i.benchmark_level === 'common')
                      return (
                        <div key={label} className="space-y-1.5 print-section">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {label}
                          </p>
                          <ul className="space-y-1.5">
                            {notable.slice(0, 4).map((item) => (
                              <li key={item.label} className="flex items-start gap-2 text-sm">
                                <span
                                  className={`shrink-0 text-xs font-medium rounded px-1.5 py-0.5 ${
                                    item.benchmark_level === 'unique'
                                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  }`}
                                >
                                  {item.benchmark_level === 'unique' ? '差別化' : '台頭中'}
                                </span>
                                <span className="font-medium">{item.label}</span>
                              </li>
                            ))}
                            {notable.length === 0 &&
                              common.slice(0, 2).map((item) => (
                                <li key={item.label} className="flex items-start gap-2 text-sm">
                                  <span className="shrink-0 text-xs font-medium rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                                    共通
                                  </span>
                                  <span className="font-medium">{item.label}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )
                    })}
                </div>
              )}
            </ReportSection>
          )
        })()}

        {/* フィードバック */}
        <FeedbackForm
          targetType="project_analysis"
          targetId={analysisRow.id}
          apiPath={`/api/projects/${id}/feedback`}
        />

        {/* フッター */}
        <div className="pt-6 border-t text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            本レポートはアップロードされたレビューをもとにAIが分析した結果です。最終的な施策判断は、商材特性・事業状況・追加調査と合わせてご判断ください。
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by Hype Up AI · {formatDateTime(project.analysis_completed_at)}
          </p>
        </div>
      </main>
    </div>
  )
}
