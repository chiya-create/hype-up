'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StarRating } from './StarRating'

type TargetType = 'project_analysis' | 'comparison_report'

interface FeedbackState {
  summary_quality: number | null
  insight_quality: number | null
  copy_quality: number | null
  action_quality: number | null
  pptx_quality: number | null
  overall_score: number | null
  notes: string
}

const EMPTY: FeedbackState = {
  summary_quality: null,
  insight_quality: null,
  copy_quality: null,
  action_quality: null,
  pptx_quality: null,
  overall_score: null,
  notes: '',
}

interface FeedbackFormProps {
  targetType: TargetType
  targetId: string
  apiPath: string
}

export function FeedbackForm({ targetType, targetId, apiPath }: FeedbackFormProps) {
  const [state, setState] = useState<FeedbackState>(EMPTY)
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading')

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiPath)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setState({
            summary_quality: data.summary_quality ?? null,
            insight_quality: data.insight_quality ?? null,
            copy_quality: data.copy_quality ?? null,
            action_quality: data.action_quality ?? null,
            pptx_quality: data.pptx_quality ?? null,
            overall_score: data.overall_score ?? null,
            notes: data.notes ?? '',
          })
        }
      }
    } catch {
      // no existing feedback — start empty
    } finally {
      setStatus('idle')
    }
  }, [apiPath])

  useEffect(() => {
    void load()
  }, [load])

  const set = (field: keyof FeedbackState) => (value: number | string) =>
    setState((prev) => ({ ...prev, [field]: value }))

  async function handleSave() {
    setStatus('saving')
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, target_type: targetType, target_id: targetId }),
      })
      if (!res.ok) throw new Error('save failed')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  if (status === 'loading') return null

  return (
    <Card className="no-print border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground font-medium">
          分析品質フィードバック
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <StarRating label="サマリーの質" value={state.summary_quality} onChange={set('summary_quality') as (v: number) => void} />
          <StarRating label="インサイトの質" value={state.insight_quality} onChange={set('insight_quality') as (v: number) => void} />
          <StarRating label="コピー・訴求の質" value={state.copy_quality} onChange={set('copy_quality') as (v: number) => void} />
          <StarRating label="アクション提案の質" value={state.action_quality} onChange={set('action_quality') as (v: number) => void} />
          <StarRating label="PPTX出力の質" value={state.pptx_quality} onChange={set('pptx_quality') as (v: number) => void} />
          <div className="pt-1 border-t">
            <StarRating label="総合評価" value={state.overall_score} onChange={set('overall_score') as (v: number) => void} />
          </div>
        </div>

        <textarea
          placeholder="改善メモ・気になった点など自由に記入（任意）"
          value={state.notes}
          onChange={(e) => set('notes')(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={status === 'saving'}
            className="gap-1.5"
          >
            {status === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : status === 'saved' ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {status === 'saving' ? '保存中…' : status === 'saved' ? '保存しました' : 'フィードバックを保存'}
          </Button>
          {status === 'error' && (
            <span className="text-xs text-destructive">保存に失敗しました。再試行してください。</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
