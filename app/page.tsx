import Link from 'next/link'
import { BarChart3, FileText, Lightbulb, Users, Download, ShieldCheck, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CsvUploadForm } from '@/components/upload/CsvUploadForm'
import { getCurrentUserAccessContext, isPlatformAdmin, isClientRole } from '@/lib/auth/permissions'

const FEATURES = [
  { icon: BarChart3, label: '評価ポイント・不満点の定量化' },
  { icon: Users, label: '顧客タイプの自動分類' },
  { icon: Lightbulb, label: '購買理由・訴求ワードの抽出' },
  { icon: FileText, label: 'LP・広告コピー提案の自動生成' },
]

const CSV_EXAMPLE = `body,rating,reviewer,reviewed_at,source
"とても使いやすく満足しています",5,田中,2024-01-15,amazon
"価格の割に品質が良い",4,鈴木,2024-02-03,rakuten
"少し重いが機能は十分",3,,2024-03-10,`

export default async function HomePage() {
  const ctx = await getCurrentUserAccessContext()
  const user = ctx.user
  const orgName = ctx.organizations[0]?.name ?? null
  const showOnboardingBanner = ctx.isAuthenticated && isClientRole(ctx.role)

  const ROLE_LABEL: Record<string, string> = {
    client_owner: 'オーナー',
    client_member: 'メンバー',
    platform_admin: 'Platform Admin',
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ヘッダー */}
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              プロジェクト一覧 →
            </Link>
            {isPlatformAdmin(ctx.role) && (
              <Link
                href="/admin"
                className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                  {ctx.role && (
                    <span className="text-[10px] text-muted-foreground/70">
                      {orgName ? `${orgName} · ` : ''}{ROLE_LABEL[ctx.role] ?? ctx.role}
                    </span>
                  )}
                </div>
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
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs h-7')}
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12 space-y-12">
        {/* ヒーロー */}
        <section className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">
            レビューをマーケティング戦略に変える
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            商品レビューの CSV をアップロードするだけで、評価ポイント・不満点・購買理由・顧客タイプ・訴求ワードを自動分析。LP や広告コピーの改善提案も生成します。
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </section>

        {/* はじめに バナー（ログイン済みクライアントのみ） */}
        {showOnboardingBanner && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">はじめての方へ</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  CSV のフォーマットや分析手順をご確認いただけます
                </p>
              </div>
            </div>
            <Link
              href="/onboarding"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'gap-1.5 shrink-0 text-xs'
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              使い方を見る
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* アップロードフォーム */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-6">新規分析を開始</h2>
                <CsvUploadForm />
              </CardContent>
            </Card>
          </div>

          {/* サイドバー: CSVフォーマット説明 */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-sm">CSV フォーマット</h3>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">必須列</p>
                  <div className="flex items-start gap-2">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">body</code>
                    <span className="text-xs text-muted-foreground">レビュー本文</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">任意列</p>
                  {[
                    ['rating', '星評価（1〜5）'],
                    ['reviewer', '投稿者名'],
                    ['reviewed_at', '投稿日（YYYY-MM-DD）'],
                    ['source', '取得元（amazon など）'],
                  ].map(([col, desc]) => (
                    <div key={col} className="flex items-start gap-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                        {col}
                      </code>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    サンプル CSV
                  </p>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap break-all">
                    {CSV_EXAMPLE}
                  </pre>
                </div>

                <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-3 space-y-2">
                  <p className="text-xs font-medium text-primary">業界別サンプル CSV</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    架空レビュー 30 件入りのサンプルで Hype Up AI の分析をすぐに試せます。
                  </p>
                  <div className="space-y-1.5">
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
                          'gap-1.5 w-full justify-center text-xs'
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

            <p className="text-xs text-muted-foreground text-center">
              文字コード: UTF-8 推奨 / 最大 5,000 件
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
