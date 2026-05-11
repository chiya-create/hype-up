import Link from 'next/link'
import {
  BarChart3,
  Activity,
  Lightbulb,
  Star,
  FolderOpen,
  GitCompare,
  Building2,
  FileText,
  Users,
  Database,
  ScrollText,
  ChevronRight,
  ShieldAlert,
  LogIn,
} from 'lucide-react'
// service role を使用: platform_admin が全組織の KPI を横断閲覧するため RLS バイパスが必要
import { createServiceClient } from '@/lib/supabase/service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { requirePlatformAdminAccess } from '@/lib/auth/permissions'

interface KpiCard {
  label: string
  icon: React.ElementType
  count: number | null
}

async function fetchKpi() {
  const supabase = createServiceClient()

  const [
    { count: orgCount },
    { count: projectCount },
    { count: comparisonCount },
    { count: usageCount },
    { count: insightCount },
    { data: reviewSumData },
  ] = await Promise.all([
    supabase.from('organizations').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('comparison_reports').select('id', { count: 'exact', head: true }),
    supabase.from('usage_logs').select('id', { count: 'exact', head: true }),
    supabase.from('aggregated_insights').select('id', { count: 'exact', head: true }),
    supabase.from('projects').select('review_count'),
  ])

  const totalReviews = (reviewSumData ?? []).reduce(
    (sum, row) => sum + (row.review_count ?? 0),
    0
  )

  return {
    orgCount,
    projectCount,
    totalReviews,
    comparisonCount,
    usageCount,
    insightCount,
  }
}

export default async function AdminPage() {
  const access = await requirePlatformAdminAccess()

  if (!access.allowed) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4 py-16 text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">アクセスできません</h1>
          <p className="text-sm text-muted-foreground">
            このページは Platform Admin 権限で保護されています。
            {access.isAuthenticated
              ? 'アクセス権限がありません。'
              : 'ログインが必要です。'}
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

  const { ctx } = access
  const [kpi] = await Promise.all([fetchKpi()])

  const kpiCards: KpiCard[] = [
    { label: '組織数', icon: Building2, count: kpi.orgCount },
    { label: 'プロジェクト数', icon: FolderOpen, count: kpi.projectCount },
    { label: 'レビュー総数', icon: FileText, count: kpi.totalReviews },
    { label: '比較レポート数', icon: GitCompare, count: kpi.comparisonCount },
    { label: '利用ログ数', icon: ScrollText, count: kpi.usageCount },
    { label: '集計インサイト数', icon: Database, count: kpi.insightCount },
  ]

  const adminLinks = [
    {
      href: '/admin/organizations',
      icon: Building2,
      label: '組織管理',
      description: '組織・メンバーの作成と招待',
    },
    {
      href: '/admin/usage',
      icon: Activity,
      label: '利用ログ',
      description: 'イベント別の利用状況を確認',
    },
    {
      href: '/admin/insights',
      icon: Lightbulb,
      label: '集計インサイト',
      description: '業界別の匿名化インサイト蓄積状況',
    },
    {
      href: '/admin/feedback',
      icon: Star,
      label: 'フィードバック',
      description: '分析品質の評価と改善メモ',
    },
  ]

  const clientLinks = [
    {
      href: '/projects',
      icon: FolderOpen,
      label: 'プロジェクト一覧',
      description: '全プロジェクトの分析状況',
    },
    {
      href: '/compare',
      icon: GitCompare,
      label: '競合比較',
      description: '複数プロジェクトの比較レポート',
    },
  ]

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              プロジェクト一覧 →
            </Link>
            {ctx.user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  {ctx.user.email}
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
            ) : (
              <Link
                href="/login"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* タイトル */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold">Admin ダッシュボード</h1>
            </div>
            <p className="text-sm text-muted-foreground">運営・開発者向けの管理画面です</p>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="font-medium">Platform Admin 権限で保護されています。</span>{' '}
            このページは{' '}
            <code className="mx-1 rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">platform_admin</code>
            ロールのみアクセス可能です。
          </div>
        </div>

        {/* KPI カード */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            KPI
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpiCards.map(({ label, icon: Icon, count }) => (
              <Card key={label}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold tabular-nums">
                    {count !== null ? count.toLocaleString() : '—'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Admin 専用リンク */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Admin 専用
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {adminLinks.map(({ href, icon: Icon, label, description }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group flex items-center gap-4 rounded-lg border bg-background px-5 py-4 hover:bg-muted/50 transition-colors'
                )}
              >
                <Icon className="h-6 w-6 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </section>

        {/* クライアント画面へのリンク */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            クライアント画面
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {clientLinks.map(({ href, icon: Icon, label, description }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group flex items-center gap-4 rounded-lg border bg-background px-5 py-4 hover:bg-muted/50 transition-colors'
                )}
              >
                <Icon className="h-6 w-6 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
              </Link>
            ))}
          </div>
        </section>

        {/* ドキュメント */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            ドキュメント
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 品質検証ガイド */}
            <div className="rounded-lg border border-dashed bg-muted/20 px-5 py-4 space-y-1.5">
              <p className="text-sm font-medium">品質検証ガイド</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                分析・PPTX・競合比較の品質チェック:{' '}
                <code className="bg-muted px-1 py-0.5 rounded font-mono">
                  docs/quality-check-guide.md
                </code>
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                検証シナリオ:{' '}
                <code className="bg-muted px-1 py-0.5 rounded font-mono">
                  docs/test-scenarios.md
                </code>
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                プロンプト改善ログ:{' '}
                <code className="bg-muted px-1 py-0.5 rounded font-mono">
                  docs/prompt-improvement-log.md
                </code>
              </p>
            </div>

            {/* デプロイ前チェック */}
            <div className="rounded-lg border border-dashed bg-amber-50 border-amber-200 px-5 py-4 space-y-1.5">
              <p className="text-sm font-medium text-amber-900">デプロイ前チェック</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Vercel 環境変数・Supabase Auth URL・RLS・セキュリティの確認:{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-800">
                  docs/deployment-checklist.md
                </code>
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                本番デプロイ後のスモークテスト:{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-800">
                  docs/production-smoke-test.md
                </code>
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                service role / RLS / 匿名化方針:{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-800">
                  docs/security-notes.md
                </code>
              </p>
            </div>
          </div>
        </section>

        {/* トップへ */}
        <div className="pt-2">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <BarChart3 className="h-4 w-4" />
            トップページへ
          </Link>
        </div>
      </main>
    </div>
  )
}
