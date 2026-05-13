'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ComparisonPptxExportButtonProps {
  reportId: string
}

export function ComparisonPptxExportButton({ reportId }: ComparisonPptxExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/compare/reports/${reportId}/export-pptx`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error ?? 'PPTX出力に失敗しました')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `hype-up-comparison-${date}.pptx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('PPTX出力に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 no-print"
      disabled={loading}
      onClick={handleDownload}
      title="比較レポートをPPTXとしてダウンロード"
    >
      <Download className="h-3.5 w-3.5" />
      {loading ? 'PPTX生成中...' : 'PPTX出力'}
    </Button>
  )
}
