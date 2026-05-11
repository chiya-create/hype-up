import Link from 'next/link'
import { BarChart3, GitCompare } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CompareProjectSelector } from '@/components/compare/CompareProjectSelector'
import { getCurrentUserAccessContext } from '@/lib/auth/permissions'

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ preselect?: string }>
}) {
  const [{ preselect }, ctx, supabase] = await Promise.all([
    searchParams,
    getCurrentUserAccessContext(),
    createServerUserClient(),
  ])

  const { activeOrganizationId } = ctx

  // 分析完了済みプロジェクトのみ取得
  const { data: analyses } = await supabase
    .from('project_analyses')
    .select('project_id')

  const analysisProjectIds = (analyses ?? []).map((a) => a.project_id)

  // org フィルタを適用してプロジェクト一覧を取得
  const baseQuery = supabase
    .from('projects')
    .select('id, name, industry, review_count, analysis_completed_at')
    .in('id', analysisProjectIds)
    .order('created_at', { ascending: false })

  const { data: projects } = activeOrganizationId
    ? await baseQuery.eq('organization_id', activeOrganizationId)
    : await baseQuery.is('organization_id', null)

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
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
          <span className="text-sm font-medium flex items-center gap-1.5">
            <GitCompare className="h-4 w-4" />
            競合比較
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">競合比較</h1>
          <p className="text-sm text-muted-foreground">
            分析済みのプロジェクトを2〜3件選択して比較してください。同じ業界のプロジェクト同士の比較を推奨します。
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <CompareProjectSelector
              projects={projects ?? []}
              preselectedId={preselect}
            />
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Link
            href="/projects"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            プロジェクト一覧に戻る
          </Link>
        </div>
      </main>
    </div>
  )
}
