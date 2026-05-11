'use client'

import { useEffect, useRef, useState } from 'react'
import { Presentation, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STEPS = [
  '「PPTX出力」ボタンでファイルをダウンロード',
  'Google Drive を開き、ダウンロードしたファイルをアップロード',
  'アップロードしたファイルを右クリック →「アプリで開く」→「Google スライド」を選択',
  '必要に応じてレイアウトを調整して完成',
]

export function GoogleSlidesExportButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative no-print">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'gap-1.5'
        )}
      >
        <Presentation className="h-4 w-4" />
        Google Slides
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border bg-background shadow-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug">
              Google Slides連携は準備中です
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            現在はPPTXをダウンロードしてGoogle Slidesにアップロードしてください。
          </p>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">手順</p>
            <ol className="space-y-1">
              {STEPS.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="shrink-0 font-semibold text-primary">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-[10px] text-muted-foreground border-t pt-2">
            Google Drive APIによる自動連携はPhase 2で対応予定です。
          </p>
        </div>
      )}
    </div>
  )
}
