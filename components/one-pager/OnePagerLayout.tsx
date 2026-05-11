import type { ReactNode } from 'react'
import { BarChart3 } from 'lucide-react'
import { PrintButton } from '@/components/print/PrintButton'

interface MetaItem {
  label: string
  value: string
}

interface OnePagerLayoutProps {
  title: string
  subtitle?: string
  meta: MetaItem[]
  children: ReactNode
  /** 操作バー右側に追加するボタン等（印刷時非表示） */
  actions?: ReactNode
}

export function OnePagerLayout({
  title,
  subtitle,
  meta,
  children,
  actions,
}: OnePagerLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* 操作バー — 印刷時非表示 */}
      <div className="no-print border-b bg-muted/30 px-6 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          1枚サマリー — 印刷 / PDF保存に最適化されています
        </p>
        <div className="flex items-center gap-2">
          {actions}
          <PrintButton />
        </div>
      </div>

      {/* 印刷本体 */}
      <div className="one-pager-page max-w-[210mm] mx-auto px-8 py-6">
        {/* ページヘッダー */}
        <div className="flex items-start justify-between mb-4 pb-3 border-b">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] font-bold text-muted-foreground tracking-wide">
                Hype Up AI
              </span>
            </div>
            <h1 className="text-xl font-bold leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-xs">{subtitle}</p>
            )}
          </div>

          <div className="shrink-0 ml-6 text-right space-y-0.5">
            {meta.map(({ label, value }) => (
              <p key={label} className="text-[11px] text-muted-foreground">
                <span className="font-medium">{label}:</span>{' '}
                <span>{value}</span>
              </p>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        {children}
      </div>
    </div>
  )
}
