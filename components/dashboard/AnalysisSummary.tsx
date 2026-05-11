import { Clock, TrendingUp, Layout, Megaphone, BookOpen, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type {
  ProjectAnalysis,
  MarketingInsight,
  LpSuggestion,
  AdCopySuggestion,
  ContentIdea,
} from '@/types/analysis'

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------

const PRIORITY_VARIANT = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
} as const

const PRIORITY_LABEL = {
  high: '高',
  medium: '中',
  low: '低',
} as const

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ElementType
  title: string
  count: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <span className="text-xs text-muted-foreground">{count} 件</span>
    </div>
  )
}

function InsightCard({ insight }: { insight: MarketingInsight }) {
  return (
    <div className="space-y-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <Badge
          variant={PRIORITY_VARIANT[insight.priority] ?? 'secondary'}
          className="shrink-0 text-xs mt-0.5"
        >
          優先度 {PRIORITY_LABEL[insight.priority] ?? insight.priority}
        </Badge>
        <p className="text-sm font-medium leading-snug">{insight.insight}</p>
      </div>
      <p className="text-xs text-muted-foreground pl-0">{insight.rationale}</p>
      {insight.suggested_action && (
        <div className="flex items-start gap-1.5 pl-0">
          <ChevronRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary font-medium">{insight.suggested_action}</p>
        </div>
      )}
    </div>
  )
}

function LpCard({ lp }: { lp: LpSuggestion }) {
  return (
    <div className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{lp.section}</Badge>
      </div>
      <p className="text-sm font-medium">{lp.headline}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{lp.body}</p>
      {lp.evidence && (
        <p className="text-xs text-muted-foreground italic">根拠: {lp.evidence}</p>
      )}
    </div>
  )
}

function AdCard({ ad }: { ad: AdCopySuggestion }) {
  return (
    <div className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{ad.platform}</Badge>
        {ad.target_persona && (
          <span className="text-xs text-muted-foreground">→ {ad.target_persona}</span>
        )}
      </div>
      <p className="text-sm font-semibold">{ad.headline}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{ad.body}</p>
      {ad.cta && (
        <p className="text-xs font-medium text-primary">CTA: {ad.cta}</p>
      )}
    </div>
  )
}

function ContentCard({ idea }: { idea: ContentIdea }) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">{idea.format}</Badge>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{idea.title}</p>
        <p className="text-xs text-muted-foreground">{idea.angle}</p>
        {idea.key_message && (
          <p className="text-xs text-primary font-medium">{idea.key_message}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AnalysisSummaryProps {
  analysis: ProjectAnalysis | null
}

export function AnalysisSummary({ analysis }: AnalysisSummaryProps) {
  if (!analysis) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center space-y-2">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-medium text-muted-foreground">分析待ち</p>
          <p className="text-sm text-muted-foreground">
            「分析を開始」ボタンを押すと、AI による分析が実行されます。
          </p>
        </CardContent>
      </Card>
    )
  }

  const insights = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const lpSuggestions = (analysis.lp_suggestions ?? []) as LpSuggestion[]
  const adCopies = (analysis.ad_copy_suggestions ?? []) as AdCopySuggestion[]
  const contentIdeas = (analysis.content_ideas ?? []) as ContentIdea[]

  return (
    <div className="space-y-6">
      {/* 総評 */}
      {analysis.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI 総評</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {analysis.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* マーケティング示唆 */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={TrendingUp}
              title="マーケティング示唆"
              count={insights.length}
            />
          </CardHeader>
          <CardContent>
            {insights.map((insight, i) => (
              <div key={i}>
                {i > 0 && <Separator className="my-0" />}
                <InsightCard insight={insight} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* LP改善提案 */}
      {lpSuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Layout}
              title="LP 改善提案"
              count={lpSuggestions.length}
            />
          </CardHeader>
          <CardContent>
            {lpSuggestions.map((lp, i) => (
              <div key={i}>
                {i > 0 && <Separator className="my-0" />}
                <LpCard lp={lp} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 広告コピー提案 */}
      {adCopies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Megaphone}
              title="広告コピー提案"
              count={adCopies.length}
            />
          </CardHeader>
          <CardContent>
            {adCopies.map((ad, i) => (
              <div key={i}>
                {i > 0 && <Separator className="my-0" />}
                <AdCard ad={ad} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* コンテンツアイデア */}
      {contentIdeas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader
              icon={BookOpen}
              title="コンテンツアイデア"
              count={contentIdeas.length}
            />
          </CardHeader>
          <CardContent>
            {contentIdeas.map((idea, i) => (
              <div key={i}>
                {i > 0 && <Separator className="my-0" />}
                <ContentCard idea={idea} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* メタ情報 */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>チャンク数: {analysis.chunk_count}</span>
        {analysis.total_tokens_used != null && (
          <span>消費トークン: {analysis.total_tokens_used.toLocaleString()}</span>
        )}
      </div>
    </div>
  )
}
