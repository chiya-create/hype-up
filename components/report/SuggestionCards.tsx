import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LpSuggestion, AdCopySuggestion, ContentIdea } from '@/types/analysis'

// ── LP改善案

function LpCard({ lp }: { lp: LpSuggestion }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{lp.section}</Badge>
          <CardTitle className="text-sm font-semibold leading-snug">{lp.headline}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        {lp.body && (
          <p className="text-sm text-muted-foreground leading-relaxed">{lp.body}</p>
        )}
        {lp.evidence && (
          <p className="text-xs text-muted-foreground italic">根拠: {lp.evidence}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── 広告コピー案

function AdCard({ ad }: { ad: AdCopySuggestion }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{ad.platform}</Badge>
          {ad.target_persona && (
            <span className="text-xs text-muted-foreground">→ {ad.target_persona}</span>
          )}
        </div>
        <CardTitle className="text-sm font-bold mt-1">{ad.headline}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        {ad.body && (
          <p className="text-sm text-muted-foreground leading-relaxed">{ad.body}</p>
        )}
        {ad.cta && (
          <p className="text-xs font-semibold text-primary">CTA: {ad.cta}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── コンテンツアイデア

function ContentCard({ idea }: { idea: ContentIdea }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">{idea.format}</Badge>
          <CardTitle className="text-sm font-semibold">{idea.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">
        {idea.angle && (
          <p className="text-xs text-muted-foreground">{idea.angle}</p>
        )}
        {idea.key_message && (
          <p className="text-xs font-semibold text-primary">{idea.key_message}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── 統合コンポーネント

type SuggestionCardsProps =
  | { type: 'lp'; items: LpSuggestion[] }
  | { type: 'ad'; items: AdCopySuggestion[] }
  | { type: 'content'; items: ContentIdea[] }

export function SuggestionCards(props: SuggestionCardsProps) {
  if (props.items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">該当データはありません</p>
  }

  if (props.type === 'lp') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {props.items.map((item, i) => (
          <LpCard key={i} lp={item} />
        ))}
      </div>
    )
  }

  if (props.type === 'ad') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {props.items.map((item, i) => (
          <AdCard key={i} ad={item} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {props.items.map((item, i) => (
        <ContentCard key={i} idea={item} />
      ))}
    </div>
  )
}
