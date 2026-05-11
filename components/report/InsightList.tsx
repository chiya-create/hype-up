import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MarketingInsight } from '@/types/analysis'

const PRIORITY_VARIANT = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
} as const

const PRIORITY_LABEL = {
  high: '優先度 高',
  medium: '優先度 中',
  low: '優先度 低',
} as const

interface InsightListProps {
  insights: MarketingInsight[]
}

export function InsightList({ insights }: InsightListProps) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">該当データはありません</p>
    )
  }

  return (
    <ol className="space-y-5">
      {insights.map((ins, i) => (
        <li key={i} className="space-y-1.5">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-sm font-bold text-muted-foreground tabular-nums shrink-0 mt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <Badge
              variant={PRIORITY_VARIANT[ins.priority] ?? 'secondary'}
              className="text-xs shrink-0"
            >
              {PRIORITY_LABEL[ins.priority] ?? ins.priority}
            </Badge>
            <p className="text-sm font-semibold leading-snug flex-1">{ins.insight}</p>
          </div>
          {ins.rationale && (
            <p className="text-xs text-muted-foreground leading-relaxed pl-8">
              {ins.rationale}
            </p>
          )}
          {ins.suggested_action && (
            <div className="flex items-start gap-1.5 pl-8">
              <ChevronRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-primary">{ins.suggested_action}</p>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
