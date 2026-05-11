import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className="tabular-nums text-sm">
      {'★'.repeat(Math.min(5, Math.max(1, Math.round(rating))))}
      {'☆'.repeat(Math.max(0, 5 - Math.min(5, Math.max(1, Math.round(rating)))))}
      <span className="ml-1 text-xs text-muted-foreground">{rating}</span>
    </span>
  )
}

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const ctx = await requireClientAccess()
  const { id } = await params
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createServerUserClient()

  const [{ data: project }, { data: reviews, count }] = await Promise.all([
    supabase.from('projects').select('id, name, review_count, organization_id').eq('id', id).single(),
    supabase
      .from('reviews')
      .select('id, body, rating, reviewer, reviewed_at, source', { count: 'exact' })
      .eq('project_id', id)
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .range(from, to),
  ])

  if (!project) notFound()
  if (project.organization_id !== null && project.organization_id !== ctx.activeOrganizationId) {
    notFound()
  }

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-muted/30">
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
          <Link
            href={`/projects/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground truncate max-w-xs"
          >
            {project.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">レビュー一覧</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold">レビュー一覧</h1>
            <p className="text-sm text-muted-foreground">
              {project.name} · 全 {(count ?? 0).toLocaleString()} 件
            </p>
          </div>
          <Link
            href={`/projects/${id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <ArrowLeft className="h-4 w-4" />
            プロジェクト詳細へ戻る
          </Link>
        </div>

        {(!reviews || reviews.length === 0) ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>レビューがありません</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border bg-background overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">評価</TableHead>
                    <TableHead>レビュー本文</TableHead>
                    <TableHead>投稿者</TableHead>
                    <TableHead>ソース</TableHead>
                    <TableHead>投稿日</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <StarRating rating={r.rating} />
                      </TableCell>
                      <TableCell className="max-w-sm">
                        <p className="text-sm leading-relaxed line-clamp-3">{r.body}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {r.reviewer ?? '—'}
                      </TableCell>
                      <TableCell>
                        {r.source ? (
                          <Badge variant="secondary" className="text-xs">
                            {r.source}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDate(r.reviewed_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                {page > 1 ? (
                  <Link
                    href={`/projects/${id}/reviews?page=${page - 1}`}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    前へ
                  </Link>
                ) : (
                  <span
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'opacity-40 pointer-events-none gap-1'
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    前へ
                  </span>
                )}

                <span className="text-sm text-muted-foreground tabular-nums">
                  {page} / {totalPages}
                </span>

                {page < totalPages ? (
                  <Link
                    href={`/projects/${id}/reviews?page=${page + 1}`}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
                  >
                    次へ
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'opacity-40 pointer-events-none gap-1'
                    )}
                  >
                    次へ
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
