'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { AppealWord } from '@/types/analysis'

interface AppealWordsCloudProps {
  data: AppealWord[]
}

function getWordSize(score: number): string {
  if (score >= 80) return 'text-2xl font-bold'
  if (score >= 60) return 'text-xl font-semibold'
  if (score >= 40) return 'text-base font-medium'
  return 'text-sm font-normal'
}

function getWordColor(score: number): string {
  if (score >= 80) return 'text-primary'
  if (score >= 60) return 'text-foreground'
  if (score >= 40) return 'text-muted-foreground'
  return 'text-muted-foreground/70'
}

export function AppealWordsCloud({ data }: AppealWordsCloudProps) {
  if (data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          訴求ワードのデータがありません
        </CardContent>
      </Card>
    )
  }

  const sorted = [...data].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-6">
      {/* Word cloud */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex flex-wrap gap-3 items-center justify-center min-h-32">
            {sorted.map((word, i) => (
              <span
                key={i}
                className={`cursor-default leading-tight ${getWordSize(word.score)} ${getWordColor(word.score)}`}
                title={`スコア: ${word.score} / 頻度: ${word.frequency}`}
              >
                {word.word}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail cards */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground">上位ワード詳細</h4>
        {sorted.slice(0, 10).map((word, i) => (
          <Card key={i}>
            <CardContent className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="shrink-0 min-w-[80px]">
                <p className={`${getWordSize(word.score)} ${getWordColor(word.score)}`}>
                  {word.word}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  スコア {word.score} · {word.frequency} 回
                </p>
              </div>
              <div className="space-y-1 flex-1">
                {word.context && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    文脈: {word.context}
                  </p>
                )}
                {word.suggested_use && (
                  <p className="text-xs font-medium text-primary leading-relaxed">
                    活用法: {word.suggested_use}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
