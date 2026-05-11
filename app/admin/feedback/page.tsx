import Link from 'next/link'
import {
  BarChart3,
  Star,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitCompare,
  FileText,
  ShieldAlert,
  LogIn,
} from 'lucide-react'
// service role を使用: platform_admin が全組織のフィードバックを横断閲覧するため RLS バイパスが必要
import { createServiceClient } from '@/lib/supabase/service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { INDUSTRY_TEMPLATES, INDUSTRY_IDS } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import { requirePlatformAdminAccess } from '@/lib/auth/permissions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedbackRow = {
  id: string
  target_type: 'project_analysis' | 'comparison_report'
  target_id: string
  summary_quality: number | null
  insight_quality: number | null
  copy_quality: number | null
  action_quality: number | null
  pptx_quality: number | null
  overall_score: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

type ProjectInfo = {
  id: string
  name: string
  industry: string | null
  analysis_id: string
}

type ComparisonInfo = {
  id: string
  title: string | null
  project_ids: string[]
  projectNames: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCORE_LABELS: Record<string, string> = {
  overall_score: '総合',
  summary_quality: 'サマリー',
  insight_quality: 'インサイト',
  copy_quality: 'コピー',
  action_quality: 'アクション',
  pptx_quality: 'PPTX',
}

const SCORE_KEYS = [
  'overall_score',
  'summary_quality',
  'insight_quality',
  'copy_quality',
  'action_quality',
  'pptx_quality',
] as const

type ScoreKey = (typeof SCORE_KEYS)[number]

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function isLowScore(fb: FeedbackRow): boolean {
  if (fb.overall_score !== null && fb.overall_score <= 2) return true
  for (const key of SCORE_KEYS) {
    const v = fb[key]
    if (v !== null && v <= 2) return true
  }
  return false
}

function StarDisplay({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className="flex items-center gap-0.5 tabular-nums">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${
            s <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'
          }`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{value}</span>
    </span>
  )
}

function formatDateTime(iso: string) {
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

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const access = await requirePlatformAdminAccess()
  if (!access.allowed) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4 py-16 text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">アクセスできません</h1>
          <p className="text-sm text-muted-foreground">
            このページは Platform Admin 権限で保護されています。
            {access.isAuthenticated ? 'アクセス権限がありません。' : 'ログインが必要です。'}
          </p>
          <Link
            href={access.isAuthenticated ? '/' : '/login'}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <LogIn className="h-4 w-4" />
            {access.isAuthenticated ? 'トップページへ' : 'ログイン'}
          </Link>
        </div>
      </div>
    )
  }

  const sp = await searchParams
  const filterType = (sp.type as string) || 'all'
  const filterIndustry = (sp.industry as string) || 'all'
  const filterLow = sp.low === 'true'
  const filterScore = parseInt((sp.score as string) || '0', 10)

  const supabase = createServiceClient()

  // ── 全フィードバック取得
  const { data: allFeedback } = await supabase
    .from('analysis_feedback')
    .select('*')
    .order('updated_at', { ascending: false })

  const feedbackList = (allFeedback ?? []) as FeedbackRow[]

  // ── project_analysis フィードバック: project_analyses → projects を一括取得
  const analysisIds = feedbackList
    .filter((f) => f.target_type === 'project_analysis')
    .map((f) => f.target_id)

  const projectInfoMap = new Map<string, ProjectInfo>()

  if (analysisIds.length > 0) {
    const { data: analyses } = await supabase
      .from('project_analyses')
      .select('id, project_id')
      .in('id', analysisIds)

    const projectIds = (analyses ?? []).map((a) => a.project_id)

    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, industry')
      .in('id', projectIds)

    const projectMap = new Map((projects ?? []).map((p) => [p.id, p]))

    for (const a of analyses ?? []) {
      const proj = projectMap.get(a.project_id)
      if (proj) {
        projectInfoMap.set(a.id, {
          id: proj.id,
          name: proj.name,
          industry: proj.industry,
          analysis_id: a.id,
        })
      }
    }
  }

  // ── comparison_report フィードバック: comparison_reports を一括取得
  const reportIds = feedbackList
    .filter((f) => f.target_type === 'comparison_report')
    .map((f) => f.target_id)

  const comparisonInfoMap = new Map<string, ComparisonInfo>()

  if (reportIds.length > 0) {
    const { data: reports } = await supabase
      .from('comparison_reports')
      .select('id, title, project_ids')
      .in('id', reportIds)

    const allProjectIds = (reports ?? []).flatMap((r) => r.project_ids as string[])
    const uniqueProjectIds = [...new Set(allProjectIds)]

    const { data: projNames } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', uniqueProjectIds)

    const nameMap = new Map((projNames ?? []).map((p) => [p.id, p.name]))

    for (const r of reports ?? []) {
      comparisonInfoMap.set(r.id, {
        id: r.id,
        title: r.title,
        project_ids: r.project_ids as string[],
        projectNames: (r.project_ids as string[]).map((pid) => nameMap.get(pid) ?? pid),
      })
    }
  }

  // ── 平均スコア（フィルター前・全件で計算）
  const scoreAverages = Object.fromEntries(
    SCORE_KEYS.map((key) => [key, avg(feedbackList.map((f) => f[key]))])
  ) as Record<ScoreKey, number | null>

  // ── 利用可能な業界一覧（project_analysis のみ）
  const availableIndustries = [
    ...new Set(
      feedbackList
        .filter((f) => f.target_type === 'project_analysis')
        .map((f) => projectInfoMap.get(f.target_id)?.industry)
        .filter((ind): ind is string => !!ind)
    ),
  ]

  // ── フィルタリング
  let filtered = feedbackList

  if (filterType !== 'all') {
    filtered = filtered.filter((f) => f.target_type === filterType)
  }

  if (filterLow) {
    filtered = filtered.filter(isLowScore)
  }

  if (filterScore > 0) {
    filtered = filtered.filter((f) => f.overall_score !== null && f.overall_score <= filterScore)
  }

  if (filterIndustry !== 'all') {
    filtered = filtered.filter((f) => {
      if (f.target_type !== 'project_analysis') return false
      const info = projectInfoMap.get(f.target_id)
      return info?.industry === filterIndustry
    })
  }

  const lowCount = feedbackList.filter(isLowScore).length

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ヘッダー */}
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Admin
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Platform Admin 権限で保護されています。
        </div>
        {/* タイトル */}
        <div>
          <h1 className="text-2xl font-bold">フィードバック一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {feedbackList.length} 件のフィードバック
            {lowCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                （うち要改善 {lowCount} 件）
              </span>
            )}
          </p>
        </div>

        {feedbackList.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              まだフィードバックがありません。各レポートページから評価を入力してください。
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── 平均スコアカード */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                平均スコア
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {SCORE_KEYS.map((key) => {
                  const val = scoreAverages[key]
                  const rounded = val !== null ? Math.round(val * 10) / 10 : null
                  const isWeak = rounded !== null && rounded < 3
                  return (
                    <Card
                      key={key}
                      className={cn(
                        'text-center',
                        key === 'overall_score' && 'ring-1 ring-primary/30',
                        isWeak && 'border-amber-300 dark:border-amber-700'
                      )}
                    >
                      <CardContent className="pt-4 pb-3 px-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          {SCORE_LABELS[key]}
                        </p>
                        {rounded !== null ? (
                          <>
                            <p
                              className={cn(
                                'text-2xl font-bold tabular-nums',
                                isWeak
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-foreground'
                              )}
                            >
                              {rounded}
                            </p>
                            <p className="text-xs text-muted-foreground">/5</p>
                          </>
                        ) : (
                          <p className="text-2xl font-bold text-muted-foreground">—</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* ── フィルター */}
            <form method="GET" className="flex flex-wrap gap-3 items-end">
              {/* タイプ */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">種別</label>
                <select
                  name="type"
                  defaultValue={filterType}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">すべて</option>
                  <option value="project_analysis">単体分析</option>
                  <option value="comparison_report">競合比較</option>
                </select>
              </div>

              {/* 業界 */}
              {availableIndustries.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">業界</label>
                  <select
                    name="industry"
                    defaultValue={filterIndustry}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">すべて</option>
                    {availableIndustries.map((ind) => (
                      <option key={ind} value={ind}>
                        {INDUSTRY_TEMPLATES[ind as IndustryId]?.label ?? ind}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 総合スコア上限 */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">
                  総合スコア ≦
                </label>
                <select
                  name="score"
                  defaultValue={String(filterScore)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="0">すべて</option>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <option key={s} value={String(s)}>
                      {s}以下
                    </option>
                  ))}
                </select>
              </div>

              {/* 低評価のみ */}
              <label className="flex items-center gap-2 h-9 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  name="low"
                  value="true"
                  defaultChecked={filterLow}
                  className="rounded border-input"
                />
                要改善のみ表示
              </label>

              <button
                type="submit"
                className={cn(buttonVariants({ size: 'sm' }))}
              >
                絞り込む
              </button>

              {(filterType !== 'all' || filterIndustry !== 'all' || filterLow || filterScore > 0) && (
                <Link
                  href="/admin/feedback"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                >
                  リセット
                </Link>
              )}
            </form>

            {/* ── フィードバック一覧 */}
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {filtered.length} 件表示
              </p>

              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  条件に一致するフィードバックがありません
                </p>
              ) : (
                filtered.map((fb) => {
                  const low = isLowScore(fb)
                  const isAnalysis = fb.target_type === 'project_analysis'
                  const projectInfo = isAnalysis ? projectInfoMap.get(fb.target_id) : null
                  const compInfo = !isAnalysis ? comparisonInfoMap.get(fb.target_id) : null

                  const reportHref = isAnalysis && projectInfo
                    ? `/projects/${projectInfo.id}/report`
                    : compInfo
                      ? `/compare/reports/${compInfo.id}`
                      : null

                  const industryLabel = projectInfo?.industry
                    ? INDUSTRY_TEMPLATES[projectInfo.industry as IndustryId]?.label ?? projectInfo.industry
                    : null

                  return (
                    <Card
                      key={fb.id}
                      className={cn(
                        low && 'border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10'
                      )}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3 flex-wrap">
                          {/* 種別バッジ */}
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            {isAnalysis ? (
                              <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                                <FileText className="h-3 w-3" />
                                単体分析
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs gap-1 shrink-0">
                                <GitCompare className="h-3 w-3" />
                                競合比較
                              </Badge>
                            )}

                            {/* 対象名 */}
                            <CardTitle className="text-sm font-semibold truncate">
                              {isAnalysis && projectInfo
                                ? projectInfo.name
                                : compInfo?.title ?? '比較レポート'}
                            </CardTitle>

                            {industryLabel && (
                              <Badge variant="outline" className="text-xs font-normal shrink-0">
                                {industryLabel}
                              </Badge>
                            )}

                            {!isAnalysis && compInfo && (
                              <span className="text-xs text-muted-foreground truncate">
                                {compInfo.projectNames.join(' vs ')}
                              </span>
                            )}
                          </div>

                          {/* 要改善ラベル / OK */}
                          <div className="flex items-center gap-2 shrink-0">
                            {low ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                要改善
                              </span>
                            ) : fb.overall_score !== null ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                良好
                              </span>
                            ) : null}

                            {reportHref && (
                              <Link
                                href={reportHref}
                                className={cn(
                                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                                  'h-7 px-2 gap-1 text-xs'
                                )}
                              >
                                レポート
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* スコアグリッド */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                          {SCORE_KEYS.map((key) => {
                            const val = fb[key]
                            return (
                              <div key={key} className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {SCORE_LABELS[key]}
                                </span>
                                <StarDisplay value={val} />
                              </div>
                            )
                          })}
                        </div>

                        {/* メモ */}
                        {fb.notes && (
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">改善メモ</p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {fb.notes}
                            </p>
                          </div>
                        )}

                        {/* タイムスタンプ */}
                        <p className="text-xs text-muted-foreground text-right">
                          最終更新: {formatDateTime(fb.updated_at)}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
