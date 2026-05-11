import Link from 'next/link'
import {
  BarChart3,
  BookOpen,
  Download,
  FolderOpen,
  Plus,
  Users,
  Lightbulb,
  FileText,
  GitCompare,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { requireClientAccess, isPlatformAdmin } from '@/lib/auth/permissions'
import { GettingStartedSteps } from '@/components/onboarding/GettingStartedSteps'

const FEATURES = [
  {
    icon: BarChart3,
    label: '評価ポイント・不満点の定量化',
    desc: 'レビューから何が評価されていて、何が不満なのかを数値と分類で把握',
  },
  {
    icon: Users,
    label: '顧客タイプの自動分類',
    desc: 'どんな人がどんな目的で買っているかを自動でグルーピング',
  },
  {
    icon: Lightbulb,
    label: '購買理由・訴求ワードの抽出',
    desc: '「なぜ選ばれたか」「どの言葉に共感されているか」を可視化',
  },
  {
    icon: FileText,
    label: 'LP・広告コピー改善提案',
    desc: 'レビューをもとにした具体的な LP 見出し・コピー案を自動生成',
  },
  {
    icon: GitCompare,
    label: '競合比較レポート',
    desc: '複数プロジェクトを横断比較し、差別化ポイントと共通課題を抽出',
  },
]

const CSV_COLUMNS = [
  { col: 'body', required: true, desc: 'レビュー本文（必須）' },
  { col: 'rating', required: false, desc: '星評価（1〜5）' },
  { col: 'reviewer', required: false, desc: '投稿者名' },
  { col: 'reviewed_at', required: false, desc: '投稿日（YYYY-MM-DD）' },
  { col: 'source', required: false, desc: '取得元（amazon など）' },
]

const CSV_EXAMPLE = `body,rating,reviewer,reviewed_at,source
"とても使いやすく満足しています",5,田中,2024-01-15,amazon
"価格の割に品質が良い",4,鈴木,2024-02-03,rakuten
"少し重いが機能は十分",3,,2024-03-10,`

const SAMPLE_CSVS = [
  { href: '/samples/sample-reviews-cosme.csv', label: '美容・コスメ' },
  { href: '/samples/sample-reviews-education.csv', label: '英語スクール・教育' },
  { href: '/samples/sample-reviews-hotel.csv', label: 'ホテル・観光' },
]

const ROLE_LABEL: Record<string, string> = {
  client_owner: 'オーナー',
  client_member: 'メンバー',
  platform_admin: 'Platform Admin',
}

export default async function OnboardingPage() {
  const ctx = await requireClientAccess()
  const orgName = ctx.organizations[0]?.name ?? '組織'
  const role = ctx.role ?? 'client_member'

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ヘッダー */}
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
            {ctx.user && (
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
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* ウェルカムバナー */}
        <section className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 px-6 py-8 space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">はじめに</h1>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Hype Up AI へようこそ。このページでは、分析を開始するまでの手順をご案内します。
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {orgName}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {ROLE_LABEL[role] ?? role}
            </Badge>
          </div>
        </section>

        {/* Hype Up AI でできること */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Hype Up AI でできること</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <Card key={label} className="border-dashed">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary shrink-0" />
                    <p className="font-medium text-sm">{label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 使い方ステップ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">最初にやること</h2>
          <Card>
            <CardContent className="pt-6 pb-6">
              <GettingStartedSteps />
            </CardContent>
          </Card>
        </section>

        {/* CSV フォーマット */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">CSV フォーマット</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">列の仕様</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {CSV_COLUMNS.map(({ col, required, desc }) => (
                  <div key={col} className="flex items-center gap-3">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                      {col}
                    </code>
                    {required && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                        必須
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                ))}
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  文字コード: UTF-8 推奨 ／ 最大 5,000 件 ／ ヘッダー行必須
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">サンプル（先頭 3 行）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap break-all">
                  {CSV_EXAMPLE}
                </pre>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    業界別サンプル CSV（架空レビュー 30 件入り）
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_CSVS.map(({ href, label }) => (
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
              </CardContent>
            </Card>
          </div>
        </section>

        {/* アクションボタン */}
        <section className="flex flex-wrap gap-4 pt-2">
          <Link
            href="/"
            className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}
          >
            <Plus className="h-5 w-5" />
            プロジェクトを作成する
          </Link>
          <Link
            href="/projects"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
          >
            <FolderOpen className="h-5 w-5" />
            プロジェクト一覧を見る
          </Link>
        </section>

        {/* プラットフォーム管理者向け補足 */}
        {isPlatformAdmin(role) && (
          <section className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="font-medium">Platform Admin として閲覧中です。</span>{' '}
            組織・メンバー管理は{' '}
            <Link href="/admin/organizations" className="underline hover:text-blue-900">
              Admin › 組織管理
            </Link>{' '}
            から行えます。
          </section>
        )}
      </main>
    </div>
  )
}
