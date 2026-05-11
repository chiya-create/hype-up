import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    number: 1,
    title: 'レビュー CSV を用意する',
    description:
      'Amazon・楽天・Google・自社サイトなど、どこからでも OK。body 列（レビュー本文）が必須です。rating・reviewer・reviewed_at・source も追加すると分析精度が上がります。',
  },
  {
    number: 2,
    title: '業界テンプレートを選ぶ',
    description:
      'アップロード時に「美容・コスメ」「食品・飲料」「英語スクール」など業界を選択します。業界に合わせた視点でレビューを分析します。',
  },
  {
    number: 3,
    title: 'CSV をアップロードする',
    description:
      'トップページのアップロードフォームに CSV をドラッグ＆ドロップするか、ファイルを選択します。最大 5,000 件まで処理できます。',
  },
  {
    number: 4,
    title: '分析を実行する',
    description:
      'アップロード後、プロジェクト詳細ページで「AI 分析を開始」ボタンを押します。件数にもよりますが通常 1〜3 分で完了します。',
  },
  {
    number: 5,
    title: 'レポート・PPTX を確認する',
    description:
      '分析完了後、評価ポイント・不満点・購買理由・訴求ワード・LP 改善提案が表示されます。PPTX ダウンロードボタンからプレゼン資料としてすぐに活用できます。',
  },
  {
    number: 6,
    title: '必要に応じて競合比較する',
    description:
      '複数プロジェクトを選択して「競合比較」を実行すると、自社と競合の差別化ポイント・共通課題・台頭中のキーワードを横断比較したレポートを生成します。',
  },
]

interface GettingStartedStepsProps {
  /** compact=true のとき説明文を省略してコンパクト表示 */
  compact?: boolean
}

export function GettingStartedSteps({ compact = false }: GettingStartedStepsProps) {
  return (
    <ol className={cn('space-y-4', compact && 'space-y-3')}>
      {STEPS.map((step) => (
        <li key={step.number} className="flex gap-4">
          <div className="shrink-0 mt-0.5">
            <span
              className={cn(
                'flex items-center justify-center rounded-full font-bold text-primary-foreground bg-primary',
                compact ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-sm'
              )}
            >
              {step.number}
            </span>
          </div>
          <div className="space-y-0.5">
            <p className={cn('font-medium', compact ? 'text-sm' : 'text-base')}>
              {step.title}
            </p>
            {!compact && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** チェック付きの完了ステップ表示（将来の進捗追跡用）*/
export function CompletedStep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      {label}
    </div>
  )
}
