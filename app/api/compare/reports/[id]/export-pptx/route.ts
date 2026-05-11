import { NextResponse } from 'next/server'
import { createServerUserClient } from '@/lib/supabase/server'
import { generateComparisonOnePagerPptx, sanitizePptxFilename } from '@/lib/export/pptx'
import { logUsageEvent } from '@/lib/usage/log'
import { getCurrentUserAccessContext, canExport, isPlatformAdmin } from '@/lib/auth/permissions'

const PPTX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // 認証・ロールチェック
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  if (!canExport(ctx.role)) {
    return NextResponse.json({ error: 'エクスポートの権限がありません' }, { status: 403 })
  }

  const supabase = await createServerUserClient()

  const { data: report } = await supabase
    .from('comparison_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // org アクセスチェック（platform_admin は全 org 許可）
  if (
    !isPlatformAdmin(ctx.role) &&
    report.organization_id !== null &&
    report.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'このレポートへのアクセス権限がありません' }, { status: 403 })
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', report.project_ids)

  const projectNames = (projects ?? []).map((p) => p.name)

  const buffer = await generateComparisonOnePagerPptx(report, projectNames)

  const slug = sanitizePptxFilename(report.title ?? 'comparison')
  const filename = `${slug}_comparison_summary.pptx`

  await logUsageEvent({
    organizationId: report.organization_id,
    eventType: 'pptx_exported',
    metadata: {
      export_type: 'comparison_one_pager_pptx',
      report_id: id,
      title: report.title ?? null,
    },
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': PPTX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
