import PptxGenJS from 'pptxgenjs'
import { INDUSTRY_TEMPLATES, getIndustryLabel } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import type {
  ProjectAnalysis,
  RatingPoint,
  Complaint,
  PurchaseReason,
  AppealWord,
  MarketingInsight,
  LpSuggestion,
  AdCopySuggestion,
  OccasionInsight,
  AvoidAppeal,
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

/**
 * Sentence-boundary truncation for PPTX text.
 * Tries to cut at 。！？ first, then 、, then falls back to hard cut.
 * Always appends … when truncated.
 */
function truncateSentenceForPpt(text: string | null | undefined, max: number): string {
  if (!text) return ''
  if (text.length <= max) return text
  const candidate = text.slice(0, max)
  // Try full-stop boundaries
  const sentenceEnd = Math.max(
    candidate.lastIndexOf('。'),
    candidate.lastIndexOf('！'),
    candidate.lastIndexOf('？'),
  )
  if (sentenceEnd > Math.floor(max * 0.45)) {
    return candidate.slice(0, sentenceEnd + 1) + '…'
  }
  // Try clause boundary
  const clauseEnd = candidate.lastIndexOf('、')
  if (clauseEnd > Math.floor(max * 0.45)) {
    return candidate.slice(0, clauseEnd + 1) + '…'
  }
  // Hard cut
  return candidate.slice(0, max - 1) + '…'
}

/**
 * Converts a long action sentence into a short PPTX-safe title (max 45 chars).
 *
 * Strategy:
 *  1. Strip common verbose starters (まず/LP/SNS etc.)
 *  2. Try to extract the core "〇〇を動詞" verb phrase
 *  3. Fall back to sentence-boundary truncation at 45 chars
 *
 * Examples:
 *   "LP・広告の主軸訴求を「翌朝すっきり」にリライトする" → "主軸訴求を変更する"
 *   "FAQセクションに香り・効果・肌質への回答を追加する" → "FAQに回答を追加する"
 */
function actionTitleForPpt(text: string | null | undefined): string {
  if (!text) return ''

  // 1. Strip verbose starters
  const stripped = text
    .replace(/^(?:まず|まずは|早急に|すぐに|今すぐ|直ちに)[、。\s]*/u, '')
    .replace(/^(?:LP[・]?|SNS[・]?|EC[・]?|Web[・]?|広告[・]?|サイト[・]?)/u, '')
    .trim() || text

  // 2. Try to extract "X を/に [verb]" near the sentence core
  const verbPat = /([^\s。、！？]{2,14}[をに][^\s。、！？]{2,10}(?:する|変更|追加|修正|改善|作成|導入|明記|設計|強化|拡充|最適化|見直し|整備|切り替え|実施|展開|更新|表示|活用|採用|訴求|削除)(?:する)?)/u
  const m = stripped.match(verbPat)
  if (m && m[1].length >= 5 && m[1].length <= 32) {
    return m[1]
  }

  // 3. Sentence-boundary truncation at 45 chars
  return truncateSentenceForPpt(stripped, 45)
}

/**
 * Returns the action text for a MarketingInsight as a short PPTX title.
 * @deprecated use actionTitleForPpt instead
 */
function compactActionText(insight: MarketingInsight): string {
  return actionTitleForPpt(insight.suggested_action || insight.insight)
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
  lineSpacing?: number   // lineSpacingMultiple; default 1.45
  bodyFontSize?: number  // content font size in pt; default FS.BODY (10)
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
    fontSize: opts.bodyFontSize ?? FS.BODY, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: opts.lineSpacing ?? 1.45,
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
  slide.addText(truncateSentenceForPpt(text, 130), {
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

/** Footer: separator line + left brand note + center slide num + right date */
function addFooter(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  noteText: string,
  y: number,
  slideNum?: string   // e.g. "1 / 3"
) {
  // Separator line
  slide.addShape(pres.ShapeType.rect, {
    x: M, y, w: W - M * 2, h: 0.007,
    fill: { color: C.FOOT_LINE },
    line: { color: C.FOOT_LINE, width: 0 },
  })
  // Left: brand + note
  slide.addText(`Powered by Hype Up AI  |  ${noteText}`, {
    x: M, y: y + 0.07, w: 8.5, h: 0.26,
    fontSize: FS.FOOTER, color: C.FOOTER, valign: 'middle',
  })
  // Center: slide number
  if (slideNum) {
    slide.addText(slideNum, {
      x: 5.5, y: y + 0.07, w: 2.33, h: 0.26,
      fontSize: FS.FOOTER, color: C.FOOTER, align: 'center', valign: 'middle',
    })
  }
  // Right: 出力日
  slide.addText(`出力日: ${today()}`, {
    x: 10.0, y: y + 0.07, w: 3.13, h: 0.26,
    fontSize: FS.FOOTER, color: C.FOOTER, align: 'right', valign: 'middle',
  })
}

/**
 * Detailed action card for Slide 2 — Recommended Actions.
 * Shows: index label / short title / priority badge / action detail / rationale.
 */
function addActionDetailCard(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  opts: {
    x: number; y: number; w: number; h: number
    index: number
    title: string          // short action title (actionTitleForPpt output)
    action: string         // suggested_action or insight
    rationale: string      // rationale
    priority: 'high' | 'medium' | 'low'
  }
) {
  const { x, y, w, h, index, title, action, rationale, priority } = opts
  const PRI_COLOR = priority === 'high' ? 'DC2626' : priority === 'medium' ? 'D97706' : '6B7280'
  const PRI_LABEL = priority === 'high' ? '● 優先度: HIGH' : priority === 'medium' ? '● 優先度: MEDIUM' : '● 優先度: LOW'

  // Card background + border
  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: C.ACT_BG },
    line: { color: C.ACT_LINE, width: 0.75 },
  })
  // Left accent bar
  slide.addShape(pres.ShapeType.rect, {
    x, y, w: 0.05, h,
    fill: { color: C.ACT_TITLE },
    line: { color: C.ACT_TITLE, width: 0 },
  })
  // Section label "ACTION 1  推奨施策"
  slide.addText(`ACTION ${index}  推奨施策`, {
    x: x + PAD, y: y + 0.11, w: w - PAD * 2, h: 0.22,
    fontSize: FS.LABEL, bold: true, color: C.ACT_TITLE, charSpacing: 0.5,
  })
  // Separator
  slide.addShape(pres.ShapeType.rect, {
    x: x + PAD, y: y + 0.37, w: w - PAD * 2, h: 0.007,
    fill: { color: C.ACT_LINE },
    line: { color: C.ACT_LINE, width: 0 },
  })

  // -- Content block (starts at y + 0.45) --------------------------------
  const CX  = x + PAD
  const CW  = w - PAD * 2
  let  CY   = y + 0.48

  // Short title (bold 11pt, up to 2 lines)
  slide.addText(title, {
    x: CX, y: CY, w: CW, h: 0.55,
    fontSize: 11, bold: true, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: 1.25,
  })
  CY += 0.58

  // Priority badge
  slide.addText(PRI_LABEL, {
    x: CX, y: CY, w: CW, h: 0.20,
    fontSize: 7.5, bold: true, color: PRI_COLOR,
  })
  CY += 0.24

  // Thin rule
  slide.addShape(pres.ShapeType.rect, {
    x: CX, y: CY, w: CW, h: 0.005,
    fill: { color: C.ACT_LINE },
    line: { color: C.ACT_LINE, width: 0 },
  })
  CY += 0.12

  // Label "具体的にやること"
  slide.addText('■ 具体的にやること', {
    x: CX, y: CY, w: CW, h: 0.18,
    fontSize: 7, bold: true, color: '64748B',
  })
  CY += 0.20

  // Action text (9pt, wraps)
  slide.addText(truncateSentenceForPpt(action, 130), {
    x: CX, y: CY, w: CW, h: 1.55,
    fontSize: 9, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: 1.35,
  })
  CY += 1.60

  // Label "根拠"
  slide.addText('■ 根拠・インサイト', {
    x: CX, y: CY, w: CW, h: 0.18,
    fontSize: 7, bold: true, color: '64748B',
  })
  CY += 0.20

  // Rationale text (9pt, wraps)
  slide.addText(truncateSentenceForPpt(rationale, 120), {
    x: CX, y: CY, w: CW, h: 1.55,
    fontSize: 9, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: 1.35,
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

// ---------------------------------------------------------------------------
// Shared meta header (right side) builder
// ---------------------------------------------------------------------------

function projectMetaLines(project: ProjectData, industryLabel: string): string {
  return [
    `商品名: ${trunc(project.name, 28)}`,
    `業界: ${industryLabel}`,
    `レビュー: ${project.review_count.toLocaleString()} 件`,
    `分析完了: ${fmtDate(project.analysis_completed_at)}`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Slide 1 — Executive Summary
// ---------------------------------------------------------------------------

function buildSlide1(
  pres: PptxGenJS,
  project: ProjectData,
  analysis: ProjectAnalysis,
  industryLabel: string,
) {
  const slide = pres.addSlide()
  slide.background = { color: 'FFFFFF' }

  addHeader(pres, slide, 'レビュー分析サマリー', projectMetaLines(project, industryLabel))

  // ── Data ──────────────────────────────────────────────────────────────────
  const complaints    = (analysis.complaints ?? []) as Complaint[]
  const appealWords   = (analysis.appeal_words ?? []) as AppealWord[]
  const insights      = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const lpSuggestions = (analysis.lp_suggestions ?? []) as LpSuggestion[]
  const adCopies      = (analysis.ad_copy_suggestions ?? []) as AdCopySuggestion[]
  const highInsights  = insights.filter((i) => i.priority === 'high')
  const midInsights   = insights.filter((i) => i.priority === 'medium')

  const winItems: string[] = [
    ...appealWords.slice(0, 3).map((w) => `${w.word}（スコア ${w.score}pt）`),
    ...(lpSuggestions[0] ? [`[LP] ${trunc(lpSuggestions[0].headline, 40)}`] : []),
    ...(adCopies[0] ? [`[${adCopies[0].platform}] ${trunc(adCopies[0].headline, 36)}`] : []),
  ]
  const issueItems = complaints.slice(0, 3).map((c) => `${trunc(c.label, 38)}（${c.count}件）`)
  const actionItems = [
    ...highInsights.slice(0, 3).map((i) => actionTitleForPpt(i.suggested_action || i.insight)),
    ...midInsights.slice(0, 2).map((i) => actionTitleForPpt(i.suggested_action || i.insight)),
  ]
  // Append hint that slide 2 has details
  const actionContent =
    nList(actionItems, 3, 200) + '\n\n（詳細・根拠 → Slide 2）'

  // ── Layout ────────────────────────────────────────────────────────────────
  //  Header  y=0.00  h=0.65
  //  Conc    y=0.75  h=1.25
  //  2-col   y=2.10  h=2.60
  //  Actions y=4.80  h=1.85
  //  Footer  y=6.75
  const CONC_Y = 0.65 + GAP
  const CONC_H = 1.25
  const GRID_Y = CONC_Y + CONC_H + GAP
  const GRID_H = 2.60
  const COL_W  = (W - M * 2 - GAP) / 2
  const ACT_Y  = GRID_Y + GRID_H + GAP
  const ACT_H  = 1.85
  const FTR_Y  = ACT_Y + ACT_H + GAP

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
    content: actionContent,
    lineSpacing: 1.20,
    bodyFontSize: 9,
  })

  addFooter(pres, slide, 'レビュー分析結果に基づく初期提案資料', FTR_Y, '1 / 3')
}

// ---------------------------------------------------------------------------
// Slide 2 — Recommended Actions
// ---------------------------------------------------------------------------

function buildSlide2(
  pres: PptxGenJS,
  project: ProjectData,
  analysis: ProjectAnalysis,
  industryLabel: string,
) {
  const slide = pres.addSlide()
  slide.background = { color: 'FFFFFF' }

  addHeader(pres, slide, '推奨施策  —  Recommended Actions', projectMetaLines(project, industryLabel))

  const insights     = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const highInsights = insights.filter((i) => i.priority === 'high')
  const midInsights  = insights.filter((i) => i.priority === 'medium')
  // Up to 3 actions: high first, then medium
  const actions = [...highInsights, ...midInsights].slice(0, 3)

  // ── Layout ────────────────────────────────────────────────────────────────
  //  Header  y=0.00  h=0.65
  //  Cards   y=0.75  h=5.90  (3 equal columns)
  //  Footer  y=6.75
  const CARD_Y = 0.65 + GAP               // 0.75
  const CARD_H = 5.90
  const CARD_W = (W - M * 2 - GAP * 2) / 3  // ≈ 4.21"
  const FTR_Y  = CARD_Y + CARD_H + GAP   // 6.75

  // Placeholder card when fewer than 3 actions exist
  const noActionContent = '（データなし）'

  for (let i = 0; i < 3; i++) {
    const ins = actions[i]
    const cx  = M + i * (CARD_W + GAP)

    if (!ins) {
      // Empty placeholder
      addCard(pres, slide, {
        x: cx, y: CARD_Y, w: CARD_W, h: CARD_H,
        bg: C.ACT_BG, accent: C.ACT_TITLE, lineColor: C.ACT_LINE,
        labelEn: `ACTION ${i + 1}`, labelJa: '推奨施策',
        content: noActionContent,
      })
    } else {
      addActionDetailCard(pres, slide, {
        x: cx, y: CARD_Y, w: CARD_W, h: CARD_H,
        index: i + 1,
        title: actionTitleForPpt(ins.suggested_action || ins.insight),
        action: ins.suggested_action || ins.insight,
        rationale: ins.rationale,
        priority: ins.priority,
      })
    }
  }

  addFooter(pres, slide, 'レビュー分析結果に基づく初期提案資料', FTR_Y, '2 / 3')
}

// ---------------------------------------------------------------------------
// Slide 3 — Evidence / Customer Insights
// ---------------------------------------------------------------------------

function buildSlide3(
  pres: PptxGenJS,
  project: ProjectData,
  analysis: ProjectAnalysis,
  industryLabel: string,
) {
  const slide = pres.addSlide()
  slide.background = { color: 'FFFFFF' }

  addHeader(pres, slide, '顧客インサイト  —  Evidence', projectMetaLines(project, industryLabel))

  const ratingPoints    = (analysis.rating_points    ?? []) as RatingPoint[]
  const complaints      = (analysis.complaints       ?? []) as Complaint[]
  const purchaseReasons = (analysis.purchase_reasons ?? []) as PurchaseReason[]
  const occasionInsights = (analysis.occasion_insights ?? []) as OccasionInsight[]
  const avoidAppeals    = (analysis.avoid_appeals    ?? []) as AvoidAppeal[]

  // ── Content builders ──────────────────────────────────────────────────────

  // Rating points: "1. label（N件）\n   フレーズ"
  const ratingContent = ratingPoints.length === 0
    ? '（データなし）'
    : ratingPoints.slice(0, 3).map((rp, i) => {
        const phrase = rp.copyworthy_phrases[0] ?? rp.examples[0] ?? ''
        return `${i + 1}.  ${trunc(rp.label, 25)}（${rp.count}件）` +
          (phrase ? `\n    "${trunc(phrase, 28)}"` : '')
      }).join('\n')

  // Complaints: "1. label（N件）\n   FAQ案"
  const complaintContent = complaints.length === 0
    ? '（データなし）'
    : complaints.slice(0, 3).map((c, i) =>
        `${i + 1}.  ${trunc(c.label, 24)}（${c.count}件）` +
        (c.faq_suggestion ? `\n    FAQ: ${trunc(c.faq_suggestion, 30)}` : '')
      ).join('\n')

  // Purchase reasons: "1. label\n   深層: deep_psychology"
  const purchaseContent = purchaseReasons.length === 0
    ? '（データなし）'
    : purchaseReasons.slice(0, 3).map((pr, i) =>
        `${i + 1}.  ${trunc(pr.label, 25)}` +
        (pr.deep_psychology ? `\n    深層: ${trunc(pr.deep_psychology, 32)}` : '')
      ).join('\n')

  // Occasion insights: "1. occasion\n   → recommended_message"
  const occasionContent = occasionInsights.length === 0
    ? '（データなし）'
    : occasionInsights.slice(0, 3).map((oi, i) =>
        `${i + 1}.  ${trunc(oi.occasion, 30)}` +
        (oi.recommended_message ? `\n    → ${trunc(oi.recommended_message, 40)}` : '')
      ).join('\n')

  // Avoid appeals: "✗ appeal\n   代替: replacement"
  const avoidContent = avoidAppeals.length === 0
    ? '（データなし）'
    : avoidAppeals.slice(0, 2).map((aa) =>
        `✗  ${trunc(aa.appeal, 28)}` +
        (aa.replacement_message ? `\n    代替: ${trunc(aa.replacement_message, 35)}` : '')
      ).join('\n')

  // ── Layout ────────────────────────────────────────────────────────────────
  //  Header  y=0.00  h=0.65
  //  Row1    y=0.75  h=2.45  (3 equal cols)
  //  Row2    y=3.30  h=2.85  (2 equal cols)
  //  Footer  y=6.25
  const ROW1_Y  = 0.65 + GAP               // 0.75
  const ROW1_H  = 2.45
  const ROW2_Y  = ROW1_Y + ROW1_H + GAP   // 3.30
  const ROW2_H  = 2.85
  const FTR_Y   = ROW2_Y + ROW2_H + GAP   // 6.25

  const COL3_W  = (W - M * 2 - GAP * 2) / 3   // ≈ 4.21"
  const COL2_W  = (W - M * 2 - GAP) / 2        // ≈ 6.37"

  // Row 1 — three evidence columns
  addCard(pres, slide, {
    x: M,                     y: ROW1_Y, w: COL3_W, h: ROW1_H,
    bg: C.WIN_BG, accent: C.WIN_TITLE, lineColor: C.WIN_LINE,
    labelEn: 'RATING POINTS', labelJa: '評価ポイント Top3',
    content: ratingContent,
    bodyFontSize: 8.5, lineSpacing: 1.30,
  })
  addCard(pres, slide, {
    x: M + COL3_W + GAP,      y: ROW1_Y, w: COL3_W, h: ROW1_H,
    bg: C.ISS_BG, accent: C.ISS_TITLE, lineColor: C.ISS_LINE,
    labelEn: 'COMPLAINTS',    labelJa: '不満点 Top3',
    content: complaintContent,
    bodyFontSize: 8.5, lineSpacing: 1.30,
  })
  addCard(pres, slide, {
    x: M + COL3_W * 2 + GAP * 2, y: ROW1_Y, w: COL3_W, h: ROW1_H,
    bg: 'F8FAFC', accent: '475569', lineColor: 'CBD5E1',
    labelEn: 'PURCHASE REASONS', labelJa: '購入理由 Top3',
    content: purchaseContent,
    bodyFontSize: 8.5, lineSpacing: 1.30,
  })

  // Row 2 — occasion insights + avoid appeals
  addCard(pres, slide, {
    x: M,             y: ROW2_Y, w: COL2_W, h: ROW2_H,
    bg: 'F0F9FF', accent: '0369A1', lineColor: 'BAE6FD',   // sky
    labelEn: 'OCCASION INSIGHTS', labelJa: '想起シーン Top3',
    content: occasionContent,
    bodyFontSize: 8.5, lineSpacing: 1.30,
  })
  addCard(pres, slide, {
    x: M + COL2_W + GAP, y: ROW2_Y, w: COL2_W, h: ROW2_H,
    bg: C.MKT_BG, accent: C.MKT_TITLE, lineColor: C.MKT_LINE,
    labelEn: 'AVOID APPEALS', labelJa: '捨てるべき訴求 Top2',
    content: avoidContent,
    bodyFontSize: 8.5, lineSpacing: 1.30,
  })

  addFooter(pres, slide, 'レビュー分析結果に基づく初期提案資料', FTR_Y, '3 / 3')
}

// ---------------------------------------------------------------------------
// Public entry point — now generates 3 slides
// ---------------------------------------------------------------------------

export async function generateProjectOnePagerPptx(
  project: ProjectData,
  analysis: ProjectAnalysis
): Promise<Buffer> {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'

  const industryLabel =
    INDUSTRY_TEMPLATES[(project.industry ?? 'general') as IndustryId]?.label ??
    project.industry ?? '—'

  buildSlide1(pres, project, analysis, industryLabel)
  buildSlide2(pres, project, analysis, industryLabel)
  buildSlide3(pres, project, analysis, industryLabel)

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
