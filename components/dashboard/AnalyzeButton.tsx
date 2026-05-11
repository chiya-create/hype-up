'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProjectStatus } from '@/types/analysis'

interface AnalyzeButtonProps {
  projectId: string
  currentStatus: ProjectStatus
}

export function AnalyzeButton({ projectId, currentStatus }: AnalyzeButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const isDone = currentStatus === 'done'
  const isRetry = currentStatus === 'error'
  const showButton = currentStatus === 'pending' || isRetry || isDone

  if (!showButton) return null

  const handleClick = () => {
    if (isDone || isRetry) {
      setConfirming(true)
    } else {
      void runAnalysis()
    }
  }

  const runAnalysis = async () => {
    setConfirming(false)
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? '分析に失敗しました')
        return
      }

      if (json.status === 'partial_error') {
        setError(
          `分析完了（一部エラー）— 成功: ${json.processed_chunks} チャンク / 失敗: ${json.failed_chunks} チャンク`
        )
      }

      router.refresh()
    } catch {
      setError('通信エラーが発生しました。ネットワークを確認してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={loading}
        variant={isDone ? 'outline' : 'default'}
        className="gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            分析中...
          </>
        ) : isDone || isRetry ? (
          <>
            <RefreshCw className="h-4 w-4" />
            再分析を実行
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            分析を開始
          </>
        )}
      </Button>

      {/* Inline confirmation */}
      {confirming && !loading && (
        <div className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 px-3 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
          <div className="space-y-2 flex-1">
            <p className="text-yellow-800 dark:text-yellow-300 text-xs leading-snug">
              再分析すると既存の分析結果が上書きされます。続けますか？
            </p>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => void runAnalysis()}>
                実行する
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setConfirming(false)}
              >
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground">
          レビューを分析中です。件数によって数分かかる場合があります。
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
