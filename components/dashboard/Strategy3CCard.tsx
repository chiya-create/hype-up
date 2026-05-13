'use client'

import { Users, Target, Building2, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Strategy3C, Strategy3CSection } from '@/types/analysis'

// ---------------------------------------------------------------------------
// Section color configs
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    key: 'customer' as const,
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    dot: 'bg-blue-500',
  },
  {
    key: 'competitor' as const,
    icon: Target,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  {
    key: 'company' as const,
    icon: Building2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    key: 'winning_strategy' as const,
    icon: Zap,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
]

// ---------------------------------------------------------------------------
// BulletItem — 「ラベル：値」を split してラベルを太字表示
// ---------------------------------------------------------------------------

function BulletItem({
  text,
  dot,
}: {
  text: string
  dot: string
}) {
  // 全角コロン「：」でラベルと値を分割
  const colonIdx = text.indexOf('：')
  const label = colonIdx > 0 ? text.slice(0, colonIdx) : null
  const value = colonIdx > 0 ? text.slice(colonIdx + 1) : text

  return (
    <li className="flex items-baseline gap-2 text-xs">
      <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="leading-[1.6]">
        {label && (
          <span className="font-semibold text-foreground/90">{label}：</span>
        )}
        <span className="text-foreground/75">{value}</span>
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------

interface SectionCardProps {
  section: Strategy3CSection
  config: (typeof SECTIONS)[number]
}

function SectionCard({ section, config }: SectionCardProps) {
  const Icon = config.icon
  return (
    <Card className={`border ${config.border} ${config.bg}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
          <span className={config.color}>{section.title}</span>
        </CardTitle>
        {section.summary && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {section.summary}
          </p>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {section.bullets.length > 0 && (
          <ul className="space-y-2">
            {section.bullets.slice(0, 3).map((b, i) => (
              <BulletItem key={i} text={b} dot={config.dot} />
            ))}
          </ul>
        )}

        {section.key_message && (
          <div className={`rounded-md px-3 py-2 ${config.badge}`}>
            <p className="text-xs font-medium leading-[1.6]">
              💡 {section.key_message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Strategy3CCard (public)
// ---------------------------------------------------------------------------

interface Strategy3CCardProps {
  data: Strategy3C
}

export function Strategy3CCard({ data }: Strategy3CCardProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">戦略3C分析</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          レビューデータから Customer / Competitor / Company の3軸と勝ち筋を整理しました
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map((cfg) => (
          <SectionCard key={cfg.key} section={data[cfg.key]} config={cfg} />
        ))}
      </div>
    </div>
  )
}
