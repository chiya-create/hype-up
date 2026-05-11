import { BarChart3 } from 'lucide-react'

interface PrintableHeaderProps {
  title: string
  projectNames?: string[]
  industry?: string
  reviewCount?: number
  analysisDate?: string | null
}

export function PrintableHeader({
  title,
  projectNames,
  industry,
  reviewCount,
  analysisDate,
}: PrintableHeaderProps) {
  const printDate = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <div className="hidden print:block pb-6 mb-8 border-b">
      <div className="flex items-center gap-2 mb-3 text-muted-foreground">
        <BarChart3 className="h-4 w-4" />
        <span className="text-sm font-bold">Hype Up AI</span>
      </div>
      <h1 className="text-2xl font-bold leading-tight">{title}</h1>

      {projectNames && projectNames.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {projectNames.map((name) => (
            <span key={name} className="text-sm text-muted-foreground border rounded px-2 py-0.5">
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
        {industry && <span>業界: {industry}</span>}
        {reviewCount != null && <span>レビュー件数: {reviewCount.toLocaleString()} 件</span>}
        {analysisDate && <span>分析完了: {analysisDate}</span>}
        <span>印刷日: {printDate}</span>
      </div>
    </div>
  )
}
