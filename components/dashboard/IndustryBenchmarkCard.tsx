'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IndustryBenchmark, BenchmarkItem, BenchmarkLevel } from '@/lib/insights/benchmark'

// ---------------------------------------------------------------------------
// Level badge
// ---------------------------------------------------------------------------

const LEVEL_LABEL: Record<BenchmarkLevel, string> = {
  common: '業界共通',
  emerging: '台頭中',
  unique: '差別化',
  unknown: '不明',
}

const LEVEL_VARIANT: Record<
  BenchmarkLevel,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  common: 'secondary',
  emerging: 'default',
  unique: 'outline',
  unknown: 'secondary',
}

const LEVEL_COLOR: Record<BenchmarkLevel, string> = {
  common: 'text-muted-foreground',
  emerging: 'text-amber-600 dark:text-amber-400',
  unique: 'text-green-600 dark:text-green-400',
  unknown: 'text-muted-foreground',
}

// ---------------------------------------------------------------------------
// Item list
// ---------------------------------------------------------------------------

function BenchmarkItemRow({ item }: { item: BenchmarkItem }) {
  return (
    <li className="flex items-start gap-3 py-2 border-b last:border-0">
      <Badge
        variant={LEVEL_VARIANT[item.benchmark_level]}
        className={`text-xs shrink-0 mt-0.5 ${item.benchmark_level === 'unique' ? 'border-green-400 text-green-700 dark:text-green-400' : ''}`}
      >
        {LEVEL_LABEL[item.benchmark_level]}
      </Badge>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={`text-sm font-medium ${LEVEL_COLOR[item.benchmark_level]}`}>
          {item.label}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {item.interpretation}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>自社: {item.project_count} 件</span>
          {item.industry_count > 0 && (
            <span>業界集計: {item.industry_count} 件</span>
          )}
        </div>
      </div>
    </li>
  )
}

function BenchmarkItemList({ items, emptyLabel }: { items: BenchmarkItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{emptyLabel}</p>
  }
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <BenchmarkItemRow key={`${item.insight_type}::${item.label}`} item={item} />
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

interface IndustryBenchmarkCardProps {
  benchmark: IndustryBenchmark
  industryLabel: string
}

export function IndustryBenchmarkCard({
  benchmark,
  industryLabel,
}: IndustryBenchmarkCardProps) {
  const { summary } = benchmark

  if (summary.total === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          まだ業界ベンチマークに十分なデータがありません。
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              業界ベンチマーク
              <span className="text-sm font-normal text-muted-foreground">
                {industryLabel}
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              集計データと照合した業界内での傾向分類です
            </p>
          </div>

          {/* サマリーバッジ群 */}
          <div className="flex flex-wrap gap-2">
            {summary.unique > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-400 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                差別化 {summary.unique}
              </span>
            )}
            {summary.emerging > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                台頭中 {summary.emerging}
              </span>
            )}
            {summary.common > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                業界共通 {summary.common}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs defaultValue="rating_points">
          <TabsList className="flex-wrap h-auto gap-1 mb-3">
            <TabsTrigger value="rating_points">
              評価ポイント
              <span className="ml-1 text-xs opacity-60">({benchmark.rating_points.length})</span>
            </TabsTrigger>
            <TabsTrigger value="complaints">
              不満点
              <span className="ml-1 text-xs opacity-60">({benchmark.complaints.length})</span>
            </TabsTrigger>
            <TabsTrigger value="purchase_reasons">
              購買理由
              <span className="ml-1 text-xs opacity-60">({benchmark.purchase_reasons.length})</span>
            </TabsTrigger>
            <TabsTrigger value="appeal_words">
              訴求ワード
              <span className="ml-1 text-xs opacity-60">({benchmark.appeal_words.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rating_points">
            <BenchmarkItemList
              items={benchmark.rating_points}
              emptyLabel="評価ポイントのデータがありません"
            />
          </TabsContent>
          <TabsContent value="complaints">
            <BenchmarkItemList
              items={benchmark.complaints}
              emptyLabel="不満点のデータがありません"
            />
          </TabsContent>
          <TabsContent value="purchase_reasons">
            <BenchmarkItemList
              items={benchmark.purchase_reasons}
              emptyLabel="購買理由のデータがありません"
            />
          </TabsContent>
          <TabsContent value="appeal_words">
            <BenchmarkItemList
              items={benchmark.appeal_words}
              emptyLabel="訴求ワードのデータがありません"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
