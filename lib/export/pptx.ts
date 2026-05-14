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

// ---------------------------------------------------------------------------
// PPTX 統一テキスト helper — 文節境界カット、末尾 …
// ---------------------------------------------------------------------------

/** 施策タイトル用: 最大24文字（Slide 2 カード見出し） */
function pptTitle(text: string | null | undefined, max = 24): string {
  return truncateSentenceForPpt(text, max)
}
/** 1行ラベル用: 最大24文字（Slide 3 evidence 各行） */
function pptLine(text: string | null | undefined, max = 24): string {
  return truncateSentenceForPpt(text, max)
}
/** 短い説明用: 最大65文字（Slide 2 やること） */
function pptNote(text: string | null | undefined, max = 65): string {
  return truncateSentenceForPpt(text, max)
}
/** サマリー用: 最大90文字（Slide 1 Conclusion） */
function pptSummary(text: string | null | undefined, max = 90): string {
  return truncateSentenceForPpt(text, max)
}

/**
 * Final safety clamp — hard-truncates to max chars, never throws.
 * Use after all other helpers as a last line of defence.
 */
function assertPptSafe(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

/**
 * Wraps Japanese/mixed text into at most maxLines lines of ≤ maxCharsPerLine chars.
 *
 * Strategy (priority order):
 *   1. 文末（。！？）で改行
 *   2. 読点・中点・矢印（、・→／）で改行
 *   3. 閉じ括弧（』」）」）で改行
 *   4. maxCharsPerLine でハードカット
 *
 * maxLines を超えた場合のみ最終行に「…」を付加。
 * それ以外は「…」を使わず意味をできる限り保持する。
 * Returns lines joined with '\n' for PptxGenJS wrap:true rendering.
 */
function wrapJapaneseText(
  text: string | null | undefined,
  maxCharsPerLine: number,
  maxLines: number,
): string {
  if (!text) return ''
  const src = text.trim()
  if (!src) return ''

  const lines: string[] = []
  let pos = 0
  const threshold = Math.floor(maxCharsPerLine * 0.45)

  while (pos < src.length && lines.length < maxLines) {
    const remaining = src.slice(pos)
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining)
      pos = src.length
      break
    }

    const chunk = remaining.slice(0, maxCharsPerLine)

    // 1. Sentence boundary
    const s = Math.max(
      chunk.lastIndexOf('。'), chunk.lastIndexOf('！'), chunk.lastIndexOf('？'),
    )
    if (s >= threshold) {
      lines.push(remaining.slice(0, s + 1))
      pos += s + 1
      while (pos < src.length && (src[pos] === '　' || src[pos] === ' ')) pos++
      continue
    }

    // 2. Clause boundary — セパレータ自体は行末に含めない (c+1 ではなく c)
    const c = Math.max(
      chunk.lastIndexOf('、'), chunk.lastIndexOf('・'),
      chunk.lastIndexOf('→'), chunk.lastIndexOf('／'), chunk.lastIndexOf('/'),
    )
    if (c >= threshold) {
      lines.push(remaining.slice(0, c))   // drop the separator char from line end
      pos += c + 1                        // skip past the separator
      while (pos < src.length && (src[pos] === '　' || src[pos] === ' ')) pos++
      continue
    }

    // 3. Closing bracket / space
    const b = Math.max(
      chunk.lastIndexOf('』'), chunk.lastIndexOf('」'), chunk.lastIndexOf('）'),
      chunk.lastIndexOf('　'), chunk.lastIndexOf(' '),
    )
    if (b >= threshold) {
      lines.push(remaining.slice(0, b + 1))
      pos += b + 1
      while (pos < src.length && (src[pos] === '　' || src[pos] === ' ')) pos++
      continue
    }

    // 4. Hard break
    lines.push(chunk)
    pos += maxCharsPerLine
  }

  // Append '…' only when text was actually truncated
  if (pos < src.length && lines.length > 0) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = (last.length >= maxCharsPerLine
      ? last.slice(0, maxCharsPerLine - 1)
      : last
    ) + '…'
  }

  return lines.join('\n')
}

/**
 * Converts a long action sentence into a short PPTX-safe title.
 *
 * @param max - character limit (default 35 for Slide 1, pass 28 for Slide 2)
 *
 * Strategy:
 *  1. Strip verbose starters (まず/LP/SNS etc.)
 *  2. Extract the core "〇〇を動詞" verb phrase
 *  3. Sentence-boundary truncation at `max` chars
 */
function actionTitleForPpt(text: string | null | undefined, max = 35): string {
  if (!text) return ''

  // 1. Strip verbose starters
  const stripped = text
    .replace(/^(?:まず|まずは|早急に|すぐに|今すぐ|直ちに)[、。\s]*/u, '')
    .replace(/^(?:LP[・]?|SNS[・]?|EC[・]?|Web[・]?|広告[・]?|サイト[・]?)/u, '')
    .trim() || text

  // 2. Try to extract "X を/に [verb]" near the sentence core
  const verbPat = /([^\s。、！？]{2,14}[をに][^\s。、！？]{2,10}(?:する|変更|追加|修正|改善|作成|導入|明記|設計|強化|拡充|最適化|見直し|整備|切り替え|実施|展開|更新|表示|活用|採用|訴求|削除)(?:する)?)/u
  const m = stripped.match(verbPat)
  if (m && m[1].length >= 5 && m[1].length <= max) {
    return m[1]
  }

  // 3. Sentence-boundary truncation
  return truncateSentenceForPpt(stripped, max)
}

// ---------------------------------------------------------------------------
// Infer missing fields from MarketingInsight content
// ---------------------------------------------------------------------------

/** 期待効果をキーワードから推定 */
function inferImpact(ins: MarketingInsight): string {
  const t = `${ins.suggested_action} ${ins.insight}`.toLowerCase()
  if (/cvr|転換率|購入率|コンバージョン/.test(t))   return 'CVR改善'
  if (/離脱|直帰/.test(t))                          return '離脱率低下'
  if (/不安|faq|解消|払拭|疑問|不信/.test(t))       return '購入前不安の解消'
  if (/低評価|返品|クレーム|ネガ/.test(t))           return '低評価レビュー抑制'
  if (/リピート|定期|継続|ltr|ロイヤル/.test(t))    return 'リピート率向上'
  if (/広告|cpa|cpc|roas/.test(t))                  return '広告CPA改善'
  if (/lp|訴求|ヘッドライン|コピー|ランディング/.test(t)) return 'LP訴求力向上'
  if (/sns|認知|シェア|拡散/.test(t))               return '認知・シェア拡大'
  if (/単価|アップ|クロスセル|追加/.test(t))        return '客単価向上'
  return '顧客満足度・CVR向上'
}

/** 反映先をキーワードから推定（最大3タグ / で区切り） */
function inferDestination(ins: MarketingInsight): string {
  const t = `${ins.suggested_action} ${ins.insight}`.toLowerCase()
  const dests: string[] = []
  if (/lp|ランディング/.test(t))              dests.push('LP')
  if (/広告|ad|meta|google|yahoo/.test(t))   dests.push('広告')
  if (/faq|よくある|q&a/.test(t))             dests.push('FAQ')
  if (/商品ページ|詳細ページ|pdp/.test(t))    dests.push('商品ページ')
  if (/メール|crm|mail|ステップ/.test(t))      dests.push('メールCRM')
  if (/sns|twitter|instagram|tiktok/.test(t)) dests.push('SNS')
  if (dests.length === 0) { dests.push('LP', '広告') }
  return dests.slice(0, 3).join('  /  ')
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
  // wrapJapaneseText: 句読点境界で改行し最大3行表示。pptSummary(max=90) より多くの内容を表示可能。
  // CONC_H=1.25", content h=0.75": 10pt×1.30 → 0.217"/line × 3 = 0.651" ≤ 0.75" ✓
  slide.addText(wrapJapaneseText(text, 85, 3), {
    x: M + PAD, y: y + 0.45, w: W - M * 2 - PAD * 2, h: h - 0.50,
    fontSize: FS.BODY, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: 1.30,
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
 * Slide 2/3/4 — Recommended Action (1 action per slide, 2-column layout)
 *
 * Layout (LAYOUT_WIDE 13.33" × 7.5"):
 *   Left panel  x=0.25  w=3.80  — タイトル / 優先度 / 反映先
 *   Right col   x=4.15  w=8.93  — やること / 根拠 / 期待効果（3枚縦積み）
 *
 * Character budgets (safely fits at 10pt on given widths):
 *   title       ≤ 40 chars  left panel (19 chars/line × 2 lines)
 *   action      ≤ 160 chars right card (62 chars/line × ~2.5 lines)
 *   rationale   ≤ 140 chars right card
 *   impact      ≤ 120 chars right card
 */
function buildActionSlide(
  pres: PptxGenJS,
  project: ProjectData,
  ins: MarketingInsight,
  actionIndex: number,   // 1-based
  slideNum: string,      // e.g. "2 / 5"
  industryLabel: string,
) {
  const slide = pres.addSlide()
  slide.background = { color: 'FFFFFF' }

  addHeader(
    pres, slide,
    `推奨施策 ${actionIndex}  —  Recommended Action`,
    projectMetaLines(project, industryLabel),
  )

  // ── Geometry ─────────────────────────────────────────────────────────────
  const PANEL_Y  = 0.65 + GAP           // 0.75
  const PANEL_H  = 5.90
  const LEFT_W   = 3.80
  const RIGHT_X  = M + LEFT_W + GAP     // 4.15
  const RIGHT_W  = W - M * 2 - LEFT_W - GAP  // 8.93
  const CARD_H   = (PANEL_H - GAP * 2) / 3   // 1.90"
  const FTR_Y    = PANEL_Y + PANEL_H + GAP   // 6.75

  // ── Priority helpers ─────────────────────────────────────────────────────
  const PRI_COLOR = ins.priority === 'high' ? 'DC2626' : ins.priority === 'medium' ? 'D97706' : '6B7280'
  const PRI_LABEL = ins.priority === 'high' ? '● 優先度: HIGH' : ins.priority === 'medium' ? '● 優先度: MEDIUM' : '● 優先度: LOW'

  // ── LEFT PANEL ────────────────────────────────────────────────────────────
  const LCX = M + PAD
  const LCW = LEFT_W - PAD * 2

  slide.addShape(pres.ShapeType.rect, {
    x: M, y: PANEL_Y, w: LEFT_W, h: PANEL_H,
    fill: { color: C.ACT_BG },
    line: { color: C.ACT_LINE, width: 0.75 },
  })
  slide.addShape(pres.ShapeType.rect, {
    x: M, y: PANEL_Y, w: 0.05, h: PANEL_H,
    fill: { color: C.ACT_TITLE },
    line: { color: C.ACT_TITLE, width: 0 },
  })
  // Label row
  slide.addText(`ACTION ${actionIndex}  推奨施策`, {
    x: LCX, y: PANEL_Y + 0.11, w: LCW, h: 0.22,
    fontSize: FS.LABEL, bold: true, color: C.ACT_TITLE, charSpacing: 0.5,
  })
  // Separator
  slide.addShape(pres.ShapeType.rect, {
    x: LCX, y: PANEL_Y + 0.37, w: LCW, h: 0.007,
    fill: { color: C.ACT_LINE },
    line: { color: C.ACT_LINE, width: 0 },
  })

  let CY = PANEL_Y + 0.50

  // Title — wrap at 18 chars × 2 lines (36 chars visible), 13pt bold
  slide.addText(wrapJapaneseText(actionTitleForPpt(ins.suggested_action || ins.insight, 36), 18, 2), {
    x: LCX, y: CY, w: LCW, h: 0.80,
    fontSize: 13, bold: true, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: 1.30,
  })
  CY += 0.85

  // Priority badge
  slide.addText(PRI_LABEL, {
    x: LCX, y: CY, w: LCW, h: 0.22,
    fontSize: 8, bold: true, color: PRI_COLOR,
  })
  CY += 0.28

  // Thin divider
  slide.addShape(pres.ShapeType.rect, {
    x: LCX, y: CY, w: LCW, h: 0.005,
    fill: { color: C.ACT_LINE },
    line: { color: C.ACT_LINE, width: 0 },
  })
  CY += 0.16

  // "反映先" label
  slide.addText('■ 反映先', {
    x: LCX, y: CY, w: LCW, h: 0.18,
    fontSize: 7, bold: true, color: '64748B',
  })
  CY += 0.22

  // Destination tags (e.g. "LP  /  広告  /  FAQ")
  slide.addText(inferDestination(ins), {
    x: LCX, y: CY, w: LCW, h: 0.38,
    fontSize: 9.5, color: C.BODY,
    valign: 'top', wrap: true, lineSpacingMultiple: 1.25,
  })

  // ── RIGHT COLUMN — 3 stacked cards ───────────────────────────────────────
  const impact = inferImpact(ins)

  // Card 1: やること — blue theme
  // wrapJapaneseText: 45字×4行 = 最大180字表示。content h=1.30" / 9pt*1.10 ≈ 8行分余裕あり
  addCard(pres, slide, {
    x: RIGHT_X, y: PANEL_Y,
    w: RIGHT_W,  h: CARD_H,
    bg: 'EFF6FF', accent: '1D4ED8', lineColor: 'BFDBFE',
    labelEn: 'ACTION', labelJa: '具体的にやること',
    content: wrapJapaneseText(ins.suggested_action || ins.insight, 45, 4),
    bodyFontSize: 9, lineSpacing: 1.10,
  })

  // Card 2: 根拠・インサイト — standard card
  addCard(pres, slide, {
    x: RIGHT_X, y: PANEL_Y + CARD_H + GAP,
    w: RIGHT_W,  h: CARD_H,
    bg: 'F8FAFC', accent: '475569', lineColor: 'CBD5E1',
    labelEn: 'RATIONALE', labelJa: '根拠・インサイト',
    content: wrapJapaneseText(ins.rationale, 45, 4),
    bodyFontSize: 9, lineSpacing: 1.10,
  })

  // Card 3: 期待効果 — green theme (inferImpact is always short, cap at 40)
  addCard(pres, slide, {
    x: RIGHT_X, y: PANEL_Y + (CARD_H + GAP) * 2,
    w: RIGHT_W,  h: CARD_H,
    bg: C.WIN_BG, accent: C.WIN_TITLE, lineColor: C.WIN_LINE,
    labelEn: 'EXPECTED IMPACT', labelJa: '期待効果',
    content: assertPptSafe(impact, 40),
    bodyFontSize: 9, lineSpacing: 1.10,
  })

  addFooter(pres, slide, 'レビュー分析結果に基づく初期提案資料', FTR_Y, slideNum)
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
  slideNum: string,
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
    ...appealWords.slice(0, 3).map((w) => assertPptSafe(`${w.word}（${w.score}pt）`, 24)),
    ...(lpSuggestions[0] ? [`[LP] ${pptTitle(lpSuggestions[0].headline, 20)}`] : []),
    ...(adCopies[0] ? [`[${adCopies[0].platform}] ${pptTitle(adCopies[0].headline, 20)}`] : []),
  ]
  // KEY ISSUES — wrapJapaneseText: ラベルを24字×2行で折り返し、件数を末尾に付加
  const issueContent = complaints.length === 0
    ? '（該当データなし）'
    : complaints.slice(0, 3)
        .map((c, idx) => `${idx + 1}.  ${wrapJapaneseText(c.label, 24, 2)}（${c.count}件）`)
        .join('\n')

  // NEXT ACTIONS — actionTitleForPpt で最大36文字タイトル抽出
  const rawActionTitles = [
    ...highInsights.slice(0, 3).map((ins) => actionTitleForPpt(ins.suggested_action || ins.insight, 36)),
    ...midInsights.slice(0, 2).map((ins) => actionTitleForPpt(ins.suggested_action || ins.insight, 36)),
  ]
  const actionContent = rawActionTitles.length === 0
    ? '（該当データなし）'
    : rawActionTitles.slice(0, 5).map((item, idx) => `${idx + 1}.  ${item}`).join('\n')

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
    content: issueContent,
  })
  addCard(pres, slide, {
    x: M, y: ACT_Y, w: W - M * 2, h: ACT_H,
    bg: C.ACT_BG, accent: C.ACT_TITLE, lineColor: C.ACT_LINE,
    labelEn: 'NEXT ACTIONS', labelJa: '次に取るべき打ち手',
    content: actionContent,
    lineSpacing: 1.20,
    bodyFontSize: 9,
  })

  addFooter(pres, slide, 'レビュー分析結果に基づく初期提案資料', FTR_Y, slideNum)
}

// ---------------------------------------------------------------------------
// Slide (last) — Evidence / Customer Insights
// ---------------------------------------------------------------------------

function buildSlide3(
  pres: PptxGenJS,
  project: ProjectData,
  analysis: ProjectAnalysis,
  industryLabel: string,
  slideNum: string,
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
  // wrapJapaneseText で自然改行 → truncation より多くの内容を表示。
  // 上段3列 COL3_W≈4.21" / 8pt / 1.20: 11行分余裕 → 3アイテム×2行で安全。
  // 下段2列 COL2_W≈6.37" / 8pt / 1.20: 14行分余裕 → 3アイテム×2行で安全。

  // Rating points — ラベル18字×2行 + 件数
  const ratingContent = ratingPoints.length === 0
    ? '（データなし）'
    : ratingPoints.slice(0, 3)
        .map((rp, i) => `${i + 1}.  ${wrapJapaneseText(rp.label, 18, 2)}（${rp.count}件）`)
        .join('\n')

  // Complaints — ラベル18字×2行 + 件数
  const complaintContent = complaints.length === 0
    ? '（データなし）'
    : complaints.slice(0, 3)
        .map((c, i) => `${i + 1}.  ${wrapJapaneseText(c.label, 18, 2)}（${c.count}件）`)
        .join('\n')

  // Purchase reasons — ラベル18字×2行 + 件数
  const purchaseContent = purchaseReasons.length === 0
    ? '（データなし）'
    : purchaseReasons.slice(0, 3)
        .map((pr, i) => `${i + 1}.  ${wrapJapaneseText(pr.label, 18, 2)}（${pr.count}件）`)
        .join('\n')

  // Occasion insights — シーン名22字×2行
  const occasionContent = occasionInsights.length === 0
    ? '（データなし）'
    : occasionInsights.slice(0, 3)
        .map((oi, i) => `${i + 1}.  ${wrapJapaneseText(oi.occasion, 22, 2)}`)
        .join('\n')

  // Avoid appeals — 訴求名＋代替メッセージを28字×2行で表示
  const avoidContent = avoidAppeals.length === 0
    ? '（データなし）'
    : avoidAppeals.slice(0, 2).map((aa, i) => {
        const combined = aa.replacement_message
          ? `${aa.appeal} → ${aa.replacement_message}`
          : aa.appeal
        return `${i + 1}.  ${wrapJapaneseText(combined, 28, 2)}`
      }).join('\n')

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
  // bodyFontSize 8pt + lineSpacing 1.20: 3アイテム×1行が content 高さ内に確実に収まる
  addCard(pres, slide, {
    x: M,                     y: ROW1_Y, w: COL3_W, h: ROW1_H,
    bg: C.WIN_BG, accent: C.WIN_TITLE, lineColor: C.WIN_LINE,
    labelEn: 'RATING POINTS', labelJa: '評価ポイント Top3',
    content: ratingContent,
    bodyFontSize: 8, lineSpacing: 1.20,
  })
  addCard(pres, slide, {
    x: M + COL3_W + GAP,      y: ROW1_Y, w: COL3_W, h: ROW1_H,
    bg: C.ISS_BG, accent: C.ISS_TITLE, lineColor: C.ISS_LINE,
    labelEn: 'COMPLAINTS',    labelJa: '不満点 Top3',
    content: complaintContent,
    bodyFontSize: 8, lineSpacing: 1.20,
  })
  addCard(pres, slide, {
    x: M + COL3_W * 2 + GAP * 2, y: ROW1_Y, w: COL3_W, h: ROW1_H,
    bg: 'F8FAFC', accent: '475569', lineColor: 'CBD5E1',
    labelEn: 'PURCHASE REASONS', labelJa: '購入理由 Top3',
    content: purchaseContent,
    bodyFontSize: 8, lineSpacing: 1.20,
  })

  // Row 2 — occasion insights + avoid appeals
  addCard(pres, slide, {
    x: M,             y: ROW2_Y, w: COL2_W, h: ROW2_H,
    bg: 'F0F9FF', accent: '0369A1', lineColor: 'BAE6FD',   // sky
    labelEn: 'OCCASION INSIGHTS', labelJa: '想起シーン Top3',
    content: occasionContent,
    bodyFontSize: 8, lineSpacing: 1.20,
  })
  addCard(pres, slide, {
    x: M + COL2_W + GAP, y: ROW2_Y, w: COL2_W, h: ROW2_H,
    bg: C.MKT_BG, accent: C.MKT_TITLE, lineColor: C.MKT_LINE,
    labelEn: 'AVOID APPEALS', labelJa: '捨てるべき訴求 Top2',
    content: avoidContent,
    bodyFontSize: 8, lineSpacing: 1.20,
  })

  addFooter(pres, slide, 'レビュー分析結果に基づく初期提案資料', FTR_Y, slideNum)
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

  // Sort insights high→medium→low, take up to 3 for action slides
  const allInsights = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const sortedInsights = [...allInsights].sort((a, b) => {
    const ord: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return (ord[a.priority] ?? 1) - (ord[b.priority] ?? 1)
  })
  const actions = sortedInsights.slice(0, 3)
  const total = 2 + actions.length  // Slide 1 + action slides + Evidence

  buildSlide1(pres, project, analysis, industryLabel, `1 / ${total}`)
  actions.forEach((ins, i) => {
    buildActionSlide(pres, project, ins, i + 1, `${i + 2} / ${total}`, industryLabel)
  })
  buildSlide3(pres, project, analysis, industryLabel, `${total} / ${total}`)

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
