import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BarChart3, GitCompare, ArrowLeft } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CompareRunButton } from '@/components/compare/CompareRunButton'
import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import type {
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
} from '@/types/analysis'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const AXIS_LABELS = [
  { key: 'rating_points', label: '評価ポイント' },
  { key: 'complaints', label: '不満点' },
  { key: 'purchase_reasons', label: '購入理由' },
  { key: 'customer_types', label: '顧客タイプ' },
  { key: 'appeal_words', label: '訴求ワード' },
] as const

export default async function CompareResultPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const ctx = await requireClientAccess()
  const { ids: idsParam } = await searchParams
  const ids = (idsParam ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  if (ids.length < 2 || ids.length > 3) notFound()

  const supabase = await createServerUserClient()

  // 既存レポートチェック（exact match）
  const { data: existingReports } = await supabase
    .from('comparison_reports')
    .select('id, project_ids')
    .order('created_at', { ascending: false })

  const sortedIds = [...ids].sort()
  const existing = (existingReports ?? []).find((r) => {
    const rIds = [...r.project_ids].sort()
    return rIds.length === sortedIds.length && rIds.every((id, i) => id === sortedIds[i])
  })

  if (existing) {
    redirect(`/compare/reports/${existing.id}`)
  }

  // プロジェクト + 分析結果取得
  const [{ data: projects }, { data: analyses }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, industry, review_count, analysis_completed_at, organization_id')
      .in('id', ids),
    supabase
      .from('project_analyses')
      .select('project_id, rating_points, complaints, purchase_reasons, customer_types, appeal_words')
      .in('project_id', ids),
  ])

  if (!projects || projects.length !== ids.length) notFound()

  const unauthorizedProject = projects.find(
    (p) => p.organization_id !== null && p.organization_id !== ctx.activeOrganizationId
  )
  if (unauthorizedProject) notFound()

  const analysisMap = new Map((analyses ?? []).map((a) => [a.project_id, a]))

  // ids の順序を保持してソート
  const orderedProjects = ids.map((id) => projects.find((p) => p.id === id)!).filter(Boolean)

  const industries = [...new Set(orderedProjects.map((p) => p.industry ?? 'general'))]

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
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
          <span className="text-sm font-medium">比較プレビュー</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">比較プレビュー</h1>
            <p className="text-sm text-muted-foreground">
              分析を実行すると、勝ち筋・弱み・市場共通不満・推奨アクションが生成されます。
            </p>
          </div>
          <Link
            href="/compare"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 shrink-0')}
          >
            <ArrowLeft className="h-4 w-4" />
            選択に戻る
          </Link>
        </div>

        {/* プロジェクト概要 */}
        <div className={`grid gap-4 ${orderedProjects.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {orderedProjects.map((project, idx) => {
            const industryLabel =
              INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId]?.label ?? project.industry
            return (
              <Card key={project.id} className="relative">
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                </div>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold leading-tight pr-6">
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <Badge variant="outline" className="text-xs font-normal">
                    {industryLabel}
                  </Badge>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p>{project.review_count.toLocaleString()} 件のレビュー</p>
                    <p>分析完了: {formatDate(project.analysis_completed_at)}</p>
                    {!analysisMap.has(project.id) && (
                      <p className="text-destructive font-medium">分析結果なし</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {industries.length > 1 && (
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
            異なる業界のプロジェクトが含まれています。比較は可能ですが、同業界の比較の方がより意味のある示唆が得られます。
          </div>
        )}

        {/* 5軸サイドバイサイド比較テーブル */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold">5軸データ比較</h2>
          <div className="rounded-md border bg-background overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28 shrink-0">軸</th>
                  {orderedProjects.map((p) => (
                    <th key={p.id} className="text-left px-4 py-3 font-medium">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AXIS_LABELS.map(({ key, label }) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-muted-foreground align-top whitespace-nowrap">
                      {label}
                    </td>
                    {orderedProjects.map((project) => {
                      const analysis = analysisMap.get(project.id)
                      if (!analysis) {
                        return (
                          <td key={project.id} className="px-4 py-3 text-muted-foreground text-xs align-top">
                            —
                          </td>
                        )
                      }

                      let items: string[] = []
                      if (key === 'rating_points') {
                        items = ((analysis.rating_points ?? []) as unknown as RatingPoint[])
                          .slice(0, 4)
                          .map((r) => `${r.label}（${r.count}件）`)
                      } else if (key === 'complaints') {
                        items = ((analysis.complaints ?? []) as unknown as Complaint[])
                          .slice(0, 4)
                          .map((c) => `${c.label}（${c.count}件）`)
                      } else if (key === 'purchase_reasons') {
                        items = ((analysis.purchase_reasons ?? []) as unknown as PurchaseReason[])
                          .slice(0, 3)
                          .map((r) => r.label)
                      } else if (key === 'customer_types') {
                        items = ((analysis.customer_types ?? []) as unknown as CustomerType[])
                          .slice(0, 3)
                          .map((c) => `${c.label}（${c.count}件）`)
                      } else if (key === 'appeal_words') {
                        items = ((analysis.appeal_words ?? []) as unknown as AppealWord[])
                          .slice(0, 5)
                          .map((w) => `${w.word}（${w.score}pt）`)
                      }

                      return (
                        <td key={project.id} className="px-4 py-3 align-top">
                          <ul className="space-y-0.5">
                            {items.map((item, i) => (
                              <li key={i} className="text-xs leading-relaxed">
                                {i + 1}. {item}
                              </li>
                            ))}
                            {items.length === 0 && (
                              <li className="text-xs text-muted-foreground">データなし</li>
                            )}
                          </ul>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 比較実行 */}
        <Card className="border-primary/20">
          <CardContent className="pt-6 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Hype Up AI による比較分析</p>
              <p className="text-xs text-muted-foreground">
                上記のデータをもとに、各プロジェクトの勝ち筋・弱み・市場共通の不満・推奨アクションを生成します。
              </p>
            </div>
            <CompareRunButton projectIds={ids} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
