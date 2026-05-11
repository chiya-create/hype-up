import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, FileText, AlertCircle, List, BarChart2, Bug, GitCompare, Newspaper } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { getCurrentUserAccessContext } from '@/lib/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import { AnalyzeButton } from '@/components/dashboard/AnalyzeButton'
import { AnalysisStatusCard } from '@/components/dashboard/AnalysisStatusCard'
import { QualityCheckCard } from '@/components/dashboard/QualityCheckCard'
import { DashboardTabs } from '@/components/dashboard/DashboardTabs'
import { ExportActions } from '@/components/dashboard/ExportActions'
import { IndustryBenchmarkCard } from '@/components/dashboard/IndustryBenchmarkCard'
import { getProjectBenchmark } from '@/lib/insights/get-project-benchmark'
import type { ProjectStatus, ChunkStatus, ProjectAnalysis } from '@/types/analysis'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<ProjectStatus, string> = {
  pending: '分析待ち',
  analyzing: '分析中',
  done: '完了',
  error: 'エラー',
}

const STATUS_VARIANT: Record<
  ProjectStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'secondary',
  analyzing: 'default',
  done: 'outline',
  error: 'destructive',
}

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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [ctx, supabase] = await Promise.all([
    getCurrentUserAccessContext(),
    createServerUserClient(),
  ])

  // 未ログインはログインページへ
  if (!ctx.isAuthenticated) {
    const { redirect } = await import('next/navigation')
    redirect(`/login?next=/projects/${id}`)
  }

  const [{ data: project }, { data: chunks }, { data: analysisRow }] =
    await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase
        .from('analysis_chunks')
        .select('id, chunk_index, status, review_ids, error_message')
        .eq('project_id', id)
        .order('chunk_index'),
      supabase
        .from('project_analyses')
        .select('*')
        .eq('project_id', id)
        .maybeSingle(),
    ])

  if (!project) notFound()

  // organization_id が設定済みの場合、所属外プロジェクトはアクセス不可
  if (
    project.organization_id !== null &&
    project.organization_id !== ctx.activeOrganizationId
  ) {
    notFound()
  }

  const status = project.status as ProjectStatus
  const chunkList = chunks ?? []
  const errorChunks = chunkList.filter((c) => c.status === 'error')
  const hasErrorChunks = errorChunks.length > 0

  const analysis: ProjectAnalysis | null = analysisRow
    ? (analysisRow as unknown as ProjectAnalysis)
    : null

  // aggregated_insights は service role 経由で取得（RLS 有効化後も anon key では読めない）
  const benchmark = analysis
    ? await getProjectBenchmark(project.industry ?? 'general', analysis)
    : null

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ヘッダー */}
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            プロジェクト一覧
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate max-w-xs">{project.name}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* タイトル + ステータス + アクション */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <Badge
                variant={STATUS_VARIANT[status]}
                className="text-sm px-3 py-1"
              >
                {STATUS_LABEL[status]}
              </Badge>
              <Badge variant="outline" className="text-xs font-normal">
                {INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId]?.label ?? project.industry}
              </Badge>
            </div>
            {project.description && (
              <p className="text-muted-foreground text-sm">{project.description}</p>
            )}
          </div>

          <div className="shrink-0">
            <AnalyzeButton projectId={project.id} currentStatus={status} />
          </div>
        </div>

        {/* プロジェクトエラーメッセージ */}
        {project.error_message && (
          <div className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{project.error_message}</span>
          </div>
        )}

        {/* サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                レビュー数
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold tabular-nums">
                {project.review_count.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground">
                チャンク数
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold tabular-nums">{chunkList.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground">
                分析開始
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm font-medium tabular-nums">
                {formatDateTime(project.analysis_started_at)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground">
                分析完了
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm font-medium tabular-nums">
                {formatDateTime(project.analysis_completed_at)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 分析ステータスカード（チャンクが1件以上あるとき） */}
        {chunkList.length > 0 && (
          <AnalysisStatusCard
            chunks={chunkList.map((c) => ({ status: c.status as ChunkStatus }))}
            totalTokensUsed={analysis?.total_tokens_used ?? null}
            analysisCompletedAt={project.analysis_completed_at}
          />
        )}

        {/* 品質チェック */}
        {analysis && <QualityCheckCard analysis={analysis} projectId={id} />}

        {/* エラーチャンク警告 */}
        {hasErrorChunks && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorChunks.length} 件のチャンクでエラーが発生しています
            </div>
            <ul className="space-y-1 pl-6">
              {errorChunks.slice(0, 5).map((c) => (
                <li key={c.id} className="text-xs text-destructive/80">
                  チャンク #{c.chunk_index + 1}
                  {c.error_message ? ` — ${c.error_message}` : ''}
                </li>
              ))}
              {errorChunks.length > 5 && (
                <li className="text-xs text-destructive/60">
                  他 {errorChunks.length - 5} 件…
                </li>
              )}
            </ul>
            <p className="text-xs text-muted-foreground pl-0">
              「再分析を実行」ボタンで失敗チャンクを再処理できます。
            </p>
          </div>
        )}

        {/* レビュー一覧・エクスポートアクション */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects/${id}/reviews`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <List className="h-4 w-4" />
              レビュー一覧 ({project.review_count.toLocaleString()} 件)
            </Link>

            {analysis && (
              <Link
                href={`/projects/${id}/report`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
              >
                <BarChart2 className="h-4 w-4" />
                レポートを見る
              </Link>
            )}

            {analysis && (
              <Link
                href={`/projects/${id}/one-pager`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
              >
                <Newspaper className="h-4 w-4" />
                1枚サマリー
              </Link>
            )}

            {chunkList.length > 0 && (
              <Link
                href={`/projects/${id}/debug`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-muted-foreground/60')}
                title="Admin / 開発者向けデバッグ画面"
              >
                <Bug className="h-4 w-4" />
                デバッグ (Admin)
              </Link>
            )}

            {analysis && (
              <Link
                href={`/compare?preselect=${id}`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-muted-foreground')}
              >
                <GitCompare className="h-4 w-4" />
                他の商品と比較
              </Link>
            )}
          </div>

          <ExportActions projectId={id} hasAnalysis={!!analysis} />
        </div>

        {/* 分析結果 */}
        <div>
          <h2 className="text-lg font-semibold mb-4">分析結果</h2>
          {status === 'analyzing' ? (
            <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
              <p className="font-medium text-muted-foreground">分析中...</p>
              <p className="text-sm text-muted-foreground">
                ページを更新すると最新の状況が反映されます。
              </p>
            </div>
          ) : analysis ? (
            <>
              <DashboardTabs analysis={analysis} />
              <div className="mt-8">
                <IndustryBenchmarkCard
                  benchmark={benchmark!}
                  industryLabel={
                    INDUSTRY_TEMPLATES[project.industry as IndustryId]?.label ?? project.industry
                  }
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
              <p className="font-medium text-muted-foreground">
                {status === 'error' ? '分析に失敗しました' : '分析待ち'}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === 'error'
                  ? '「再分析を実行」ボタンで再試行できます。'
                  : '「分析を開始」ボタンを押すと、AI による分析が実行されます。'}
              </p>
            </div>
          )}
        </div>

        {/* 作成日時 */}
        <p className="text-xs text-muted-foreground text-right">
          作成: {formatDateTime(project.created_at)}
        </p>
      </main>
    </div>
  )
}
