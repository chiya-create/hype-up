import Link from 'next/link'
import { BarChart3, Plus, ChevronRight, AlertCircle, GitCompare, LogIn, ShieldCheck, BookOpen, Download } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import type { ProjectStatus } from '@/types/analysis'
import { getCurrentUserAccessContext, isPlatformAdmin } from '@/lib/auth/permissions'
import { GettingStartedSteps } from '@/components/onboarding/GettingStartedSteps'

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

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default async function ProjectsPage() {
  const ctx = await getCurrentUserAccessContext()

  // 未ログインはログイン案内を表示
  if (!ctx.isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-bold text-lg">Hype Up AI</span>
            </Link>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-20 flex flex-col items-center gap-4 text-center">
          <LogIn className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">ログインが必要です</h1>
          <p className="text-sm text-muted-foreground">
            プロジェクト一覧を表示するにはログインしてください。
          </p>
          <Link href="/login" className={cn(buttonVariants(), 'mt-2')}>
            ログインページへ
          </Link>
        </main>
      </div>
    )
  }

  // 認証済み: activeOrganizationId でフィルタ
  const supabase = await createServerUserClient()
  const { activeOrganizationId, user } = ctx

  const query = supabase
    .from('projects')
    .select('id, name, industry, status, review_count, created_at, analysis_completed_at, error_message')
    .order('created_at', { ascending: false })

  // org が設定されている場合はその org に絞り込み、未設定なら organization_id=null のものを表示
  const { data: projects, error } = activeOrganizationId
    ? await query.eq('organization_id', activeOrganizationId)
    : await query.is('organization_id', null)

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/compare"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <GitCompare className="h-4 w-4" />
              競合比較
            </Link>
            <Link href="/" className={cn(buttonVariants({ size: 'sm' }))}>
              <Plus className="h-4 w-4 mr-1" />
              新規分析
            </Link>
            {isPlatformAdmin(ctx.role) && (
              <Link
                href="/admin"
                className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors ml-1"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
            <span className="text-xs text-muted-foreground hidden sm:block border-l pl-2 ml-1">
              {user?.email}
            </span>
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">プロジェクト一覧</h1>
          <span className="text-sm text-muted-foreground">
            {projects ? `${projects.length} 件` : ''}
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>データの取得に失敗しました: {error.message}</span>
          </div>
        )}

        {!error && (!projects || projects.length === 0) ? (
          <div className="space-y-6">
            {/* 空状態メッセージ */}
            <Card className="border-dashed">
              <CardContent className="py-12 text-center space-y-4">
                <p className="text-muted-foreground font-medium">
                  まずは CSV をアップロードして分析を開始しましょう
                </p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  商品レビューの CSV を用意したら、トップページからアップロードするだけで AI 分析が始まります。
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Link href="/" className={cn(buttonVariants(), 'gap-1.5')}>
                    <Plus className="h-4 w-4" />
                    新規分析を開始
                  </Link>
                  <Link
                    href="/onboarding"
                    className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}
                  >
                    <BookOpen className="h-4 w-4" />
                    使い方を見る
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* サンプル CSV */}
            <div className="rounded-lg border bg-background px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">サンプル CSV を試す</p>
              </div>
              <p className="text-xs text-muted-foreground">
                架空レビュー 30 件入りのサンプルで、Hype Up AI の分析をすぐに体験できます。
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: '/samples/sample-reviews-cosme.csv', label: '美容・コスメ' },
                  { href: '/samples/sample-reviews-education.csv', label: '英語スクール・教育' },
                  { href: '/samples/sample-reviews-hotel.csv', label: 'ホテル・観光' },
                ].map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    download
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'gap-1.5 text-xs'
                    )}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* 手順ガイド */}
            <div className="rounded-lg border bg-background px-5 py-5 space-y-4">
              <p className="text-sm font-medium">はじめての方の手順</p>
              <GettingStartedSteps compact />
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-background overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>プロジェクト名</TableHead>
                  <TableHead>業界</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">レビュー数</TableHead>
                  <TableHead>作成日</TableHead>
                  <TableHead>分析完了</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(projects ?? []).map((p) => {
                  const status = p.status as ProjectStatus
                  const isError = status === 'error'
                  return (
                    <TableRow
                      key={p.id}
                      className={cn(
                        'hover:bg-muted/50',
                        isError && 'bg-destructive/5 hover:bg-destructive/10'
                      )}
                    >
                      <TableCell>
                        <div className="space-y-0.5">
                          <Link
                            href={`/projects/${p.id}`}
                            className="font-medium hover:underline"
                          >
                            {p.name}
                          </Link>
                          {isError && p.error_message && (
                            <p className="text-xs text-destructive line-clamp-1">
                              {p.error_message}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {INDUSTRY_TEMPLATES[(p.industry ?? 'general') as IndustryId]?.label ?? p.industry}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[status]}>
                          {STATUS_LABEL[status] ?? p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {p.review_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {formatDate(p.created_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {formatDate(p.analysis_completed_at)}
                      </TableCell>
                      <TableCell>
                        <Link href={`/projects/${p.id}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  )
}
