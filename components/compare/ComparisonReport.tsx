import { CheckCircle2, AlertTriangle, Target, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  WinningAppeal,
  ComparisonStrength,
  ComparisonWeakness,
  SharedComplaint,
  ComparisonAction,
} from '@/types/analysis'

const PRIORITY_LABEL: Record<string, string> = {
  high: '高優先度',
  medium: '中優先度',
  low: '低優先度',
}
const PRIORITY_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
}

interface ComparisonReportProps {
  summary: string | null
  winningAppeals: WinningAppeal[]
  strengths: ComparisonStrength[]
  weaknesses: ComparisonWeakness[]
  sharedComplaints: SharedComplaint[]
  recommendedActions: ComparisonAction[]
  projectNames: string[]
}

export function ComparisonReport({
  summary,
  winningAppeals,
  strengths,
  weaknesses,
  sharedComplaints,
  recommendedActions,
  projectNames,
}: ComparisonReportProps) {
  return (
    <div className="space-y-8">
      {/* サマリー */}
      {summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              比較総括
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* 勝てる訴求 */}
      {winningAppeals.length > 0 && (
        <section className="print-section space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            プロジェクト別の勝ち筋訴求
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {winningAppeals.map((item, i) => (
              <Card key={i} className="border-green-200 dark:border-green-900">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {item.project_name}
                  </CardTitle>
                  <p className="text-sm font-semibold mt-0.5">{item.appeal}</p>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.why_it_wins}</p>
                  {item.suggested_copy && (
                    <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-0.5">コピー案</p>
                      <p className="text-xs text-green-800 dark:text-green-300 italic">「{item.suggested_copy}」</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 強み */}
      {strengths.length > 0 && (
        <section className="print-section space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            強み（固有 / 共通）
          </h3>
          <div className="space-y-2">
            {strengths.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.is_unique ? (
                      <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-400">
                        固有の強み
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">共通強み</Badge>
                    )}
                    {item.project_name && (
                      <span className="text-xs text-muted-foreground">{item.project_name}</span>
                    )}
                    {!item.project_name && (
                      <span className="text-xs text-muted-foreground">全プロジェクト</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 弱み */}
      {weaknesses.length > 0 && (
        <section className="print-section space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-orange-600" />
            改善余地のある要素
          </h3>
          <div className="space-y-2">
            {weaknesses.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/10 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.project_name}</span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  )}
                  {item.improvement_suggestion && (
                    <p className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                      改善案: {item.improvement_suggestion}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 市場共通の不満 */}
      {sharedComplaints.length > 0 && (
        <section className="print-section space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-600" />
            市場共通の不満（先に解決したブランドが有利）
          </h3>
          <div className="space-y-2">
            {sharedComplaints.map((item, i) => (
              <div key={i} className="rounded-lg border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-950/10 px-4 py-3 space-y-1">
                <p className="text-sm font-medium">{item.label}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                )}
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  該当プロジェクト: {item.affected_projects.join('、')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 推奨アクション */}
      {recommendedActions.length > 0 && (
        <section className="print-section space-y-3">
          <h3 className="text-base font-semibold">推奨アクション</h3>
          <div className="space-y-2">
            {recommendedActions
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 }
                return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
              })
              .map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border px-4 py-3">
                  <Badge
                    variant={PRIORITY_VARIANT[item.priority] ?? 'secondary'}
                    className="text-xs shrink-0 mt-0.5"
                  >
                    {PRIORITY_LABEL[item.priority] ?? item.priority}
                  </Badge>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{item.action}</p>
                      {item.project_name && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({item.project_name})
                        </span>
                      )}
                    </div>
                    {item.rationale && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.rationale}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}
