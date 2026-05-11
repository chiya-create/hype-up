'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'

export interface ProjectForCompare {
  id: string
  name: string
  industry: string
  review_count: number
  analysis_completed_at: string | null
}

interface CompareProjectSelectorProps {
  projects: ProjectForCompare[]
  preselectedId?: string
}

export function CompareProjectSelector({ projects, preselectedId }: CompareProjectSelectorProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(
    preselectedId ? [preselectedId] : []
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  const selectedProjects = projects.filter((p) => selected.includes(p.id))
  const industries = [...new Set(selectedProjects.map((p) => p.industry))]
  const hasIndustryMismatch = industries.length > 1

  const handleCompare = () => {
    if (selected.length < 2) return
    router.push(`/compare/result?ids=${selected.join(',')}`)
  }

  return (
    <div className="space-y-4">
      {/* 選択状況 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.length === 0
            ? '2〜3件選択してください'
            : `${selected.length} 件選択中（最大3件）`}
        </p>
        <Button
          onClick={handleCompare}
          disabled={selected.length < 2}
          size="sm"
          className="gap-1.5"
        >
          比較する
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 業界違い警告 */}
      {hasIndustryMismatch && (
        <div className="flex items-start gap-2 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <span className="text-yellow-800 dark:text-yellow-300">
            異なる業界のプロジェクトを選択しています。同じ業界のプロジェクト同士の比較を推奨します。
          </span>
        </div>
      )}

      {/* プロジェクトリスト */}
      <div className="space-y-2">
        {projects.map((project) => {
          const isChecked = selected.includes(project.id)
          const isDisabled = !isChecked && selected.length >= 3
          const industryLabel =
            INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId]?.label ??
            project.industry

          return (
            <label
              key={project.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                isChecked
                  ? 'border-primary bg-primary/5'
                  : isDisabled
                    ? 'border-muted bg-muted/20 opacity-50 cursor-not-allowed'
                    : 'border-muted hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(project.id)}
                disabled={isDisabled}
                className="h-4 w-4 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground">
                  {project.review_count.toLocaleString()} 件のレビュー
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-normal shrink-0">
                {industryLabel}
              </Badge>
            </label>
          )
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          分析完了済みのプロジェクトがありません
        </div>
      )}
    </div>
  )
}
