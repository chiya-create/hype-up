import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerUserClient } from '@/lib/supabase/server'
import { requireClientAccess } from '@/lib/auth/permissions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OnePagerLayout } from '@/components/one-pager/OnePagerLayout'
import { SummaryBlock } from '@/components/one-pager/SummaryBlock'
import { OnePagerList } from '@/components/one-pager/OnePagerList'
import { PptxExportButton } from '@/components/one-pager/PptxExportButton'
import { GoogleSlidesExportButton } from '@/components/one-pager/GoogleSlidesExportButton'
import { getIndustryLabel } from '@/lib/constants'
import type {
  WinningAppeal,
  ComparisonStrength,
  ComparisonWeakness,
  SharedComplaint,
  ComparisonAction,
} from '@/types/analysis'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateSummary(text: string | null, max = 220): string {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

export default async function CompareOnePagerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await requireClientAccess()
  const { id } = await params
  const supabase = await createServerUserClient()

  const { data: report } = await supabase
    .from('comparison_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) notFound()
  if (report.organization_id !== null && report.organization_id !== ctx.activeOrganizationId) {
    notFound()
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', report.project_ids)

  const projectNames = (projects ?? []).map((p) => p.name)

  // データ選定
  const winningAppeals = (report.winning_appeals ?? []) as unknown as WinningAppeal[]
  const strengths = (report.strengths ?? []) as unknown as ComparisonStrength[]
  const weaknesses = (report.weaknesses ?? []) as unknown as ComparisonWeakness[]
  const sharedComplaints = (report.shared_complaints ?? []) as unknown as SharedComplaint[]
  const actions = (report.recommended_actions ?? []) as unknown as ComparisonAction[]

  // 勝てる訴求 上位3件
  const appealItems: string[] = winningAppeals
    .slice(0, 3)
    .map((a) => `【${a.project_name}】${a.appeal}`)

  // 強み 上位3件
  const strengthItems: string[] = strengths
    .slice(0, 3)
    .map((s) => {
      const who = s.project_name ?? '全プロジェクト'
      return `${s.label}（${who}）`
    })

  // 弱み 上位3件
  const weaknessItems: string[] = weaknesses
    .slice(0, 3)
    .map((w) => `【${w.project_name}】${w.label}`)

  // 市場共通不満 上位3件
  const complaintItems: string[] = sharedComplaints
    .slice(0, 3)
    .map((c) => c.label)

  // 推奨アクション: high優先で上位5件
  const sortedActions = [...actions].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
  })
  const actionItems: string[] = sortedActions
    .slice(0, 5)
    .map((a) => {
      const who = a.project_name ? `【${a.project_name}】` : ''
      return `${who}${a.action}`
    })

  const meta = [
    { label: '比較対象', value: projectNames.join(' vs ') },
    { label: '業界', value: getIndustryLabel(report.industry) },
    { label: '比較実行', value: formatDateTime(report.created_at) },
    { label: '印刷日', value: new Date().toLocaleDateString('ja-JP') },
  ]

  return (
    <>
      {/* 戻るリンク (印刷時非表示) */}
      <div className="no-print max-w-[210mm] mx-auto px-8 pt-4 pb-0">
        <Link
          href={`/compare/reports/${id}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-muted-foreground')}
        >
          <ArrowLeft className="h-4 w-4" />
          比較レポートへ戻る
        </Link>
      </div>

      <OnePagerLayout
        title="競合比較サマリー"
        subtitle={report.title ?? '比較レポート'}
        meta={meta}
        actions={
          <>
            <GoogleSlidesExportButton />
            <PptxExportButton href={`/api/compare/reports/${id}/export-pptx`} />
          </>
        }
      >
        <div className="space-y-3 one-pager-grid">
          {/* 結論サマリー */}
          <SummaryBlock title="結論サマリー" variant="conclusion">
            <p className="text-sm leading-relaxed">
              {truncateSummary(report.comparison_summary) || '該当データはありません'}
            </p>
          </SummaryBlock>

          {/* 2列グリッド */}
          <div className="grid grid-cols-2 gap-3 one-pager-grid">
            <SummaryBlock title="勝てる訴求（プロジェクト別）" variant="strength">
              <OnePagerList items={appealItems} maxItems={3} numbered />
            </SummaryBlock>

            <SummaryBlock title="各商品の強み" variant="strength">
              <OnePagerList items={strengthItems} maxItems={3} numbered />
            </SummaryBlock>
          </div>

          {/* 2列グリッド */}
          <div className="grid grid-cols-2 gap-3 one-pager-grid">
            <SummaryBlock title="競合に負けている可能性がある要素" variant="issue">
              <OnePagerList items={weaknessItems} maxItems={3} numbered />
            </SummaryBlock>

            <SummaryBlock title="市場共通の不満" variant="issue">
              <OnePagerList items={complaintItems} maxItems={3} />
            </SummaryBlock>
          </div>

          {/* 推奨アクション */}
          <SummaryBlock title="次に取るべきアクション" variant="action">
            <OnePagerList items={actionItems} maxItems={5} numbered />
          </SummaryBlock>

          {/* 免責 */}
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            本比較サマリーは選択されたプロジェクトのレビュー分析結果をもとにした比較です。競合優位性の判断には、価格・広告・販売チャネル等の外部情報も合わせて確認してください。
          </p>
        </div>
      </OnePagerLayout>
    </>
  )
}
