import Link from 'next/link'
import { BarChart3, Lightbulb, ShieldAlert, LogIn } from 'lucide-react'
// service role を使用: platform_admin が全業界の匿名化インサイトを横断閲覧するため RLS バイパスが必要
import { createServiceClient } from '@/lib/supabase/service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import { requirePlatformAdminAccess } from '@/lib/auth/permissions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INSIGHT_TYPE_LABEL: Record<string, string> = {
  rating_point: '評価ポイント',
  complaint: '不満点',
  purchase_reason: '購買理由',
  appeal_word: '訴求ワード',
}

const INSIGHT_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  rating_point: 'default',
  complaint: 'destructive',
  purchase_reason: 'secondary',
  appeal_word: 'outline',
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

function ConfidenceBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>
  const pct = Math.round(score * 100)
  const color =
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-muted-foreground/40'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{score.toFixed(2)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminInsightsPage({
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
  const filterIndustry = (sp.industry as string) || 'all'
  const filterType = (sp.type as string) || 'all'

  const supabase = createServiceClient()

  // 全インサイト取得（フィルターは JS 側で適用）
  const { data: allInsights } = await supabase
    .from('aggregated_insights')
    .select('*')
    .order('count', { ascending: false })

  const insights = allInsights ?? []

  // 利用可能な業界一覧
  const availableIndustries = [...new Set(insights.map((r) => r.industry).filter(Boolean))]
  const availableTypes = [...new Set(insights.map((r) => r.insight_type).filter(Boolean))]

  // フィルタリング
  let filtered = insights
  if (filterIndustry !== 'all') filtered = filtered.filter((r) => r.industry === filterIndustry)
  if (filterType !== 'all') filtered = filtered.filter((r) => r.insight_type === filterType)

  // 集計サマリー
  const totalCount = insights.reduce((s, r) => s + r.count, 0)
  const byType = Object.fromEntries(
    ['rating_point', 'complaint', 'purchase_reason', 'appeal_word'].map((t) => [
      t,
      insights.filter((r) => r.insight_type === t).length,
    ])
  )

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ヘッダー */}
      <header className="border-b bg-background">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Admin
            </Link>
            <Link
              href="/projects"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              プロジェクト一覧
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Platform Admin 権限で保護されています。
        </div>
        {/* タイトル */}
        <div className="flex items-center gap-3">
          <Lightbulb className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">集計インサイト</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {insights.length} ラベル ／ 延べ {totalCount.toLocaleString()} 件のデータ蓄積
            </p>
          </div>
        </div>

        {insights.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              まだ集計インサイトがありません。プロジェクトを分析すると自動的に蓄積されます。
            </CardContent>
          </Card>
        ) : (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(byType).map(([type, cnt]) => (
                <Card key={type} className="text-center">
                  <CardContent className="pt-4 pb-3 px-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {INSIGHT_TYPE_LABEL[type] ?? type}
                    </p>
                    <p className="text-2xl font-bold tabular-nums">{cnt}</p>
                    <p className="text-xs text-muted-foreground">ラベル</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* フィルター */}
            <form method="GET" className="flex flex-wrap gap-3 items-end">
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

              {availableTypes.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">タイプ</label>
                  <select
                    name="type"
                    defaultValue={filterType}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">すべて</option>
                    {availableTypes.map((t) => (
                      <option key={t} value={t}>
                        {INSIGHT_TYPE_LABEL[t] ?? t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className={cn(buttonVariants({ size: 'sm' }))}
              >
                絞り込む
              </button>

              {(filterIndustry !== 'all' || filterType !== 'all') && (
                <Link
                  href="/admin/insights"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                >
                  リセット
                </Link>
              )}
            </form>

            <p className="text-xs text-muted-foreground">{filtered.length} 件表示</p>

            {/* インサイト一覧テーブル */}
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                条件に一致するインサイトがありません
              </p>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    集計結果（件数の多い順）
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                          <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">業界</th>
                          <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">タイプ</th>
                          <th className="text-left px-4 py-2.5 font-medium">ラベル</th>
                          <th className="text-right px-4 py-2.5 font-medium whitespace-nowrap">件数</th>
                          <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">信頼度</th>
                          <th className="text-left px-4 py-2.5 font-medium">匿名化例</th>
                          <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">更新日時</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filtered.map((row) => {
                          const examples = Array.isArray(row.examples_anonymized)
                            ? (row.examples_anonymized as unknown[])
                            : []
                          return (
                            <tr key={row.id} className="hover:bg-muted/20 transition-colors align-top">
                              <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                                {INDUSTRY_TEMPLATES[row.industry as IndustryId]?.label ?? row.industry}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <Badge
                                  variant={INSIGHT_TYPE_VARIANT[row.insight_type] ?? 'secondary'}
                                  className="text-xs"
                                >
                                  {INSIGHT_TYPE_LABEL[row.insight_type] ?? row.insight_type}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 font-medium max-w-xs">
                                {row.label}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                                {row.count.toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5">
                                <ConfidenceBar score={row.confidence_score} />
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs">
                                {examples.length === 0 ? (
                                  <span>—</span>
                                ) : (
                                  <details className="group">
                                    <summary className="cursor-pointer list-none text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                      {examples.length} 件の例
                                    </summary>
                                    <ul className="mt-1.5 space-y-1">
                                      {examples.map((ex, i) => (
                                        <li
                                          key={i}
                                          className="text-[11px] bg-muted rounded px-2 py-1 leading-relaxed"
                                        >
                                          {typeof ex === 'object' && ex !== null
                                            ? Object.entries(ex as Record<string, unknown>)
                                                .map(([k, v]) => `${k}: ${v}`)
                                                .join(' / ')
                                            : String(ex)}
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                                {formatDateTime(row.updated_at)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
