import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  BarChart3,
  ArrowLeft,
  Bug,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react'
// TODO(Phase 3): createServerUserClient() に切り替え後、RLS ポリシーで analysis_chunks / reviews を自組織に制限する
// service role を維持: デバッグ画面は全チャンク・全レビューデータが必要なため
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUserAccessContext, isPlatformAdmin } from '@/lib/auth/permissions'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type {
  ChunkStatus,
  RatingPoint,
  Complaint,
  PurchaseReason,
  AppealWord,
} from '@/types/analysis'

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const CHUNK_STATUS_VARIANT: Record<
  ChunkStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'secondary',
  processing: 'default',
  done: 'outline',
  error: 'destructive',
}

const CHUNK_STATUS_LABEL: Record<ChunkStatus, string> = {
  pending: '待機中',
  processing: '処理中',
  done: '完了',
  error: 'エラー',
}

// ---------------------------------------------------------------------------
// Chunk quality analysis
// ---------------------------------------------------------------------------

interface QualityIssue {
  level: 'error' | 'warn' | 'ok'
  field: string
  message: string
  hint?: string
}

function analyzeChunkQuality(chunk: {
  status: string
  raw_response: unknown
  rating_points: unknown
  complaints: unknown
  purchase_reasons: unknown
  customer_types: unknown
  appeal_words: unknown
  summary: string | null
}): QualityIssue[] {
  const issues: QualityIssue[] = []

  if (chunk.status !== 'done') return issues

  // ── JSON parse check
  const rawText =
    chunk.raw_response && typeof chunk.raw_response === 'object'
      ? (chunk.raw_response as Record<string, unknown>).text
      : null

  if (!rawText || typeof rawText !== 'string') {
    issues.push({
      level: 'error',
      field: 'raw_response',
      message: 'raw_response.text が存在しないか空です',
      hint: 'Claude API が空レスポンスを返した可能性があります。チャンクのレビュー内容を確認してください',
    })
  } else {
    // JSON 抽出テスト
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    const jsonStr = fenced?.[1] ?? (() => {
      const s = rawText.indexOf('{')
      const e = rawText.lastIndexOf('}')
      return s !== -1 && e > s ? rawText.slice(s, e + 1) : null
    })()

    if (!jsonStr) {
      issues.push({
        level: 'error',
        field: 'raw_response',
        message: 'レスポンスから JSON を抽出できませんでした',
        hint: 'プロンプトの「JSON形式のみで回答」指示を強化するか、max_tokens を増やしてください',
      })
    } else {
      try {
        JSON.parse(jsonStr)
        issues.push({ level: 'ok', field: 'raw_response', message: 'JSON parse 成功' })
      } catch {
        issues.push({
          level: 'error',
          field: 'raw_response',
          message: 'JSON parse に失敗しました',
          hint: 'レスポンスが途中で切れている可能性があります。max_tokens を増やしてください',
        })
      }
    }
  }

  // ── rating_points
  const rp = Array.isArray(chunk.rating_points) ? (chunk.rating_points as RatingPoint[]) : []
  if (rp.length === 0) {
    issues.push({
      level: 'warn',
      field: 'rating_points',
      message: '評価ポイントが 0 件です',
      hint: 'プロンプトで「最低 3 件抽出する」と明示してください',
    })
  } else {
    issues.push({ level: 'ok', field: 'rating_points', message: `${rp.length} 件` })
    const noPhrase = rp.filter((r) => !r.copyworthy_phrases || r.copyworthy_phrases.length === 0)
    if (noPhrase.length > 0) {
      issues.push({
        level: 'warn',
        field: 'rating_points.copyworthy_phrases',
        message: `${noPhrase.length} 件の評価ポイントでコピーフレーズが空です`,
        hint: '「顧客の原文をそのまま広告・LPコピーとして使えるフレーズを 2〜3 個抽出する」と強調してください',
      })
    }
  }

  // ── complaints
  const comp = Array.isArray(chunk.complaints) ? (chunk.complaints as Complaint[]) : []
  if (comp.length === 0) {
    issues.push({
      level: 'warn',
      field: 'complaints',
      message: '不満点が 0 件です',
      hint: 'ネガティブ・中立レビューが少ない場合や、プロンプトで不満の抽出が軽視されている場合があります',
    })
  } else {
    issues.push({ level: 'ok', field: 'complaints', message: `${comp.length} 件` })

    // FAQ 形式チェック（Q:/A: パターンを含むか）
    const noFaq = comp.filter(
      (c) =>
        !c.faq_suggestion ||
        c.faq_suggestion.length < 20 ||
        !/[QAqa][:：]/.test(c.faq_suggestion)
    )
    if (noFaq.length > 0) {
      issues.push({
        level: 'warn',
        field: 'complaints.faq_suggestion',
        message: `${noFaq.length} 件の不満点で FAQ が Q:/A: 形式になっていません（または短すぎます）`,
        hint: 'プロンプトで「Q: ○○ A: ○○ という形式で記述する」と明示してください',
      })
    }

    // LP 改善案チェック
    const noLpCounter = comp.filter(
      (c) => !c.lp_counter_suggestion || c.lp_counter_suggestion.length < 15
    )
    if (noLpCounter.length > 0) {
      issues.push({
        level: 'warn',
        field: 'complaints.lp_counter_suggestion',
        message: `${noLpCounter.length} 件の不満点で LP 改善案が空または短すぎます`,
        hint: '「LPの[セクション名]で[具体的なコンテンツ]を追加する」という形式を指定してください',
      })
    }
  }

  // ── purchase_reasons
  const pr = Array.isArray(chunk.purchase_reasons)
    ? (chunk.purchase_reasons as PurchaseReason[])
    : []
  if (pr.length === 0) {
    issues.push({
      level: 'warn',
      field: 'purchase_reasons',
      message: '購入理由が 0 件です',
    })
  } else {
    issues.push({ level: 'ok', field: 'purchase_reasons', message: `${pr.length} 件` })

    // deep_psychology チェック
    const shallowDeep = pr.filter(
      (p) => !p.deep_psychology || p.deep_psychology.length < 20
    )
    if (shallowDeep.length > 0) {
      issues.push({
        level: 'warn',
        field: 'purchase_reasons.deep_psychology',
        message: `${shallowDeep.length} 件の購入理由で deep_psychology が空または 20 文字未満です`,
        hint: '「感情的ベネフィット・深層の動機（不安解消・自己効力感・社会的承認）を必ず記述する」と強調してください',
      })
    }

    // surface_reason チェック
    const noSurface = pr.filter(
      (p) => !p.surface_reason || p.surface_reason.length < 10
    )
    if (noSurface.length > 0) {
      issues.push({
        level: 'warn',
        field: 'purchase_reasons.surface_reason',
        message: `${noSurface.length} 件の購入理由で surface_reason が空または 10 文字未満です`,
      })
    }
  }

  // ── appeal_words
  const aw = Array.isArray(chunk.appeal_words) ? (chunk.appeal_words as AppealWord[]) : []
  if (aw.length === 0) {
    issues.push({
      level: 'warn',
      field: 'appeal_words',
      message: '訴求ワードが 0 件です',
      hint: '「最低 5 件・単語と短フレーズを混ぜる」と指定してください',
    })
  } else if (aw.length < 3) {
    issues.push({
      level: 'warn',
      field: 'appeal_words',
      message: `訴求ワードが ${aw.length} 件のみです（5 件以上推奨）`,
    })
  } else {
    issues.push({ level: 'ok', field: 'appeal_words', message: `${aw.length} 件` })

    // 短すぎるワードチェック
    const shortWords = aw.filter((w) => !w.word || w.word.length < 1)
    if (shortWords.length > 0) {
      issues.push({
        level: 'warn',
        field: 'appeal_words.word',
        message: `${shortWords.length} 件のワードが空です`,
      })
    }

    // suggested_use チェック
    const noUse = aw.filter((w) => !w.suggested_use || w.suggested_use.length < 5)
    if (noUse.length > 0) {
      issues.push({
        level: 'warn',
        field: 'appeal_words.suggested_use',
        message: `${noUse.length} 件のワードで活用法（suggested_use）が空または短すぎます`,
        hint: '「LP・広告・SNS のどのポジション（ヘッドライン/ボディ/CTA）で使うかを具体的に」と指定してください',
      })
    }
  }

  // ── summary
  if (!chunk.summary || chunk.summary.length < 30) {
    issues.push({
      level: 'warn',
      field: 'summary',
      message: `チャンクサマリーが短すぎます（${chunk.summary?.length ?? 0} 文字 / 30 文字以上推奨）`,
      hint: '「マーケターが次の施策を決めるための洞察として 2〜3 文で書く」と指定してください',
    })
  } else {
    issues.push({ level: 'ok', field: 'summary', message: `${chunk.summary.length} 文字` })
  }

  return issues
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground text-xs">null</span>
  }
  return (
    <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-96 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function Collapsible({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="cursor-pointer select-none list-none flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground py-1">
        <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

function IssueRow({ issue }: { issue: QualityIssue }) {
  const Icon =
    issue.level === 'ok'
      ? CheckCircle2
      : issue.level === 'error'
        ? XCircle
        : AlertTriangle
  const color =
    issue.level === 'ok'
      ? 'text-green-500'
      : issue.level === 'error'
        ? 'text-destructive'
        : 'text-yellow-500'

  return (
    <li className="space-y-0.5">
      <div className="flex items-start gap-2 text-xs">
        <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} />
        <div className="flex-1">
          <span className="font-mono text-muted-foreground mr-1.5">{issue.field}</span>
          <span className={issue.level === 'ok' ? 'text-muted-foreground' : ''}>
            {issue.message}
          </span>
        </div>
      </div>
      {issue.hint && issue.level !== 'ok' && (
        <p className="text-xs text-blue-700 dark:text-blue-400 pl-5 leading-relaxed">
          💡 {issue.hint}
        </p>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const REVIEW_CHECKLIST = [
  {
    icon: '📌',
    label: 'コピーフレーズの粒度',
    detail: 'rating_points.copyworthy_phrases が「広告ヘッドラインにそのまま使えるフレーズ」になっているか。「品質が良い」のような抽象的なラベルは NG。',
  },
  {
    icon: '❓',
    label: 'FAQ が Q/A 形式か',
    detail: 'complaints.faq_suggestion が「Q: ○○ですか？ A: ○○です。」という形式になっているか確認。',
  },
  {
    icon: '🧠',
    label: '購入理由の surface / deep 分離',
    detail: 'purchase_reasons.deep_psychology が「不安解消・自己効力感・承認欲求」などの感情ベースで記述されているか。「品質が良いから」のような surface 理由の繰り返しは NG。',
  },
  {
    icon: '🎯',
    label: '推奨アクションの具体性',
    detail: '統合分析の marketing_insights.suggested_action が「LP の○○セクションを△△に変更する」レベルまで具体化されているか。「改善が必要」のような抽象表現は NG。',
  },
  {
    icon: '💬',
    label: '訴求ワードの転用可能性',
    detail: 'appeal_words に単語だけでなく「モチモチ肌」「朝の気分が上がる」のような短いフレーズが含まれているか。suggested_use が LP・広告の具体的な掲載箇所を示しているか。',
  },
]

export default async function DebugPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // platform_admin 以外はアクセス不可
  const ctx = await getCurrentUserAccessContext()
  if (!isPlatformAdmin(ctx.role)) notFound()

  const supabase = createServiceClient()

  const [{ data: project }, { data: chunks }, { data: analysisRow }] =
    await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase
        .from('analysis_chunks')
        .select('*')
        .eq('project_id', id)
        .order('chunk_index'),
      supabase
        .from('project_analyses')
        .select(
          'id, project_id, chunk_count, total_tokens_used, summary, marketing_insights, raw_response, created_at, updated_at'
        )
        .eq('project_id', id)
        .maybeSingle(),
    ])

  // フィードバック取得（analysisRow.id が確定後に実行）
  const feedback = analysisRow
    ? await supabase
        .from('analysis_feedback')
        .select('*')
        .eq('target_type', 'project_analysis')
        .eq('target_id', analysisRow.id)
        .maybeSingle()
        .then((r) => r.data)
    : null

  if (!project) notFound()

  const chunkList = chunks ?? []

  // 全チャンクの品質チェック結果を事前計算
  const chunkQualityMap = new Map(
    chunkList.map((chunk) => [chunk.id, analyzeChunkQuality(chunk)])
  )

  // 全体のサマリー
  const totalIssues = Array.from(chunkQualityMap.values()).flatMap((issues) =>
    issues.filter((i) => i.level !== 'ok')
  ).length
  const totalOk = Array.from(chunkQualityMap.values()).flatMap((issues) =>
    issues.filter((i) => i.level === 'ok')
  ).length

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4 flex-wrap">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link
            href={`/projects/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground truncate max-w-xs"
          >
            {project.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium flex items-center gap-1">
            <Bug className="h-3.5 w-3.5" />
            デバッグ
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* タイトル */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bug className="h-5 w-5 text-muted-foreground" />
              分析デバッグ
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{project.name}</p>
          </div>
          <Link
            href={`/projects/${id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <ArrowLeft className="h-4 w-4" />
            プロジェクトへ戻る
          </Link>
        </div>

        {/* ── 確認ポイントガイド */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Info className="h-4 w-4" />
              このページで確認すべきポイント
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {REVIEW_CHECKLIST.map((item) => (
                <li key={item.label} className="flex gap-2.5">
                  <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                      {item.label}
                    </p>
                    <p className="text-xs text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* プロジェクト情報 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">プロジェクト情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono break-all">{project.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">ステータス</p>
                <p className="font-medium">{project.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">レビュー数</p>
                <p className="font-medium tabular-nums">{project.review_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground">チャンク数</p>
                <p className="font-medium tabular-nums">{chunkList.length}</p>
              </div>
            </div>
            {project.error_message && (
              <div className="rounded bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-muted-foreground mb-0.5">エラーメッセージ</p>
                <p className="text-destructive">{project.error_message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 品質チェックサマリー */}
        {chunkList.some((c) => c.status === 'done') && (
          <div
            className={cn(
              'rounded-lg border px-4 py-3 flex items-center gap-3 text-sm',
              totalIssues === 0
                ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800'
                : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800'
            )}
          >
            {totalIssues === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            )}
            <span>
              全チャンク品質チェック:{' '}
              <span className="font-semibold text-green-700 dark:text-green-400">
                OK {totalOk} 件
              </span>
              {totalIssues > 0 && (
                <>
                  {' / '}
                  <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                    要確認 {totalIssues} 件
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        {/* チャンク一覧 */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold">
            チャンク分析ログ
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {chunkList.length} 件
            </span>
          </h2>

          {chunkList.length === 0 ? (
            <p className="text-sm text-muted-foreground">チャンクがありません</p>
          ) : (
            chunkList.map((chunk) => {
              const status = chunk.status as ChunkStatus
              const reviewIds = (chunk.review_ids as string[]) ?? []
              const issues = chunkQualityMap.get(chunk.id) ?? []
              const ngIssues = issues.filter((i) => i.level !== 'ok')
              const hasIssues = ngIssues.length > 0

              return (
                <Card
                  key={chunk.id}
                  className={cn(
                    status === 'error'
                      ? 'border-destructive/40'
                      : hasIssues
                        ? 'border-yellow-300 dark:border-yellow-700'
                        : ''
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-sm">
                        チャンク #{chunk.chunk_index + 1}
                      </CardTitle>
                      <Badge variant={CHUNK_STATUS_VARIANT[status]} className="text-xs">
                        {CHUNK_STATUS_LABEL[status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {reviewIds.length} 件のレビュー
                      </span>
                      {issues.length > 0 && (
                        <span
                          className={`text-xs font-medium ${
                            hasIssues
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                          {hasIssues
                            ? `要確認 ${ngIssues.length} 件`
                            : `OK ${issues.length} 件`}
                        </span>
                      )}
                      {chunk.token_used != null && (
                        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                          {chunk.token_used.toLocaleString()} tokens
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {chunk.error_message && (
                      <div className="rounded bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                        <span className="font-medium">エラー: </span>
                        {chunk.error_message}
                      </div>
                    )}

                    {/* 品質チェック結果 */}
                    {issues.length > 0 && (
                      <Collapsible
                        summary={`品質チェック（${issues.filter((i) => i.level === 'ok').length} OK / ${ngIssues.length} 要確認）`}
                        defaultOpen={hasIssues}
                      >
                        <ul className="space-y-2 mt-2">
                          {issues.map((issue, i) => (
                            <IssueRow key={i} issue={issue} />
                          ))}
                        </ul>
                      </Collapsible>
                    )}

                    {chunk.summary && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">
                          チャンクサマリー
                          <span className="ml-1.5 font-normal">
                            ({chunk.summary.length} 文字)
                          </span>
                        </p>
                        <p className="text-xs leading-relaxed">{chunk.summary}</p>
                      </div>
                    )}

                    <Collapsible summary="raw_response（Claude 生出力）">
                      <JsonBlock value={chunk.raw_response} />
                    </Collapsible>

                    <Collapsible summary={`rating_points（${Array.isArray(chunk.rating_points) ? (chunk.rating_points as unknown[]).length : 0} 件）`}>
                      <JsonBlock value={chunk.rating_points} />
                    </Collapsible>

                    <Collapsible summary={`complaints（${Array.isArray(chunk.complaints) ? (chunk.complaints as unknown[]).length : 0} 件）`}>
                      <JsonBlock value={chunk.complaints} />
                    </Collapsible>

                    <Collapsible summary={`purchase_reasons（${Array.isArray(chunk.purchase_reasons) ? (chunk.purchase_reasons as unknown[]).length : 0} 件）`}>
                      <JsonBlock value={chunk.purchase_reasons} />
                    </Collapsible>

                    <Collapsible summary={`customer_types（${Array.isArray(chunk.customer_types) ? (chunk.customer_types as unknown[]).length : 0} 件）`}>
                      <JsonBlock value={chunk.customer_types} />
                    </Collapsible>

                    <Collapsible summary={`appeal_words（${Array.isArray(chunk.appeal_words) ? (chunk.appeal_words as unknown[]).length : 0} 件）`}>
                      <JsonBlock value={chunk.appeal_words} />
                    </Collapsible>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* 統合分析ログ */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold">統合分析ログ（project_analyses）</h2>

          {!analysisRow ? (
            <p className="text-sm text-muted-foreground">
              まだ統合分析が実行されていません
            </p>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle className="text-sm">統合分析結果</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    チャンク数: {analysisRow.chunk_count}
                  </span>
                  {analysisRow.total_tokens_used != null && (
                    <span className="text-xs text-muted-foreground">
                      合計トークン: {analysisRow.total_tokens_used.toLocaleString()}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysisRow.summary && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">
                      統合サマリー
                      <span className="ml-1.5 font-normal">({analysisRow.summary.length} 文字)</span>
                    </p>
                    <p className="text-xs leading-relaxed">{analysisRow.summary}</p>
                  </div>
                )}

                {/* marketing_insights の suggested_action チェック */}
                {Array.isArray(analysisRow.marketing_insights) && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">
                      推奨アクション確認
                    </p>
                    <ul className="space-y-1.5">
                      {(analysisRow.marketing_insights as Array<{
                        insight: string
                        priority: string
                        suggested_action?: string
                      }>).map((ins, i) => {
                        const hasAction =
                          ins.suggested_action && ins.suggested_action.length >= 15
                        const isConcrete =
                          hasAction &&
                          /LP|広告|コピー|ページ|セクション|変更|追加|改善|制作|掲載/.test(
                            ins.suggested_action ?? ''
                          )
                        return (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            {isConcrete ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                            ) : hasAction ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="text-muted-foreground">
                                [{ins.priority}] {ins.insight}
                              </span>
                              {ins.suggested_action && (
                                <p className={`mt-0.5 ${isConcrete ? '' : 'text-yellow-700 dark:text-yellow-400'}`}>
                                  → {ins.suggested_action}
                                </p>
                              )}
                              {!hasAction && (
                                <p className="text-destructive mt-0.5">
                                  推奨アクションが空または短すぎます
                                </p>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                <Collapsible
                  summary="synthesis raw_response（Claude 生出力）"
                  defaultOpen
                >
                  <JsonBlock value={analysisRow.raw_response} />
                </Collapsible>
              </CardContent>
            </Card>
          )}
        </div>

        {/* フィードバック表示 */}
        {feedback && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold">保存済みフィードバック</h2>
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'サマリーの質', value: feedback.summary_quality },
                    { label: 'インサイトの質', value: feedback.insight_quality },
                    { label: 'コピー・訴求の質', value: feedback.copy_quality },
                    { label: 'アクション提案の質', value: feedback.action_quality },
                    { label: 'PPTX出力の質', value: feedback.pptx_quality },
                    { label: '総合評価', value: feedback.overall_score },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium">
                        {value != null ? `${'★'.repeat(value)}${'☆'.repeat(5 - value)} (${value}/5)` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
                {feedback.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">改善メモ</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{feedback.notes}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  最終更新: {new Date(feedback.updated_at).toLocaleString('ja-JP')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-right">
          Project ID: {id}
        </p>
      </main>
    </div>
  )
}
