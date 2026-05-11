'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
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

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => void handleCopy()}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" />
          <span className="text-green-600">コピーしました</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Markdown をコピー
        </>
      )}
    </Button>
  )
}
