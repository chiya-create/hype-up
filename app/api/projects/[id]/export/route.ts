import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  generateRatingPointsCsv,
  generateComplaintsCsv,
  generatePurchaseReasonsCsv,
  generateCustomerTypesCsv,
  generateAppealWordsCsv,
  generateMarketingInsightsCsv,
  generateLpSuggestionsCsv,
  generateAdCopySuggestionsCsv,
  generateContentIdeasCsv,
  generateAllCsv,
  sanitizeFilename,
} from '@/lib/export/csv'
import { logUsageEvent } from '@/lib/usage/log'
import { getCurrentUserAccessContext, canExport, isPlatformAdmin } from '@/lib/auth/permissions'
import type {
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
  MarketingInsight,
  LpSuggestion,
  AdCopySuggestion,
  ContentIdea,
  DemandPoint,
  OccasionInsight,
  AvoidAppeal,
} from '@/types/analysis'

// ---------------------------------------------------------------------------
// 有効な type 値
// ---------------------------------------------------------------------------

const VALID_TYPES = [
  'rating_points',
  'complaints',
  'purchase_reasons',
  'customer_types',
  'appeal_words',
  'marketing_insights',
  'lp_suggestions',
  'ad_copy_suggestions',
  'content_ideas',
  'all',
] as const

type ExportType = (typeof VALID_TYPES)[number]

const TYPE_LABEL: Record<ExportType, string> = {
  rating_points: '評価ポイント',
  complaints: '不満点',
  purchase_reasons: '購入理由',
  customer_types: '顧客タイプ',
  appeal_words: '訴求ワード',
  marketing_insights: 'マーケティング示唆',
  lp_suggestions: 'LP改善案',
  ad_copy_suggestions: '広告コピー案',
  content_ideas: 'コンテンツアイデア',
  all: '全データ',
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const type = req.nextUrl.searchParams.get('type') ?? ''

  // type バリデーション
  if (!VALID_TYPES.includes(type as ExportType)) {
    return NextResponse.json(
      { error: `type が不正です。有効な値: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const exportType = type as ExportType

  // 認証・ロールチェック
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  if (!canExport(ctx.role)) {
    return NextResponse.json({ error: 'エクスポートの権限がありません' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // プロジェクト存在確認
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, organization_id')
    .eq('id', id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
  }

  // org アクセスチェック（platform_admin は全 org 許可）
  if (
    !isPlatformAdmin(ctx.role) &&
    project.organization_id !== null &&
    project.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'このプロジェクトへのアクセス権限がありません' }, { status: 403 })
  }

  // 分析結果取得
  const { data: analysisRow } = await supabase
    .from('project_analyses')
    .select('*')
    .eq('project_id', id)
    .maybeSingle()

  if (!analysisRow) {
    return NextResponse.json(
      { error: '分析結果がありません。先に分析を実行してください。' },
      { status: 404 }
    )
  }

  // 各軸データをキャスト
  const ratingPoints = (analysisRow.rating_points ?? []) as unknown as RatingPoint[]
  const complaints = (analysisRow.complaints ?? []) as unknown as Complaint[]
  const purchaseReasons = (analysisRow.purchase_reasons ?? []) as unknown as PurchaseReason[]
  const customerTypes = (analysisRow.customer_types ?? []) as unknown as CustomerType[]
  const appealWords = (analysisRow.appeal_words ?? []) as unknown as AppealWord[]
  const marketingInsights = (analysisRow.marketing_insights ?? []) as unknown as MarketingInsight[]
  const lpSuggestions = (analysisRow.lp_suggestions ?? []) as unknown as LpSuggestion[]
  const adCopySuggestions = (analysisRow.ad_copy_suggestions ?? []) as unknown as AdCopySuggestion[]
  const contentIdeas = (analysisRow.content_ideas ?? []) as unknown as ContentIdea[]
  const demandPoints = (analysisRow.demand_points ?? []) as unknown as DemandPoint[]
  const occasionInsights = (analysisRow.occasion_insights ?? []) as unknown as OccasionInsight[]
  const avoidAppeals = (analysisRow.avoid_appeals ?? []) as unknown as AvoidAppeal[]

  // CSV 生成
  let csvContent: string
  switch (exportType) {
    case 'rating_points':
      csvContent = generateRatingPointsCsv(ratingPoints)
      break
    case 'complaints':
      csvContent = generateComplaintsCsv(complaints)
      break
    case 'purchase_reasons':
      csvContent = generatePurchaseReasonsCsv(purchaseReasons)
      break
    case 'customer_types':
      csvContent = generateCustomerTypesCsv(customerTypes)
      break
    case 'appeal_words':
      csvContent = generateAppealWordsCsv(appealWords)
      break
    case 'marketing_insights':
      csvContent = generateMarketingInsightsCsv(marketingInsights)
      break
    case 'lp_suggestions':
      csvContent = generateLpSuggestionsCsv(lpSuggestions)
      break
    case 'ad_copy_suggestions':
      csvContent = generateAdCopySuggestionsCsv(adCopySuggestions)
      break
    case 'content_ideas':
      csvContent = generateContentIdeasCsv(contentIdeas)
      break
    case 'all':
      csvContent = generateAllCsv({
        rating_points: ratingPoints,
        complaints,
        purchase_reasons: purchaseReasons,
        customer_types: customerTypes,
        appeal_words: appealWords,
        marketing_insights: marketingInsights,
        lp_suggestions: lpSuggestions,
        ad_copy_suggestions: adCopySuggestions,
        content_ideas: contentIdeas,
        demand_points: demandPoints,
        occasion_insights: occasionInsights,
        avoid_appeals: avoidAppeals,
      })
      break
  }

  // ファイル名生成
  const safeProjectName = sanitizeFilename(project.name)
  const filename = `${safeProjectName}_${TYPE_LABEL[exportType]}.csv`

  await logUsageEvent({
    organizationId: project.organization_id ?? null,
    projectId: id,
    eventType: 'report_exported',
    metadata: {
      export_type: exportType,
      project_name: project.name,
    },
  })

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
