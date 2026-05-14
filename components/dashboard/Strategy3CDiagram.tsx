'use client'

import { Heart } from 'lucide-react'
import type { Strategy3C } from '@/types/analysis'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBullet(b: string): { label: string | null; value: string } {
  const idx = b.indexOf('：')
  return idx > 0
    ? { label: b.slice(0, idx), value: b.slice(idx + 1) }
    : { label: null, value: b }
}

// ---------------------------------------------------------------------------
// NodeCard — diagram 内のコンパクトカード
// ---------------------------------------------------------------------------

interface NodeCardProps {
  /** 絵文字フォールバック（iconSrc がない場合に使用） */
  emoji: string
  /** 人物アイコン画像の src（public配下からの絶対パス） */
  iconSrc?: string
  role: string    // 補助ラベル: "好きな人（顧客）" など
  title: string   // "Customer" など
  bullets: string[]
  borderCls: string
  bgCls?: string
  titleCls: string
  roleCls: string
}

function NodeCard({
  emoji, iconSrc, role, title, bullets, borderCls, bgCls = '', titleCls, roleCls,
}: NodeCardProps) {
  return (
    <div className={`rounded-xl border bg-white dark:bg-card shadow-sm p-2.5 ${borderCls} ${bgCls}`}>
      <div className="text-center mb-1.5">
        {iconSrc ? (
          /* 人物アイコン画像: PC 52px / モバイル 44px */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconSrc}
            alt={role}
            className="mx-auto w-11 h-11 md:w-13 md:h-13 object-contain"
            style={{ width: '52px', height: '52px' }}
          />
        ) : (
          <span className="text-xl leading-none">{emoji}</span>
        )}
        <p className={`mt-0.5 text-[9px] font-medium leading-tight ${roleCls}`}>{role}</p>
        <p className={`text-[11px] font-semibold leading-tight mt-0.5 ${titleCls}`}>{title}</p>
      </div>
      {bullets.length > 0 && (
        <ul className="space-y-0.5">
          {bullets.slice(0, 3).map((b, i) => {
            const { label, value } = parseBullet(b)
            return (
              <li key={i} className="text-[9px] leading-snug text-foreground/70">
                {label && (
                  <span className="font-medium text-foreground/80">{label}：</span>
                )}
                {value}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EdgeBadge — 線上の関係性ラベル
// ---------------------------------------------------------------------------

interface EdgeBadgeProps {
  label: string
  heart?: boolean
  style?: React.CSSProperties
}

function EdgeBadge({ label, heart, style }: EdgeBadgeProps) {
  return (
    <div
      className="absolute z-10 flex items-center gap-1.5 rounded-full border border-border/80 bg-white dark:bg-card shadow-md px-4 py-2 text-sm font-bold text-foreground/80 whitespace-nowrap pointer-events-none"
      style={style}
    >
      {heart && (
        <Heart className="h-3.5 w-3.5 flex-shrink-0 fill-rose-400 stroke-none" />
      )}
      {label}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TriangleDiagram — デスクトップ三角形レイアウト (md+)
//
// SVG viewBox="0 0 100 60" + preserveAspectRatio="none" により
// SVG の x/y 座標がコンテナの %幅 / %高さ に 1:1 で対応する。
//
// ノード中心座標（SVG space = CSS %、y軸は 60 が最下部）:
//   Customer       : (50, 10)  ← top:4%  + card_half(~13%) ≈ 17% → 17/100*60≈10
//   Competitor     : (13, 50)  ← bottom:4% → top≈83% → center≈83+13%=96%? No:
//                              ← card height ~23% of container, center at 100-4-23/2 ≈ 84.5% → y=50.7
//   Company        : (87, 50)
//   WinningStrategy: (50, 22)  ← top:36% → 36/100*60=21.6≈22
// ---------------------------------------------------------------------------

function TriangleDiagram({ data }: { data: Strategy3C }) {
  const { customer, competitor, company, winning_strategy } = data

  return (
    // paddingBottom: '68%' → 高さ = 幅 × 0.68、SVG viewBox 0 0 100 68 と対応
    //
    // ノード配置とカード高さの計算（幅 1024px 想定）:
    //   コンテナ高さ ≈ 696px、カード高さ ≈ 18% ≈ 125px (card_half ≈ 9%)
    //   Customer : top:4%  → 下端22%   SVG y: top=2.7, bottom=15.0
    //   Winning  : top:50%, translate-50% → 上端41%, 中心50%, 下端59%
    //              Customer下端22% と Winning上端41% → 隙間19% ≈ 132px ✅
    //   Competitor/Company: bottom:5% → 上端77%, 中心86%  SVG y: center=58.5
    //   Winning下端59% と Competitor上端77% → 隙間18% ≈ 125px ✅
    <div className="relative w-full" style={{ paddingBottom: '68%' }}>

      {/* SVG 接続線レイヤー
           viewBox="0 0 100 68" → x/y 座標 = CSS %width / (height%×68/100)
           ノード中心 SVG 座標（CSS% ÷ 100 × 68）:
             Customer  : (50,  9)   [CSS center≈13% → 13/100*68=8.8≈9]
             Competitor: (13, 58)   [CSS center≈85% → 85/100*68=57.8≈58]
             Company   : (87, 58)
             Winning   : (50, 34)   [CSS center=50% → 50/100*68=34]
      */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 68"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        {/* 外周三角形 (破線): Customer–Competitor–Company */}
        <line
          x1="50" y1="15" x2="16" y2="53"
          stroke="currentColor" strokeWidth="0.4"
          strokeDasharray="2.5 1.5" strokeOpacity="0.35"
          className="text-border"
        />
        <line
          x1="50" y1="15" x2="84" y2="53"
          stroke="currentColor" strokeWidth="0.4"
          strokeDasharray="2.5 1.5" strokeOpacity="0.35"
          className="text-border"
        />
        <line
          x1="21" y1="62" x2="79" y2="62"
          stroke="currentColor" strokeWidth="0.4"
          strokeDasharray="2.5 1.5" strokeOpacity="0.35"
          className="text-border"
        />
        {/* 重心スポーク (実線・紫): カード端 → カード端 */}
        {/* Customer 下端(CSS22%→y=15) → Winning 上端(CSS41%→y=28) */}
        <line
          x1="50" y1="16" x2="50" y2="27"
          stroke="#8b5cf6" strokeWidth="0.7" strokeOpacity="0.65"
        />
        {/* Competitor 上端(CSS77%→y=52) → Winning 下端(CSS59%→y=40) */}
        <line
          x1="18" y1="53" x2="44" y2="41"
          stroke="#8b5cf6" strokeWidth="0.7" strokeOpacity="0.65"
        />
        {/* Company 上端 → Winning 下端 */}
        <line
          x1="82" y1="53" x2="56" y2="41"
          stroke="#8b5cf6" strokeWidth="0.7" strokeOpacity="0.65"
        />
      </svg>

      {/* ── Customer: top center ── */}
      <div
        className="absolute"
        style={{ top: '4%', left: '50%', transform: 'translateX(-50%)', width: '22%', minWidth: 140 }}
      >
        <NodeCard
          emoji="💗"
          iconSrc="/strategy-icons/customer-girl.svg"
          role="好きな人（顧客）"
          title="Customer"
          bullets={customer.bullets}
          borderCls="border-blue-200 dark:border-blue-800"
          titleCls="text-blue-700 dark:text-blue-400"
          roleCls="text-blue-500"
        />
      </div>

      {/* ── Competitor: bottom left ── */}
      <div
        className="absolute"
        style={{ bottom: '5%', left: '3%', width: '22%', minWidth: 140 }}
      >
        <NodeCard
          emoji="⚔️"
          iconSrc="/strategy-icons/competitor-boy.svg"
          role="ライバル（競合）"
          title="Competitor"
          bullets={competitor.bullets}
          borderCls="border-amber-200 dark:border-amber-800"
          titleCls="text-amber-700 dark:text-amber-400"
          roleCls="text-amber-500"
        />
      </div>

      {/* ── Company: bottom right ── */}
      <div
        className="absolute"
        style={{ bottom: '5%', right: '3%', width: '22%', minWidth: 140 }}
      >
        <NodeCard
          emoji="🌟"
          iconSrc="/strategy-icons/company-student.svg"
          role="自分（自社）"
          title="Company"
          bullets={company.bullets}
          borderCls="border-emerald-200 dark:border-emerald-800"
          titleCls="text-emerald-700 dark:text-emerald-400"
          roleCls="text-emerald-500"
        />
      </div>

      {/* ── Winning Strategy: 図の重心（上下左右ほぼ中央） ── */}
      {/*    top:50%, translate(-50%,-50%) → 中心50%
             Customer下端22% → Winning上端41%: 隙間19% ✅
             Winning下端59% → Competitor上端77%: 隙間18% ✅ */}
      <div
        className="absolute"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '24%', minWidth: 148 }}
      >
        <NodeCard
          emoji="⚡"
          role="選ばれる理由"
          title="Winning Strategy"
          bullets={winning_strategy.bullets}
          borderCls="border-violet-200 dark:border-violet-800"
          bgCls="bg-violet-50/70 dark:bg-violet-950/20"
          titleCls="text-violet-700 dark:text-violet-400"
          roleCls="text-violet-500"
        />
      </div>

      {/* ── Edge labels ── */}
      {/* Customer ↔ Competitor の左側中間（外周線の中点付近） */}
      <EdgeBadge
        label="比較される訴求"
        style={{ left: '13%', top: '46%', transform: 'translateY(-50%)' }}
      />
      {/* Customer ↔ Company の右側中間 */}
      <EdgeBadge
        label="刺さる訴求"
        heart
        style={{ right: '13%', top: '46%', transform: 'translateY(-50%)' }}
      />
      {/* Competitor ↔ Company の下辺中央 */}
      <EdgeBadge
        label="差別化"
        style={{ left: '50%', bottom: '8%', transform: 'translateX(-50%)' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// MobileStack — モバイル縦並び (sm以下)
// ---------------------------------------------------------------------------

function MobileStack({ data }: { data: Strategy3C }) {
  const { customer, competitor, company, winning_strategy } = data
  return (
    <div className="space-y-3">
      <NodeCard
        emoji="💗"
        iconSrc="/strategy-icons/customer-girl.svg"
        role="好きな人（顧客）"
        title="Customer"
        bullets={customer.bullets}
        borderCls="border-blue-200 dark:border-blue-800"
        titleCls="text-blue-700 dark:text-blue-400"
        roleCls="text-blue-500"
      />
      <NodeCard
        emoji="⚡"
        role="選ばれる理由"
        title="Winning Strategy"
        bullets={winning_strategy.bullets}
        borderCls="border-violet-200 dark:border-violet-800"
        bgCls="bg-violet-50/70 dark:bg-violet-950/20"
        titleCls="text-violet-700 dark:text-violet-400"
        roleCls="text-violet-500"
      />
      <div className="grid grid-cols-2 gap-3">
        <NodeCard
          emoji="⚔️"
          iconSrc="/strategy-icons/competitor-boy.svg"
          role="ライバル（競合）"
          title="Competitor"
          bullets={competitor.bullets}
          borderCls="border-amber-200 dark:border-amber-800"
          titleCls="text-amber-700 dark:text-amber-400"
          roleCls="text-amber-500"
        />
        <NodeCard
          emoji="🌟"
          iconSrc="/strategy-icons/company-student.svg"
          role="自分（自社）"
          title="Company"
          bullets={company.bullets}
          borderCls="border-emerald-200 dark:border-emerald-800"
          titleCls="text-emerald-700 dark:text-emerald-400"
          roleCls="text-emerald-500"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

interface Strategy3CDiagramProps {
  data: Strategy3C
}

export function Strategy3CDiagram({ data }: Strategy3CDiagramProps) {
  return (
    <div className="space-y-4">
      {/* タイトル */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          選ばれる理由を見つける3C構造
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          顧客・競合・自社の関係から、今打ち出すべき勝ち筋を整理します
        </p>
      </div>

      {/* md以上: 三角形ダイアグラム */}
      <div className="hidden md:block">
        <TriangleDiagram data={data} />
      </div>

      {/* sm以下: 縦並びスタック */}
      <div className="md:hidden">
        <MobileStack data={data} />
      </div>
    </div>
  )
}
