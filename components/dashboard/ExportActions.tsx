'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Download, FileText, ChevronDown } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ExportActionsProps {
  projectId: string
  hasAnalysis?: boolean
  /** レポートページ上で使う場合は true にする（同一ページへの循環リンクを非表示）*/
  hideReportLink?: boolean
}

const EXPORT_TYPES = [
  { type: 'all', label: 'すべて' },
  { type: 'rating_points', label: '評価ポイント' },
  { type: 'complaints', label: '不満点' },
  { type: 'purchase_reasons', label: '購入理由' },
  { type: 'customer_types', label: '顧客タイプ' },
  { type: 'appeal_words', label: '訴求ワード' },
  { type: 'marketing_insights', label: 'マーケティング示唆' },
  { type: 'lp_suggestions', label: 'LP改善案' },
  { type: 'ad_copy_suggestions', label: '広告コピー案' },
  { type: 'content_ideas', label: 'コンテンツアイデア' },
] as const

export function ExportActions({ projectId, hasAnalysis = true, hideReportLink = false }: ExportActionsProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 外クリックで閉じる
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="flex flex-wrap gap-2">
      {/* CSV出力ドロップダウン */}
      <div ref={containerRef} className="relative">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!hasAnalysis}
          onClick={() => setOpen((v) => !v)}
        >
          <Download className="h-3.5 w-3.5" />
          CSV出力
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </Button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border bg-popover shadow-md py-1">
            {EXPORT_TYPES.map(({ type, label }) => (
              <a
                key={type}
                href={`/api/projects/${projectId}/export?type=${type}`}
                download
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {type === 'all' ? (
                  <span className="font-medium">{label}</span>
                ) : (
                  <span className="text-muted-foreground">{label}</span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* レポート出力 — レポートページ上では循環リンクになるため非表示 */}
      {!hideReportLink && (
        <Link
          href={`/projects/${projectId}/report`}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'gap-1.5',
            !hasAnalysis && 'pointer-events-none opacity-50',
          )}
          aria-disabled={!hasAnalysis}
          tabIndex={!hasAnalysis ? -1 : undefined}
        >
          <FileText className="h-3.5 w-3.5" />
          レポート出力
        </Link>
      )}
    </div>
  )
}
