import { CheckCircle2, XCircle, Clock, Layers, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ChunkStatus } from '@/types/analysis'

interface ChunkSummary {
  status: ChunkStatus
}

interface AnalysisStatusCardProps {
  chunks: ChunkSummary[]
  totalTokensUsed: number | null
  analysisCompletedAt: string | null
}

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

export function AnalysisStatusCard({
  chunks,
  totalTokensUsed,
  analysisCompletedAt,
}: AnalysisStatusCardProps) {
  const total = chunks.length
  const done = chunks.filter((c) => c.status === 'done').length
  const error = chunks.filter((c) => c.status === 'error').length
  const pending = chunks.filter(
    (c) => c.status === 'pending' || c.status === 'processing'
  ).length
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          分析ステータス
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>チャンク進捗</span>
            <span className="tabular-nums font-medium">
              {done} / {total} ({progressPct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span className="text-muted-foreground">完了:</span>
            <span className="font-semibold tabular-nums">{done}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <span className="text-muted-foreground">エラー:</span>
            <span className="font-semibold tabular-nums">{error}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">未処理:</span>
            <span className="font-semibold tabular-nums">{pending}</span>
          </div>
          {totalTokensUsed != null && (
            <div className="flex items-center gap-1.5 text-sm">
              <Zap className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
              <span className="text-muted-foreground">トークン:</span>
              <span className="font-semibold tabular-nums">
                {totalTokensUsed.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {analysisCompletedAt && (
          <p className="text-xs text-muted-foreground">
            完了日時: {formatDateTime(analysisCompletedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
