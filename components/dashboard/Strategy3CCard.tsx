'use client'

import { Users, Target, Building2, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Strategy3C, Strategy3CSection } from '@/types/analysis'

// Section configs
const SECTIONS = [
  {
    key: 'customer' as const,
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    accent: 'bg-blue-600',
  },
  {
    key: 'competitor' as const,
    icon: Target,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    accent: 'bg-amber-500',
  },
  {
    key: 'company' as const,
    icon: Building2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    accent: 'bg-emerald-600',
  },
  {
    key: 'winning_strategy' as const,
    icon: Zap,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    accent: 'bg-violet-600',
  },
]

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
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className={config.color}>{section.title}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {section.summary}
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {section.bullets.length > 0 && (
          <ul className="space-y-1.5">
            {section.bullets.slice(0, 4).map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${config.accent}`} />
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        )}
        {section.key_message && (
          <div className={`rounded-md px-3 py-2 ${config.badge}`}>
            <p className="text-xs font-medium leading-relaxed">
              💡 {section.key_message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

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
