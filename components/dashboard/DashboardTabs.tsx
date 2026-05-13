'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AnalysisSummary } from '@/components/dashboard/AnalysisSummary'
import { RatingPointsChart } from '@/components/dashboard/RatingPointsChart'
import { ComplaintsChart } from '@/components/dashboard/ComplaintsChart'
import { PurchaseReasonsChart } from '@/components/dashboard/PurchaseReasonsChart'
import { CustomerTypesChart } from '@/components/dashboard/CustomerTypesChart'
import { AppealWordsCloud } from '@/components/dashboard/AppealWordsCloud'
import { Strategy3CCard } from '@/components/dashboard/Strategy3CCard'
import { Strategy3CDiagram } from '@/components/dashboard/Strategy3CDiagram'
import { buildStrategy3C } from '@/lib/insights/strategy-3c'
import type { IndustryBenchmark } from '@/lib/insights/benchmark'
import type {
  ProjectAnalysis,
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
  Strategy3C,
} from '@/types/analysis'

interface DashboardTabsProps {
  analysis: ProjectAnalysis
  /** benchmark を渡すと Competitor セクションの精度が上がる（省略可） */
  benchmark?: IndustryBenchmark | null
}

export function DashboardTabs({ analysis, benchmark }: DashboardTabsProps) {
  const ratingPoints = (analysis.rating_points ?? []) as RatingPoint[]
  const complaints = (analysis.complaints ?? []) as Complaint[]
  const purchaseReasons = (analysis.purchase_reasons ?? []) as PurchaseReason[]
  const customerTypes = (analysis.customer_types ?? []) as CustomerType[]
  const appealWords = (analysis.appeal_words ?? []) as AppealWord[]
  // DB保存済み analysis.strategy_3c は参照せず、毎回 buildStrategy3C() で最新ロジックを適用する
  const strategy3c: Strategy3C = buildStrategy3C(analysis, benchmark)

  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap h-auto gap-1 mb-2">
        <TabsTrigger value="overview">概要</TabsTrigger>
        <TabsTrigger value="strategy_3c">3C分析</TabsTrigger>
        <TabsTrigger value="rating_points">
          評価ポイント
          {ratingPoints.length > 0 && (
            <span className="ml-1 text-xs opacity-60">({ratingPoints.length})</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="complaints">
          不満点
          {complaints.length > 0 && (
            <span className="ml-1 text-xs opacity-60">({complaints.length})</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="purchase_reasons">
          購買理由
          {purchaseReasons.length > 0 && (
            <span className="ml-1 text-xs opacity-60">({purchaseReasons.length})</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="customer_types">
          顧客タイプ
          {customerTypes.length > 0 && (
            <span className="ml-1 text-xs opacity-60">({customerTypes.length})</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="appeal_words">
          訴求ワード
          {appealWords.length > 0 && (
            <span className="ml-1 text-xs opacity-60">({appealWords.length})</span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <AnalysisSummary analysis={analysis} />
      </TabsContent>

      <TabsContent value="strategy_3c">
        <div className="space-y-10">
          {/* 関係構造図: 直感理解用 */}
          <Strategy3CDiagram data={strategy3c} />

          {/* 詳細カード: 内容確認用 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              詳細カード
            </p>
            <Strategy3CCard data={strategy3c} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="rating_points">
        <RatingPointsChart data={ratingPoints} />
      </TabsContent>

      <TabsContent value="complaints">
        <ComplaintsChart data={complaints} />
      </TabsContent>

      <TabsContent value="purchase_reasons">
        <PurchaseReasonsChart data={purchaseReasons} />
      </TabsContent>

      <TabsContent value="customer_types">
        <CustomerTypesChart data={customerTypes} />
      </TabsContent>

      <TabsContent value="appeal_words">
        <AppealWordsCloud data={appealWords} />
      </TabsContent>
    </Tabs>
  )
}
