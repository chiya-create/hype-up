import PptxGenJS from 'pptxgenjs'
import { INDUSTRY_TEMPLATES, getIndustryLabel } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import type {
  ProjectAnalysis,
  Complaint,
  AppealWord,
  MarketingInsight,
  LpSuggestion,
  AdCopySuggestion,
  WinningAppeal,
  ComparisonStrength,
  ComparisonWeakness,
  SharedComplaint,
  ComparisonAction,
} from '@/types/analysis'

// =============================================================================
// Design constants — LAYOUT_WIDE: 13.33" × 7.5"
// =============================================================================

const W   = 13.33  // slide width
const M   = 0.25   // outer margin
const GAP = 0.10   // gap between elements
const PAD = 0.18   // card inner padding

// Font sizes (pt)
const FS = {
  BRAND:   7.5,
  TITLE:   16,
  META:    8.5,
  LABEL:   8,    // section label inside cards
  BODY:    10,
  FOOTER:  7,
} as const

// Color palette
const C = {
  HDR_BG:     '1E293B',  // slate-900
  HDR_BRAND:  '64748B',  // slate-500
  HDR_TITLE:  'FFFFFF',
  HDR_META:   'CBD5E1',  // slate-300

  // Conclusion — blue
  CONC_BG:    'EFF6FF',  // blue-50
  CONC_TITLE: '1D4ED8',  // blue-700
  CONC_LINE:  'BFDBFE',  // blue-200

  // Winning / Strength — green
  WIN_BG:     'F0FDF4',  // green-50
  WIN_TITLE:  '166534',  // green-800
  WIN_LINE:   'BBF7D0',  // green-200

  // Issue / Amber
  ISS_BG:     'FFFBEB',  // amber-50
  ISS_TITLE:  '92400E',  // amber-800
  ISS_LINE:   'FDE68A',  // amber-200

  // Action — violet
  ACT_BG:     'F5F3FF',  // violet-50
  ACT_TITLE:  '5B21B6',  // violet-800
  ACT_LINE:   'DDD6FE',  // violet-200

  // Market complaints — rose
  MKT_BG:     'FFF1F2',  // rose-50
  MKT_TITLE:  '9F1239',  // rose-800
  MKT_LINE:   'FECDD3',  // rose-200

  BODY:       '1E293B',  // slate-900
  BORDER:     'E2E8F0',  // slate-200
  FOOT_LINE:  'CBD5E1',  // slate-300
  FOOTER:     '94A3B8',  // slate-400
} as const

// =============================================================================
// Public helpers
// =============================================================================

export function sanitizePptxFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 50)
}


// =============================================================================
// Internal helpers
// =============================================================================

function trunc(text: string | null | undefined, max: number): string {
  if (!text) return ''
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

// Numbered list:  "1.  item\n2.  item"
function nList(items: string[], max: number, truncAt: number): string {
  if (items.length === 0) return '（該当データなし）'
  return items.slice(0, max)
    .map((item, i) => `${i + 1}.  ${trunc(item, truncAt)}`)
    .join('\n')
}

// Bullet list:  "•  item\n•  item"
function bList(items: string[], max: number, truncAt: number): string {
  if (items.length === 0) return '（該当データなし）'
  return items.slice(0, max)
    .map((item) => `•  ${trunc(item, truncAt)}`)
    .join('\n')
}

function today(): string {
  return new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

// =============================================================================
// Slide building blocks
// =============================================================================

interface CardOpts {
  x: number; y: number; w: number; h: number
  bg: string; accent: string; lineColor: string
  labelEn: string   // e.g. "WINNING MESSAGE"
  labelJa: string   // e.g. "使うべき言葉"
  content: string
}

/** Colored card with left accent bar, section label, separator line, content */
function addCard(pres: PptxGenJS, slide: PptxGenJS.Slide, opts: CardOpts) {
  const { x, y, w, h } = opts

  // Background + border
  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: opts.bg },
    line: { color: opts.lineColor, width: 0.75 },
  })

  // Left accent bar
  slide.addShape(pres.ShapeType.rect, {
    x, y, w: 0.05, h,
    fill: { color: opts.accent },
    line: { color: opts.accent, width: 0 },
  })

  // Section label  "WINNING MESSAGE  使うべき言葉"
  slide.addText(`${opts.labelEn}  ${opts.labelJa}`, {
    x: x + PAD, y: y + 0.11, w: w - PAD * 2, h: 0.22,
    fontSize: FS.LABEL, bold: true, color: opts.accent, charSpacing: 0.5,
  })

  // Thin separator
  slide.addShape(pres.ShapeType.rect, {
    x: x + PAD, y: y + 0.37, w: w - PAD * 2, h: 0.007,
    fill: { color: opts.lineColor },
    line: { color: opts.lineColor, width: 0 },
  })

  // Content body
  slide.addText(opts.content, {
    x: x + PAD, y: y + 0.45, w: w - PAD * 2, h: h - 0.60,
    fontSize: FS.BODY, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: 1.45,
  })
}

/** Full-width conclusion/summary card */
function addConclusionCard(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  labelJa: string,
  text: string,
  y: number,
  h: number
) {
  slide.addShape(pres.ShapeType.rect, {
    x: M, y, w: W - M * 2, h,
    fill: { color: C.CONC_BG },
    line: { color: C.CONC_LINE, width: 0.75 },
  })
  slide.addShape(pres.ShapeType.rect, {
    x: M, y, w: 0.05, h,
    fill: { color: C.CONC_TITLE },
    line: { color: C.CONC_TITLE, width: 0 },
  })
  slide.addText(`CONCLUSION  ${labelJa}`, {
    x: M + PAD, y: y + 0.11, w: W - M * 2 - PAD * 2, h: 0.22,
    fontSize: FS.LABEL, bold: true, color: C.CONC_TITLE, charSpacing: 0.5,
  })
  slide.addShape(pres.ShapeType.rect, {
    x: M + PAD, y: y + 0.37, w: W - M * 2 - PAD * 2, h: 0.007,
    fill: { color: C.CONC_LINE },
    line: { color: C.CONC_LINE, width: 0 },
  })
  slide.addText(trunc(text, 260), {
    x: M + PAD, y: y + 0.45, w: W - M * 2 - PAD * 2, h: h - 0.55,
    fontSize: FS.BODY, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: 1.45,
  })
}

/** Dark header bar with brand, slide title, and right-aligned meta */
function addHeader(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  title: string,
  metaLines: string
) {
  const HDR_H = 0.65
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: W, h: HDR_H,
    fill: { color: C.HDR_BG },
  })
  // Brand
  slide.addText('Hype Up AI', {
    x: M, y: 0.07, w: 3, h: 0.20,
    fontSize: FS.BRAND, bold: true, color: C.HDR_BRAND, charSpacing: 0.5,
  })
  // Slide title
  slide.addText(title, {
    x: M, y: 0.27, w: 8.5, h: 0.34,
    fontSize: FS.TITLE, bold: true, color: C.HDR_TITLE,
  })
  // Meta info (right-aligned)
  slide.addText(metaLines, {
    x: 9.1, y: 0.06, w: 4.03, h: 0.58,
    fontSize: FS.META, color: C.HDR_META,
    align: 'right', valign: 'top', lineSpacingMultiple: 1.35, wrap: true,
  })
}

/** Footer: separator line + left brand note + right date */
function addFooter(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  noteText: string,
  y: number
) {
  // Separator line
  slide.addShape(pres.ShapeType.rect, {
    x: M, y, w: W - M * 2, h: 0.007,
    fill: { color: C.FOOT_LINE },
    line: { color: C.FOOT_LINE, width: 0 },
  })
  // Left: brand + note
  slide.addText(`Powered by Hype Up AI  |  ${noteText}`, {
    x: M, y: y + 0.07, w: 9.0, h: 0.26,
    fontSize: FS.FOOTER, color: C.FOOTER, valign: 'middle',
  })
  // Right: 出力日
  slide.addText(`出力日: ${today()}`, {
    x: 10.0, y: y + 0.07, w: 3.13, h: 0.26,
    fontSize: FS.FOOTER, color: C.FOOTER, align: 'right', valign: 'middle',
  })
}

// =============================================================================
// generateProjectOnePagerPptx
// =============================================================================

interface ProjectData {
  name: string
  industry: string | null
  review_count: number
  analysis_completed_at: string | null
}

export async function generateProjectOnePagerPptx(
  project: ProjectData,
  analysis: ProjectAnalysis
): Promise<Buffer> {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'

  const slide = pres.addSlide()
  slide.background = { color: 'FFFFFF' }

  const industryLabel =
    INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId]?.label ??
    project.industry ?? '—'

  // ── Header ──────────────────────────────────────────────────────────────────
  addHeader(pres, slide, 'レビュー分析サマリー', [
    `商品名: ${trunc(project.name, 28)}`,
    `業界: ${industryLabel}`,
    `レビュー: ${project.review_count.toLocaleString()} 件`,
    `分析完了: ${fmtDate(project.analysis_completed_at)}`,
  ].join('\n'))

  // ── Data extraction ──────────────────────────────────────────────────────────
  const complaints    = (analysis.complaints ?? []) as Complaint[]
  const appealWords   = (analysis.appeal_words ?? []) as AppealWord[]
  const insights      = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const lpSuggestions = (analysis.lp_suggestions ?? []) as LpSuggestion[]
  const adCopies      = (analysis.ad_copy_suggestions ?? []) as AdCopySuggestion[]

  const highInsights  = insights.filter((i) => i.priority === 'high')
  const midInsights   = insights.filter((i) => i.priority === 'medium')

  // WINNING MESSAGE: appeal words + top copy headline
  const winItems: string[] = [
    ...appealWords.slice(0, 3).map((w) => `${w.word}（スコア ${w.score}pt）`),
    ...(lpSuggestions[0]
      ? [`[LP] ${trunc(lpSuggestions[0].headline, 40)}`]
      : []),
    ...(adCopies[0]
      ? [`[${adCopies[0].platform}] ${trunc(adCopies[0].headline, 36)}`]
      : []),
  ]

  // KEY ISSUES: complaints top 3
  const issueItems = complaints
    .slice(0, 3)
    .map((c) => `${trunc(c.label, 38)}（${c.count}件）`)

  // NEXT ACTIONS: high priority first, then medium
  const actionItems = [
    ...highInsights.slice(0, 3).map((i) => trunc(i.suggested_action || i.insight, 65)),
    ...midInsights.slice(0, 2).map((i) => trunc(i.suggested_action || i.insight, 65)),
  ]

  // ── Layout geometry ──────────────────────────────────────────────────────────
  //  Header:   y=0.00, h=0.65
  //  Conc:     y=0.75, h=1.30  (+0.42 vs before — content ≈3.4 lines)
  //  2-col:    y=2.15, h=2.55  (-0.30 absorbed)
  //  Actions:  y=4.80, h=1.85  (-0.12 absorbed)
  //  Footer:   y=6.75
  const CONC_Y  = 0.65 + GAP              // 0.75
  const CONC_H  = 1.30
  const GRID_Y  = CONC_Y + CONC_H + GAP  // 2.15
  const GRID_H  = 2.55
  const COL_W   = (W - M * 2 - GAP) / 2
  const ACT_Y   = GRID_Y + GRID_H + GAP  // 4.80
  const ACT_H   = 1.85
  const FTR_Y   = ACT_Y + ACT_H + GAP   // 6.75

  addConclusionCard(pres, slide, '結論', analysis.summary ?? '', CONC_Y, CONC_H)

  addCard(pres, slide, {
    x: M, y: GRID_Y, w: COL_W, h: GRID_H,
    bg: C.WIN_BG, accent: C.WIN_TITLE, lineColor: C.WIN_LINE,
    labelEn: 'WINNING MESSAGE', labelJa: '使うべき言葉',
    content: bList(winItems, 5, 48),
  })

  addCard(pres, slide, {
    x: M + COL_W + GAP, y: GRID_Y, w: COL_W, h: GRID_H,
    bg: C.ISS_BG, accent: C.ISS_TITLE, lineColor: C.ISS_LINE,
    labelEn: 'KEY ISSUES', labelJa: '優先課題',
    content: nList(issueItems, 3, 48),
  })

  addCard(pres, slide, {
    x: M, y: ACT_Y, w: W - M * 2, h: ACT_H,
    bg: C.ACT_BG, accent: C.ACT_TITLE, lineColor: C.ACT_LINE,
    labelEn: 'NEXT ACTIONS', labelJa: '次に取るべき打ち手',
    content: nList(actionItems, 4, 80),
  })

  addFooter(pres, slide, 'レビュー分析結果に基づく初期提案資料', FTR_Y)

  const buf = await pres.write({ outputType: 'nodebuffer' })
  return buf as unknown as Buffer
}

// =============================================================================
// generateComparisonOnePagerPptx
// =============================================================================

interface ComparisonReportData {
  title: string | null
  comparison_summary: string | null
  industry: string | null
  created_at: string
  winning_appeals: unknown
  strengths: unknown
  weaknesses: unknown
  shared_complaints: unknown
  recommended_actions: unknown
}

export async function generateComparisonOnePagerPptx(
  report: ComparisonReportData,
  projectNames: string[]
): Promise<Buffer> {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'

  const slide = pres.addSlide()
  slide.background = { color: 'FFFFFF' }

  const winningAppeals   = (report.winning_appeals ?? []) as WinningAppeal[]
  const strengths        = (report.strengths ?? []) as ComparisonStrength[]
  const weaknesses       = (report.weaknesses ?? []) as ComparisonWeakness[]
  const sharedComplaints = (report.shared_complaints ?? []) as SharedComplaint[]
  const actions          = (report.recommended_actions ?? []) as ComparisonAction[]

  const sortedActions = [...actions].sort((a, b) => {
    const ord: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return (ord[a.priority] ?? 1) - (ord[b.priority] ?? 1)
  })

  // ── Header ──────────────────────────────────────────────────────────────────
  addHeader(pres, slide, '競合比較サマリー', [
    `比較: ${projectNames.map((n) => trunc(n, 12)).join(' vs ')}`,
    `業界: ${getIndustryLabel(report.industry)}`,
    `比較実行: ${fmtDate(report.created_at)}`,
  ].join('\n'))

  // ── Data items ───────────────────────────────────────────────────────────────
  // WINNING APPEALS: project + appeal
  const appealItems = winningAppeals
    .slice(0, 3)
    .map((a) => `[${trunc(a.project_name, 10)}]  ${trunc(a.appeal, 40)}`)

  // STRENGTHS & WEAKNESSES: combined in one list
  const swItems: string[] = [
    ...strengths.slice(0, 2).map(
      (s) => `[強] ${trunc(s.label, 30)}（${trunc(s.project_name ?? '共通', 10)}）`
    ),
    ...weaknesses.slice(0, 2).map(
      (w) => `[弱] ${trunc(w.label, 30)}（${trunc(w.project_name, 10)}）`
    ),
  ]

  // MARKET COMPLAINTS
  const complaintItems = sharedComplaints
    .slice(0, 3)
    .map((c) => trunc(c.label, 50))

  // NEXT ACTIONS: high priority first
  const actionItems = sortedActions
    .slice(0, 4)
    .map((a) => {
      const who = a.project_name ? `[${trunc(a.project_name, 8)}] ` : ''
      return `${who}${trunc(a.action, 55)}`
    })

  // ── Layout geometry ──────────────────────────────────────────────────────────
  //  Header:   y=0.00, h=0.65
  //  Conc:     y=0.75, h=1.30  (+0.45 vs before — content ≈3.4 lines)
  //  Row 1:    y=2.15, h=2.10  (-0.25 absorbed)
  //  Row 2:    y=4.35, h=2.10
  //  Footer:   y=6.55
  const CONC_Y  = 0.65 + GAP
  const CONC_H  = 1.30
  const ROW1_Y  = CONC_Y + CONC_H + GAP
  const ROW_H   = 2.10
  const COL_W   = (W - M * 2 - GAP) / 2
  const ROW2_Y  = ROW1_Y + ROW_H + GAP
  const FTR_Y   = ROW2_Y + ROW_H + GAP

  addConclusionCard(pres, slide, '比較結論', report.comparison_summary ?? '', CONC_Y, CONC_H)

  // Row 1
  addCard(pres, slide, {
    x: M, y: ROW1_Y, w: COL_W, h: ROW_H,
    bg: C.WIN_BG, accent: C.WIN_TITLE, lineColor: C.WIN_LINE,
    labelEn: 'WINNING APPEALS', labelJa: '勝てる訴求',
    content: nList(appealItems, 3, 50),
  })

  addCard(pres, slide, {
    x: M + COL_W + GAP, y: ROW1_Y, w: COL_W, h: ROW_H,
    bg: C.ISS_BG, accent: C.ISS_TITLE, lineColor: C.ISS_LINE,
    labelEn: 'STRENGTHS & WEAKNESSES', labelJa: '強み・弱み',
    content: bList(swItems, 4, 44),
  })

  // Row 2
  addCard(pres, slide, {
    x: M, y: ROW2_Y, w: COL_W, h: ROW_H,
    bg: C.MKT_BG, accent: C.MKT_TITLE, lineColor: C.MKT_LINE,
    labelEn: 'MARKET COMPLAINTS', labelJa: '市場共通の不満',
    content: nList(complaintItems, 3, 50),
  })

  addCard(pres, slide, {
    x: M + COL_W + GAP, y: ROW2_Y, w: COL_W, h: ROW_H,
    bg: C.ACT_BG, accent: C.ACT_TITLE, lineColor: C.ACT_LINE,
    labelEn: 'NEXT ACTIONS', labelJa: '次に取るべき打ち手',
    content: nList(actionItems, 4, 50),
  })

  addFooter(pres, slide, 'レビュー分析結果に基づく比較提案資料', FTR_Y)

  const buf = await pres.write({ outputType: 'nodebuffer' })
  return buf as unknown as Buffer
}
