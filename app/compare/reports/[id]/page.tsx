import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, GitCompare, ArrowLeft, Calendar, Newspaper } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ComparisonReport } from '@/components/compare/ComparisonReport'
import { PrintButton } from '@/components/print/PrintButton'
import { ComparisonPptxExportButton } from '@/components/compare/ComparisonPptxExportButton'
import { PrintableHeader } from '@/components/print/PrintableHeader'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { getIndustryLabel } from '@/lib/constants'
import { getCurrentUserAccessContext } from '@/lib/auth/permissions'
import type {
  WinningAppeal,
  ComparisonStrength,
  ComparisonWeakness,
  SharedComplaint,
  ComparisonAction,
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

export default async function CompareReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [ctx, supabase] = await Promise.all([
    getCurrentUserAccessContext(),
    createServerUserClient(),
  ])

  const { data: report } = await supabase
    .from('comparison_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) notFound()

  // organization_id が設定済みの場合、所属外レポートはアクセス不可
  if (
    report.organization_id !== null &&
    report.organization_id !== ctx.activeOrganizationId
  ) {
    notFound()
  }

  // プロジェクト名を取得
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', report.project_ids)

  const projectNames = (projects ?? []).map((p) => p.name)

  const winningAppeals = (report.winning_appeals ?? []) as unknown as WinningAppeal[]
  const strengths = (report.strengths ?? []) as unknown as ComparisonStrength[]
  const weaknesses = (report.weaknesses ?? []) as unknown as ComparisonWeakness[]
  const sharedComplaints = (report.shared_complaints ?? []) as unknown as SharedComplaint[]
  const recommendedActions = (report.recommended_actions ?? []) as unknown as ComparisonAction[]

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4 flex-wrap">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/compare" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <GitCompare className="h-3.5 w-3.5" />
            競合比較
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate max-w-xs">{report.title ?? '比較レポート'}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <PrintableHeader
          title={report.title ?? '比較レポート'}
          projectNames={projectNames}
          industry={report.industry ?? undefined}
          analysisDate={formatDateTime(report.created_at)}
        />

        {/* タイトル + メタ */}
        <div className="space-y-4 pb-6 border-b">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
              Competitive Comparison Report
            </p>
            <h1 className="text-2xl font-bold leading-tight">{report.title ?? '比較レポート'}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateTime(report.created_at)}
            </div>
            {report.industry && (
              <Badge variant="outline" className="text-xs font-normal">
                {getIndustryLabel(report.industry)}
              </Badge>
            )}
            {report.token_used != null && (
              <span className="text-xs text-muted-foreground">
                使用トークン: {report.token_used.toLocaleString()}
              </span>
            )}
            <div className="ml-auto no-print flex items-center gap-2">
              <ComparisonPptxExportButton reportId={id} />
              <PrintButton />
            </div>
          </div>

          {/* 対象プロジェクト */}
          <div className="flex flex-wrap gap-2">
            {projectNames.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        </div>

        {/* 比較レポート本体 */}
        <ComparisonReport
          summary={report.comparison_summary}
          winningAppeals={winningAppeals}
          strengths={strengths}
          weaknesses={weaknesses}
          sharedComplaints={sharedComplaints}
          recommendedActions={recommendedActions}
          projectNames={projectNames}
        />

        {/* フィードバック */}
        <FeedbackForm
          targetType="comparison_report"
          targetId={id}
          apiPath={`/api/compare/reports/${id}/feedback`}
        />

        {/* 免責事項 */}
        <div className="pt-4 border-t space-y-2 text-center">
          <p className="text-xs text-muted-foreground">
            本比較レポートは、選択されたプロジェクトのレビュー分析結果をもとにした比較です。競合優位性の判断には、価格・広告・販売チャネル等の外部情報も合わせて確認してください。
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by Hype Up AI · {formatDateTime(report.created_at)}
          </p>
        </div>

        {/* フッターアクション */}
        <div className="flex flex-wrap gap-3 pt-4 border-t print:hidden">
          <Link
            href={`/compare/reports/${id}/one-pager`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <Newspaper className="h-4 w-4" />
            1枚サマリー
          </Link>
          <Link
            href="/compare"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <ArrowLeft className="h-4 w-4" />
            新しい比較を作成
          </Link>
          {(projects ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              {p.name} のダッシュボード
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
