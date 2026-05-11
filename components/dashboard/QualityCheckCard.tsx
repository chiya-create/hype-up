import Link from 'next/link'
import { CheckCircle2, AlertTriangle, Info, Bug } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProjectAnalysis } from '@/types/analysis'

interface CheckItem {
  label: string
  ok: boolean
  message: string
  hint?: string
}

function buildCheckItems(analysis: ProjectAnalysis): CheckItem[] {
  const ratingPoints = analysis.rating_points ?? []
  const complaints = analysis.complaints ?? []
  const purchaseReasons = analysis.purchase_reasons ?? []
  const customerTypes = analysis.customer_types ?? []
  const appealWords = analysis.appeal_words ?? []
  const insights = analysis.marketing_insights ?? []
  const lpSuggestions = analysis.lp_suggestions ?? []
  const adCopies = analysis.ad_copy_suggestions ?? []
  const contentIdeas = analysis.content_ideas ?? []
  const summary = analysis.summary ?? ''

  // copyworthy_phrases の充実度チェック
  const hasRichCopyPhrases = ratingPoints.some(
    (rp) => rp.copyworthy_phrases && rp.copyworthy_phrases.length >= 2
  )

  // deep_psychology の充実度チェック
  const hasDeepPsychology = purchaseReasons.some((pr) => pr.deep_psychology && pr.deep_psychology.length > 10)

  // faq_suggestion の充実度チェック
  const hasFaqSuggestions = complaints.some((c) => c.faq_suggestion && c.faq_suggestion.length > 10)

  // high priority insight の存在チェック
  const hasHighPriorityInsight = insights.some((ins) => ins.priority === 'high')

  // suggested_action の充実度チェック
  const hasSuggestedActions = insights.some((ins) => ins.suggested_action && ins.suggested_action.length > 5)

  return [
    {
      label: 'エグゼクティブサマリー',
      ok: summary.length >= 50,
      message:
        summary.length === 0
          ? 'サマリーが生成されていません'
          : summary.length < 50
            ? `サマリーが短すぎます（${summary.length} 文字 / 推奨 50 文字以上）`
            : `${summary.length} 文字`,
      hint:
        summary.length < 50
          ? 'プロンプトの summary フィールドに「マーケターへの示唆として 3〜5 文で書く」と追記してください'
          : undefined,
    },
    {
      label: '評価ポイント',
      ok: ratingPoints.length >= 2,
      message:
        ratingPoints.length === 0
          ? '評価ポイントが 0 件です'
          : ratingPoints.length === 1
            ? '評価ポイントが 1 件のみです（2 件以上推奨）'
            : `${ratingPoints.length} 件 OK`,
      hint:
        ratingPoints.length < 2
          ? 'rating_points を最低 3〜5 件抽出するようプロンプトの注意事項を強化してください'
          : undefined,
    },
    {
      label: 'コピー候補フレーズ',
      ok: hasRichCopyPhrases,
      message: hasRichCopyPhrases
        ? '評価ポイントからフレーズ抽出あり'
        : 'copyworthy_phrases が少ないか空です',
      hint: !hasRichCopyPhrases
        ? '「顧客の原文をそのまま広告・LPコピーとして使えるフレーズを 2〜3 個抽出する」とプロンプトに明示してください'
        : undefined,
    },
    {
      label: '不満点',
      ok: complaints.length >= 1,
      message:
        complaints.length === 0
          ? '不満点が 0 件です'
          : `${complaints.length} 件 OK`,
      hint:
        complaints.length === 0
          ? 'ネガティブ・中立レビューが少ない可能性があります。サンプル CSV や実データを確認してください'
          : undefined,
    },
    {
      label: 'FAQ 転用案',
      ok: hasFaqSuggestions,
      message: hasFaqSuggestions
        ? '不満点に FAQ 案あり'
        : 'faq_suggestion が空または短すぎます',
      hint: !hasFaqSuggestions
        ? '「この不満を FAQ 回答として事前に払拭する文を必ず生成する」とプロンプトに追記してください'
        : undefined,
    },
    {
      label: '購入理由',
      ok: purchaseReasons.length >= 1,
      message:
        purchaseReasons.length === 0
          ? '購入理由が 0 件です'
          : `${purchaseReasons.length} 件 OK`,
      hint:
        purchaseReasons.length === 0
          ? 'ポジティブレビューから購入動機を読み取れない場合があります。サンプルデータを確認してください'
          : undefined,
    },
    {
      label: '深層心理の分離',
      ok: hasDeepPsychology,
      message: hasDeepPsychology
        ? 'surface_reason / deep_psychology が分離されています'
        : 'deep_psychology が空か表面的です',
      hint: !hasDeepPsychology
        ? '「surface_reason（言語化された理由）と deep_psychology（感情的ベネフィット・深層の動機）を必ず分けて書く」とプロンプトに強調してください'
        : undefined,
    },
    {
      label: '顧客タイプ',
      ok: customerTypes.length >= 1,
      message:
        customerTypes.length === 0
          ? '顧客タイプが 0 件です'
          : `${customerTypes.length} 件 OK`,
      hint:
        customerTypes.length === 0
          ? 'レビュー件数が少ないとペルソナを分類しにくい場合があります'
          : undefined,
    },
    {
      label: '訴求ワード',
      ok: appealWords.length >= 3,
      message:
        appealWords.length < 3
          ? `訴求ワードが ${appealWords.length} 件です（3 件以上推奨）`
          : `${appealWords.length} 件 OK`,
      hint:
        appealWords.length < 3
          ? '「単語だけでなく広告・LP に使える短いフレーズも含めて 5〜10 件抽出する」とプロンプトに追記してください'
          : undefined,
    },
    {
      label: 'マーケティング示唆',
      ok: insights.length >= 2,
      message:
        insights.length === 0
          ? 'マーケティング示唆が 0 件です'
          : insights.length === 1
            ? '示唆が 1 件のみです（3 件以上推奨）'
            : `${insights.length} 件 OK`,
      hint:
        insights.length < 2
          ? '統合プロンプトで「marketing_insights を必ず 3〜5 件生成し、priority: high を必ず 1 件以上含める」と指定してください'
          : undefined,
    },
    {
      label: '高優先度示唆',
      ok: hasHighPriorityInsight,
      message: hasHighPriorityInsight
        ? 'priority: high の示唆あり'
        : '高優先度（high）の示唆がありません',
      hint: !hasHighPriorityInsight
        ? 'プロンプトに「priority: high を必ず 1 件以上含める」と明示してください'
        : undefined,
    },
    {
      label: '推奨アクション',
      ok: hasSuggestedActions,
      message: hasSuggestedActions
        ? '示唆に具体的なアクションあり'
        : 'suggested_action が空または短すぎます',
      hint: !hasSuggestedActions
        ? '「suggested_action は「LP の○○を△△に変更する」のように具体的な施策を書く」とプロンプトに追記してください'
        : undefined,
    },
    {
      label: 'LP 改善案',
      ok: lpSuggestions.length >= 1,
      message:
        lpSuggestions.length === 0
          ? 'LP 改善案が生成されていません'
          : `${lpSuggestions.length} 件 OK`,
      hint:
        lpSuggestions.length === 0
          ? 'synthesis プロンプトで「lp_suggestions を必ず 3〜5 件生成する」と指定してください'
          : undefined,
    },
    {
      label: '広告コピー案',
      ok: adCopies.length >= 1,
      message:
        adCopies.length === 0
          ? '広告コピー案が生成されていません'
          : `${adCopies.length} 件 OK`,
      hint:
        adCopies.length === 0
          ? 'synthesis プロンプトで「ad_copy_suggestions を必ず 3〜5 件、プラットフォームを分けて生成する」と指定してください'
          : undefined,
    },
    {
      label: 'コンテンツアイデア',
      ok: contentIdeas.length >= 1,
      message:
        contentIdeas.length === 0
          ? 'コンテンツアイデアが生成されていません'
          : `${contentIdeas.length} 件 OK`,
      hint:
        contentIdeas.length === 0
          ? 'synthesis プロンプトで「content_ideas を 3〜5 件生成する」と指定してください'
          : undefined,
    },
  ]
}

interface QualityCheckCardProps {
  analysis: ProjectAnalysis
  collapsed?: boolean
  projectId?: string
}

export function QualityCheckCard({ analysis, collapsed = false, projectId }: QualityCheckCardProps) {
  const items = buildCheckItems(analysis)
  const okCount = items.filter((i) => i.ok).length
  const total = items.length
  const allOk = okCount === total
  const ngItems = items.filter((i) => !i.ok)

  return (
    <Card className={allOk ? 'border-green-200 dark:border-green-900' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
          <span>分析品質チェック</span>
          <span
            className={`text-xs font-normal tabular-nums ${
              allOk ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
            }`}
          >
            {okCount} / {total} OK
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* チェック一覧 */}
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.label} className="space-y-0.5">
              <div className="flex items-start gap-2 text-sm">
                {item.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-sm ${item.ok ? '' : 'text-muted-foreground'}`}>
                      {item.label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {item.message}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* プロンプト改善ヒント（要確認項目がある場合） */}
        {ngItems.length > 0 && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <Info className="h-3.5 w-3.5 shrink-0" />
                プロンプト改善のヒント
              </div>
              {projectId && (
                <Link
                  href={`/projects/${projectId}/debug`}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'h-6 px-2 text-xs gap-1 text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200'
                  )}
                >
                  <Bug className="h-3 w-3" />
                  分析デバッグで確認
                </Link>
              )}
            </div>
            <ul className="space-y-2">
              {ngItems
                .filter((item) => item.hint)
                .map((item) => (
                  <li key={item.label} className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                    <span className="font-medium">{item.label}:</span> {item.hint}
                  </li>
                ))}
            </ul>
            {ngItems.every((item) => !item.hint) && (
              <p className="text-xs text-blue-700 dark:text-blue-400">
                データを追加して再分析してください。
              </p>
            )}
          </div>
        )}

        {allOk && (
          <p className="text-xs text-green-600 dark:text-green-400">
            すべての品質チェックを通過しました。レポートを共有できます。
          </p>
        )}
      </CardContent>
    </Card>
  )
}
