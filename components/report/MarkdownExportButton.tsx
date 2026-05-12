'use client'

import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateProjectReportMarkdown } from '@/components/report/markdown'
import type { ProjectAnalysis } from '@/types/analysis'

interface ProjectMeta {
  name: string
  description: string | null
  review_count: number
  analysis_completed_at: string | null
}

interface ChunkStats {
  total: number
  done: number
  error: number
}

interface MarkdownExportButtonProps {
  project: ProjectMeta
  analysis: ProjectAnalysis
  chunkStats: ChunkStats
}

export function MarkdownExportButton({
  project,
  analysis,
  chunkStats,
}: MarkdownExportButtonProps) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleCopy = async () => {
    const md = generateProjectReportMarkdown(project, analysis, chunkStats)
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: textarea
      const ta = document.createElement('textarea')
      ta.value = md
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    try {
      setDownloading(true)
      const md = generateProjectReportMarkdown(project, analysis, chunkStats)
      const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      // ファイル名：プロジェクト名をサニタイズして使用
      const safeName = project.name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 40)
      a.href = url
      a.download = `${safeName}_レポート.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('レポートダウンロードに失敗しました', err)
      alert('レポートのダウンロードに失敗しました。もう一度お試しください。')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex gap-1.5">
      {/* .md ファイルダウンロード */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={downloading}
        onClick={handleDownload}
        title="Markdown ファイルとしてダウンロード"
      >
        <Download className="h-3.5 w-3.5" />
        レポート出力
      </Button>

      {/* クリップボードコピー */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => void handleCopy()}
        title="Markdown をクリップボードにコピー"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-600" />
            <span className="text-green-600">コピー済</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            MDコピー
          </>
        )}
      </Button>
    </div>
  )
}
