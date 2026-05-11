import { NextResponse } from 'next/server'
import { createServerUserClient } from '@/lib/supabase/server'
import { generateProjectOnePagerPptx, sanitizePptxFilename } from '@/lib/export/pptx'
import { logUsageEvent } from '@/lib/usage/log'
import { getCurrentUserAccessContext, canExport, isPlatformAdmin } from '@/lib/auth/permissions'
import type { ProjectAnalysis } from '@/types/analysis'

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

  const [{ data: project }, { data: analysisRow }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('project_analyses').select('*').eq('project_id', id).maybeSingle(),
  ])

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  if (!analysisRow) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  // org アクセスチェック（platform_admin は全 org 許可）
  if (
    !isPlatformAdmin(ctx.role) &&
    project.organization_id !== null &&
    project.organization_id !== ctx.activeOrganizationId
  ) {
    return NextResponse.json({ error: 'このプロジェクトへのアクセス権限がありません' }, { status: 403 })
  }

  const analysis = analysisRow as unknown as ProjectAnalysis
  const buffer = await generateProjectOnePagerPptx(project, analysis)

  const filename = `${sanitizePptxFilename(project.name)}_summary.pptx`

  await logUsageEvent({
    organizationId: project.organization_id,
    projectId: id,
    eventType: 'pptx_exported',
    metadata: {
      export_type: 'project_one_pager_pptx',
      project_name: project.name,
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
