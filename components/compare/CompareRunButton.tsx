'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface CompareRunButtonProps {
  projectIds: string[]
}

export function CompareRunButton({ projectIds }: CompareRunButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '比較分析に失敗しました')
        return
      }
      router.push(`/compare/reports/${json.comparison_report_id}`)
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {loading && <Progress value={null} className="h-1" />}
      <Button
        onClick={handleRun}
        disabled={loading}
        size="lg"
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {loading ? 'Claude AI が比較分析中...' : '比較分析を実行（Claude AI）'}
      </Button>
      {loading && (
        <p className="text-xs text-muted-foreground">
          分析には30〜60秒ほどかかります。このページを閉じないでください。
        </p>
      )}
    </div>
  )
}
