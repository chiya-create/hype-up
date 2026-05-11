import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'conclusion' | 'strength' | 'issue' | 'action'

const BORDER: Record<Variant, string> = {
  conclusion: 'border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30',
  strength:   'border-green-200 bg-green-50/70 dark:border-green-900 dark:bg-green-950/30',
  issue:      'border-orange-200 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/30',
  action:     'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30',
}

const TITLE_COLOR: Record<Variant, string> = {
  conclusion: 'text-blue-700 dark:text-blue-300',
  strength:   'text-green-700 dark:text-green-300',
  issue:      'text-orange-700 dark:text-orange-300',
  action:     'text-violet-700 dark:text-violet-300',
}

interface SummaryBlockProps {
  title: string
  variant?: Variant
  className?: string
  children: ReactNode
}

export function SummaryBlock({
  title,
  variant = 'conclusion',
  className,
  children,
}: SummaryBlockProps) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2.5 print-section',
        BORDER[variant],
        className
      )}
    >
      <p className={cn('text-[10px] font-bold uppercase tracking-widest mb-1.5', TITLE_COLOR[variant])}>
        {title}
      </p>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}
