import Link from 'next/link'
import { BarChart3, Activity, ShieldAlert, LogIn } from 'lucide-react'
// service role を使用: platform_admin が全組織の利用ログを横断閲覧するため RLS バイパスが必要
import { createServiceClient } from '@/lib/supabase/service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { requirePlatformAdminAccess } from '@/lib/auth/permissions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVENT_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  csv_uploaded: 'secondary',
  analysis_started: 'default',
  analysis_completed: 'outline',
  report_exported: 'secondary',
  pptx_exported: 'secondary',
  comparison_created: 'default',
  feedback_submitted: 'outline',
}

const EVENT_LABEL: Record<string, string> = {
  csv_uploaded: 'CSV アップロード',
  analysis_started: '分析開始',
  analysis_completed: '分析完了',
  report_exported: 'レポート出力',
  pptx_exported: 'PPTX 出力',
  comparison_created: '競合比較',
  feedback_submitted: 'フィードバック',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminUsagePage() {
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

  const supabase = createServiceClient()

  // 最新 100 件のログ取得
  const { data: logs } = await supabase
    .from('usage_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const logList = logs ?? []

  // organization_id / project_id を一括解決
  const orgIds = [...new Set(logList.map((l) => l.organization_id).filter(Boolean))]
  const projIds = [...new Set(logList.map((l) => l.project_id).filter(Boolean) as string[])]

  const [orgResult, projResult] = await Promise.all([
    orgIds.length > 0
      ? supabase.from('organizations').select('id, name').in('id', orgIds)
      : { data: [] },
    projIds.length > 0
      ? supabase.from('projects').select('id, name').in('id', projIds)
      : { data: [] },
  ])

  const orgMap = new Map((orgResult.data ?? []).map((o) => [o.id, o.name]))
  const projMap = new Map((projResult.data ?? []).map((p) => [p.id, p.name]))

  // イベント別集計
  const eventCounts = logList.reduce<Record<string, number>>((acc, l) => {
    acc[l.event_type] = (acc[l.event_type] ?? 0) + 1
    return acc
  }, {})

  const totalTokens = logList.reduce((sum, l) => sum + (l.token_used ?? 0), 0)

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
          <Activity className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">利用ログ</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              最新 {logList.length} 件 ／ 合計トークン: {totalTokens.toLocaleString()}
            </p>
          </div>
        </div>

        {/* イベント別集計 */}
        {Object.keys(eventCounts).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(eventCounts).map(([type, count]) => (
              <Card key={type} className="text-center">
                <CardContent className="pt-4 pb-3 px-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {EVENT_LABEL[type] ?? type}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ログ一覧 */}
        {logList.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              まだ利用ログがありません
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                イベント履歴（新しい順）
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">日時</th>
                      <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">イベント</th>
                      <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">組織</th>
                      <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">プロジェクト</th>
                      <th className="text-right px-4 py-2.5 font-medium whitespace-nowrap">トークン</th>
                      <th className="text-left px-4 py-2.5 font-medium">メタデータ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logList.map((log) => {
                      const meta = log.metadata as Record<string, unknown>
                      const hasMetadata = meta && Object.keys(meta).length > 0
                      return (
                        <tr key={log.id} className="hover:bg-muted/20 transition-colors align-top">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <Badge
                              variant={EVENT_VARIANT[log.event_type] ?? 'secondary'}
                              className="text-xs"
                            >
                              {EVENT_LABEL[log.event_type] ?? log.event_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                            {log.organization_id
                              ? (orgMap.get(log.organization_id) ?? log.organization_id.slice(0, 8) + '…')
                              : <span className="text-muted-foreground">—</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                            {log.project_id
                              ? (projMap.get(log.project_id) ?? log.project_id.slice(0, 8) + '…')
                              : (meta?.project_name as string | undefined) ?? <span className="text-muted-foreground">—</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-xs text-right tabular-nums whitespace-nowrap">
                            {log.token_used != null ? log.token_used.toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs">
                            {hasMetadata ? (
                              <details className="group">
                                <summary className="cursor-pointer list-none text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                  {Object.keys(meta).length} 件
                                </summary>
                                <pre className="mt-1 text-[10px] bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                                  {JSON.stringify(meta, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <span>—</span>
                            )}
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
      </main>
    </div>
  )
}
