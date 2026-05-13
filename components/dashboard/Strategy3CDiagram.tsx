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
  emoji: string
  role: string    // 補助ラベル: "好きな人（顧客）" など
  title: string   // "Customer" など
  bullets: string[]
  borderCls: string
  bgCls?: string
  titleCls: string
  roleCls: string
}

function NodeCard({
  emoji, role, title, bullets, borderCls, bgCls = '', titleCls, roleCls,
}: NodeCardProps) {
  return (
    <div className={`rounded-xl border bg-white dark:bg-card shadow-sm p-2.5 ${borderCls} ${bgCls}`}>
      <div className="text-center mb-1.5">
        <span className="text-xl leading-none">{emoji}</span>
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
      className="absolute z-10 flex items-center gap-0.5 rounded-full border border-border/60 bg-background/90 px-1.5 py-0.5 text-[8.5px] font-medium text-muted-foreground whitespace-nowrap pointer-events-none"
      style={style}
    >
      {heart && (
        <Heart className="h-2.5 w-2.5 flex-shrink-0 fill-rose-400 stroke-none" />
      )}
      {label}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TriangleDiagram — デスクトップ三角形レイアウト (md+)
//
// SVG viewBox="0 0 100 75" + preserveAspectRatio="none" により
// SVG の x/y 座標がコンテナの %幅 / %高さ に 1:1 で対応する。
// ノードの配置を以下の「中心点」に合わせて線を引く:
//   Customer       : (50, 11)
//   Competitor     : (13, 60)
//   Company        : (87, 60)
//   WinningStrategy: (50, 40)   ← 三角形の重心付近
// ---------------------------------------------------------------------------

function TriangleDiagram({ data }: { data: Strategy3C }) {
  const { customer, competitor, company, winning_strategy } = data

  return (
    // paddingBottom: '75%' → 高さ = 幅 × 0.75、SVG viewBox 0 0 100 75 と一致
    <div className="relative w-full" style={{ paddingBottom: '75%' }}>

      {/* SVG 接続線レイヤー */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 75"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        {/* 外周三角形 (破線) — Customer-Competitor-Company */}
        <line
          x1="50" y1="19" x2="17" y2="58"
          stroke="currentColor" strokeWidth="0.45"
          strokeDasharray="2.5 1.5" strokeOpacity="0.45"
          className="text-border"
        />
        <line
          x1="50" y1="19" x2="83" y2="58"
          stroke="currentColor" strokeWidth="0.45"
          strokeDasharray="2.5 1.5" strokeOpacity="0.45"
          className="text-border"
        />
        <line
          x1="21" y1="67" x2="79" y2="67"
          stroke="currentColor" strokeWidth="0.45"
          strokeDasharray="2.5 1.5" strokeOpacity="0.45"
          className="text-border"
        />
        {/* 重心スポーク (実線・紫) — 各ノード → Winning Strategy */}
        <line
          x1="50" y1="21" x2="50" y2="34"
          stroke="#8b5cf6" strokeWidth="0.55" strokeOpacity="0.4"
        />
        <line
          x1="20" y1="61" x2="44" y2="46"
          stroke="#8b5cf6" strokeWidth="0.55" strokeOpacity="0.4"
        />
        <line
          x1="80" y1="61" x2="56" y2="46"
          stroke="#8b5cf6" strokeWidth="0.55" strokeOpacity="0.4"
        />
      </svg>

      {/* ── Customer: top center ── */}
      <div
        className="absolute"
        style={{ top: '2%', left: '50%', transform: 'translateX(-50%)', width: '24%', minWidth: 144 }}
      >
        <NodeCard
          emoji="💗"
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
        style={{ bottom: '3%', left: '2%', width: '24%', minWidth: 144 }}
      >
        <NodeCard
          emoji="⚔️"
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
        style={{ bottom: '3%', right: '2%', width: '24%', minWidth: 144 }}
      >
        <NodeCard
          emoji="🌟"
          role="自分（自社）"
          title="Company"
          bullets={company.bullets}
          borderCls="border-emerald-200 dark:border-emerald-800"
          titleCls="text-emerald-700 dark:text-emerald-400"
          roleCls="text-emerald-500"
        />
      </div>

      {/* ── Winning Strategy: center (重心) ── */}
      <div
        className="absolute"
        style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: '26%', minWidth: 152 }}
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
      {/* Customer ↔ Competitor の左側 */}
      <EdgeBadge
        label="比較される訴求"
        style={{ left: '16%', top: '42%', transform: 'translateY(-50%)' }}
      />
      {/* Customer ↔ Company の右側 */}
      <EdgeBadge
        label="刺さる訴求"
        heart
        style={{ right: '16%', top: '42%', transform: 'translateY(-50%)' }}
      />
      {/* Competitor ↔ Company の下辺中央 */}
      <EdgeBadge
        label="差別化"
        style={{ left: '50%', bottom: '10%', transform: 'translateX(-50%)' }}
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
          role="ライバル（競合）"
          title="Competitor"
          bullets={competitor.bullets}
          borderCls="border-amber-200 dark:border-amber-800"
          titleCls="text-amber-700 dark:text-amber-400"
          roleCls="text-amber-500"
        />
        <NodeCard
          emoji="🌟"
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
