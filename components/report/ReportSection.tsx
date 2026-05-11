import type { ReactNode } from 'react'

interface ReportSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function ReportSection({
  title,
  description,
  children,
  className,
}: ReportSectionProps) {
  return (
    <section className={['print-section', className].filter(Boolean).join(' ')}>
      <div className="mb-4 pb-2 border-b">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}
