'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AnalysisSummary } from '@/components/dashboard/AnalysisSummary'
import { RatingPointsChart } from '@/components/dashboard/RatingPointsChart'
import { ComplaintsChart } from '@/components/dashboard/ComplaintsChart'
import { PurchaseReasonsChart } from '@/components/dashboard/PurchaseReasonsChart'
import { CustomerTypesChart } from '@/components/dashboard/CustomerTypesChart'
import { AppealWordsCloud } from '@/components/dashboard/AppealWordsCloud'
import type {
  ProjectAnalysis,
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
} from '@/types/analysis'

interface DashboardTabsProps {
  analysis: ProjectAnalysis
}

export function DashboardTabs({ analysis }: DashboardTabsProps) {
  const ratingPoints = (analysis.rating_points ?? []) as RatingPoint[]
  const complaints = (analysis.complaints ?? []) as Complaint[]
  const purchaseReasons = (analysis.purchase_reasons ?? []) as PurchaseReason[]
  const customerTypes = (analysis.customer_types ?? []) as CustomerType[]
  const appealWords = (analysis.appeal_words ?? []) as AppealWord[]

  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap h-auto gap-1 mb-2">
        <TabsTrigger value="overview">概要</TabsTrigger>
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
