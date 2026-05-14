import type {
  ProjectAnalysis,
  RatingPoint,
  Complaint,
  PurchaseReason,
  CustomerType,
  AppealWord,
  MarketingInsight,
  LpSuggestion,
  AdCopySuggestion,
  ContentIdea,
} from '@/types/analysis'

interface ProjectMeta {
  name: string
  description: string | null
  review_count: number
  analysis_completed_at: string | null
}

interface ChunkStats {
  total: number
  done: number
  error: number
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function h1(text: string) { return `# ${text}\n` }
function h2(text: string) { return `\n## ${text}\n` }
function h3(text: string) { return `\n### ${text}\n` }
function hr() { return '\n---\n' }

function empty() { return '\n_該当データはありません_\n' }

const PRIORITY_LABEL: Record<string, string> = {
  high: '🔴 高',
  medium: '🟡 中',
  low: '🟢 低',
}

export function generateProjectReportMarkdown(
  project: ProjectMeta,
  analysis: ProjectAnalysis,
  chunkStats: ChunkStats
): string {
  const lines: string[] = []

  const ratingPoints = (analysis.rating_points ?? []) as RatingPoint[]
  const complaints = (analysis.complaints ?? []) as Complaint[]
  const purchaseReasons = (analysis.purchase_reasons ?? []) as PurchaseReason[]
  const customerTypes = (analysis.customer_types ?? []) as CustomerType[]
  const appealWords = (analysis.appeal_words ?? []) as AppealWord[]
  const insights = (analysis.marketing_insights ?? []) as MarketingInsight[]
  const lpSuggestions = (analysis.lp_suggestions ?? []) as LpSuggestion[]
  const adCopies = (analysis.ad_copy_suggestions ?? []) as AdCopySuggestion[]
  const contentIdeas = (analysis.content_ideas ?? []) as ContentIdea[]

  // ──────────────────────────────────────────────────
  // タイトル
  // ──────────────────────────────────────────────────
  lines.push(h1(`マーケティングリサーチレポート: ${project.name}`))
  lines.push(`> 生成日時: ${formatDate(new Date().toISOString())} / Powered by Hype Up AI`)
  lines.push('')

  // ──────────────────────────────────────────────────
  // レポート概要
  // ──────────────────────────────────────────────────
  lines.push(h2('レポート概要'))
  lines.push(`| 項目 | 内容 |`)
  lines.push(`|---|---|`)
  lines.push(`| 分析対象 | ${project.name} |`)
  if (project.description) lines.push(`| 商品説明 | ${project.description} |`)
  lines.push(`| レビュー件数 | ${project.review_count.toLocaleString()} 件 |`)
  lines.push(`| 分析チャンク | ${chunkStats.done} / ${chunkStats.total} 完了${chunkStats.error > 0 ? ` (${chunkStats.error} エラー)` : ''} |`)
  lines.push(`| 分析完了日時 | ${formatDate(project.analysis_completed_at)} |`)
  if (analysis.total_tokens_used) lines.push(`| 使用トークン | ${analysis.total_tokens_used.toLocaleString()} |`)

  // ──────────────────────────────────────────────────
  // エグゼクティブサマリー
  // ──────────────────────────────────────────────────
  lines.push(h2('エグゼクティブサマリー'))
  lines.push(analysis.summary || '_サマリーがありません_')

  lines.push(hr())

  // ──────────────────────────────────────────────────
  // 評価ポイント（LP・広告訴求への転用）
  // ──────────────────────────────────────────────────
  lines.push(h2('主要な評価ポイント — LP・広告訴求への転用'))
  lines.push('> 顧客が高く評価している点です。これらを LP のヘッドライン・広告コピーの訴求軸として活用してください。\n')

  if (ratingPoints.length === 0) {
    lines.push(empty())
  } else {
    ratingPoints.forEach((rp, i) => {
      lines.push(`### ${i + 1}. ${rp.label}（${rp.count} 件）`)

      // コピー候補フレーズ — 最重要な転用素材として強調
      if (rp.copyworthy_phrases && rp.copyworthy_phrases.length > 0) {
        lines.push('')
        lines.push('**📌 広告・LP コピー候補フレーズ**')
        rp.copyworthy_phrases.forEach((phrase) => {
          lines.push(`- 「${phrase}」`)
        })
      }

      // 顧客の生の声
      if (rp.examples && rp.examples.length > 0) {
        lines.push('')
        lines.push('**💬 顧客の声（原文）**')
        rp.examples.slice(0, 2).forEach((ex) => {
          lines.push(`> 「${ex}」`)
        })
      }
      lines.push('')
    })
  }

  // ──────────────────────────────────────────────────
  // 不満点（FAQ・LP改善への転用）
  // ──────────────────────────────────────────────────
  lines.push(h2('主要な不満点 — FAQ・LP 改善への転用'))
  lines.push('> 不満点は「商品改善のヒント」ではなく「購入前の不安を先回りして払拭するための施策」に転用します。\n')

  if (complaints.length === 0) {
    lines.push(empty())
  } else {
    complaints.forEach((c, i) => {
      lines.push(`### ${i + 1}. ${c.label}（${c.count} 件）`)

      if (c.examples && c.examples.length > 0) {
        lines.push('')
        lines.push('**💬 顧客の声**')
        c.examples.slice(0, 1).forEach((ex) => {
          lines.push(`> 「${ex}」`)
        })
      }

      if (c.faq_suggestion) {
        lines.push('')
        lines.push('**❓ FAQ 転用案（購入ページ・LP に掲載）**')
        lines.push(c.faq_suggestion)
      }

      if (c.lp_counter_suggestion) {
        lines.push('')
        lines.push('**🖥️ LP 改善案（この不安を先回りして払拭するには）**')
        lines.push(c.lp_counter_suggestion)
      }

      lines.push('')
    })
  }

  // ──────────────────────────────────────────────────
  // 購入理由（深層心理に響く訴求の根拠）
  // ──────────────────────────────────────────────────
  lines.push(h2('購入理由 — 深層心理に響く訴求の根拠'))
  lines.push('> 表面的な理由と深層心理を分けることで、感情に刺さる広告コピーを作れます。\n')

  if (purchaseReasons.length === 0) {
    lines.push(empty())
  } else {
    purchaseReasons.forEach((pr, i) => {
      lines.push(`### ${i + 1}. ${pr.label}（${pr.count} 件）`)

      if (pr.examples && pr.examples.length > 0) {
        lines.push('')
        pr.examples.slice(0, 1).forEach((ex) => {
          lines.push(`> 「${ex}」`)
        })
      }

      lines.push('')
      lines.push(`| 視点 | 内容 |`)
      lines.push(`|---|---|`)
      if (pr.surface_reason) lines.push(`| 表面的な理由 | ${pr.surface_reason} |`)
      if (pr.deep_psychology) lines.push(`| **深層心理** | **${pr.deep_psychology}** |`)
      lines.push('')
    })
  }

  // ──────────────────────────────────────────────────
  // 顧客タイプ（広告ターゲティングの軸）
  // ──────────────────────────────────────────────────
  lines.push(h2('顧客タイプ — 広告ターゲティングの軸'))
  lines.push('> 各タイプへの広告訴求・ターゲティング設定の方向性を示します。\n')

  if (customerTypes.length === 0) {
    lines.push(empty())
  } else {
    customerTypes.forEach((ct, i) => {
      lines.push(`### ${i + 1}. ${ct.label}（推定 ${ct.count} 件）`)
      if (ct.description) {
        lines.push('')
        lines.push(ct.description)
      }
      if (ct.ad_targeting_hint) {
        lines.push('')
        lines.push(`**🎯 広告ターゲティング:** ${ct.ad_targeting_hint}`)
      }
      lines.push('')
    })
  }

  // ──────────────────────────────────────────────────
  // 訴求ワード（コピーライティングの素材）
  // ──────────────────────────────────────────────────
  lines.push(h2('訴求ワード — コピーライティングの素材'))
  lines.push('> スコアが高いほど広告・LP への転用効果が高いと判定されたワード・フレーズです。\n')

  if (appealWords.length === 0) {
    lines.push(empty())
  } else {
    // 上位ワードをタグクラウド的に並べる
    lines.push('**トップワード:** ' + appealWords.slice(0, 8).map((w) => `\`${w.word}\``).join(' / '))
    lines.push('')

    // 詳細テーブル
    lines.push('| ワード | スコア | 頻度 | 文脈 | 活用法 |')
    lines.push('|---|---|---|---|---|')
    appealWords.slice(0, 12).forEach((w) => {
      const context = w.context ? w.context.replace(/\|/g, '／').slice(0, 30) : '—'
      const use = w.suggested_use ? w.suggested_use.replace(/\|/g, '／').slice(0, 30) : '—'
      lines.push(`| **${w.word}** | ${w.score} | ${w.frequency} | ${context} | ${use} |`)
    })
    lines.push('')
  }

  lines.push(hr())

  // ──────────────────────────────────────────────────
  // マーケティング示唆（観察→解釈→推奨アクション）
  // ──────────────────────────────────────────────────
  lines.push(h2('マーケティング示唆 — 観察・解釈・推奨アクション'))
  lines.push('> 優先度「高」から着手してください。各示唆は「観察（事実）→ 解釈（意味）→ 推奨アクション（施策）」の構造で提示しています。\n')

  if (insights.length === 0) {
    lines.push(empty())
  } else {
    const sortedInsights = [...insights].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
    })

    sortedInsights.forEach((ins, i) => {
      const priority = PRIORITY_LABEL[ins.priority] ?? ins.priority
      lines.push(`### ${i + 1}. [優先度 ${priority}] ${ins.insight}`)
      lines.push('')
      if (ins.rationale) {
        lines.push(`**解釈:** ${ins.rationale}`)
        lines.push('')
      }
      if (ins.suggested_action) {
        lines.push(`**→ 推奨アクション:** ${ins.suggested_action}`)
        lines.push('')
      }
    })
  }

  // ──────────────────────────────────────────────────
  // LP改善案
  // ──────────────────────────────────────────────────
  lines.push(h2('LP 改善案'))
  lines.push('> 顧客の声をもとに、ランディングページへの具体的な改善提案です。\n')

  if (lpSuggestions.length === 0) {
    lines.push(empty())
  } else {
    lpSuggestions.forEach((lp, i) => {
      lines.push(h3(`${i + 1}. [${lp.section}] ${lp.headline}`))
      if (lp.body) lines.push(lp.body)
      if (lp.evidence) {
        lines.push('')
        lines.push(`_根拠: ${lp.evidence}_`)
      }
      lines.push('')
    })
  }

  // ──────────────────────────────────────────────────
  // 広告コピー案
  // ──────────────────────────────────────────────────
  lines.push(h2('広告コピー案'))
  lines.push('> ペルソナ別・媒体別の広告クリエイティブ案です。\n')

  if (adCopies.length === 0) {
    lines.push(empty())
  } else {
    adCopies.forEach((ad, i) => {
      lines.push(h3(`${i + 1}. [${ad.platform}]`))
      lines.push(`**ヘッドライン:** ${ad.headline}`)
      if (ad.target_persona) lines.push(`**ターゲット:** ${ad.target_persona}`)
      if (ad.body) {
        lines.push('')
        lines.push(ad.body)
      }
      if (ad.cta) {
        lines.push('')
        lines.push(`**CTA:** ${ad.cta}`)
      }
      lines.push('')
    })
  }

  // ──────────────────────────────────────────────────
  // コンテンツアイデア
  // ──────────────────────────────────────────────────
  lines.push(h2('コンテンツアイデア'))
  lines.push('> SNS・ブログ・動画などコンテンツマーケティングに活用できる企画案です。\n')

  if (contentIdeas.length === 0) {
    lines.push(empty())
  } else {
    contentIdeas.forEach((ci, i) => {
      lines.push(`### ${i + 1}. [${ci.format}] ${ci.title}`)
      if (ci.angle) lines.push(`**アングル:** ${ci.angle}`)
      if (ci.key_message) {
        lines.push('')
        lines.push(`**コアメッセージ:** ${ci.key_message}`)
      }
      lines.push('')
    })
  }

  lines.push(hr())

  // ──────────────────────────────────────────────────
  // 次に取るべきアクション（必ず生成・4段フォールバック）
  // ──────────────────────────────────────────────────
  lines.push(h2('次に取るべきアクション'))
  lines.push('> 今すぐ着手できるアクションを優先度順に並べています。\n')

  const actionItems: { action: string; source: string; rationale?: string }[] = []

  // 1. high priority の suggested_action を優先
  insights
    .filter((ins) => ins.priority === 'high' && ins.suggested_action)
    .forEach((ins) => {
      actionItems.push({
        action: ins.suggested_action!,
        source: 'マーケティング示唆（高優先度）',
        rationale: ins.rationale,
      })
    })

  // 2. high priority で suggested_action なし → insight 本文
  insights
    .filter((ins) => ins.priority === 'high' && !ins.suggested_action)
    .forEach((ins) => {
      actionItems.push({
        action: ins.insight,
        source: 'マーケティング示唆（高優先度）',
        rationale: ins.rationale,
      })
    })

  // 3. medium priority の suggested_action をフォールバック
  if (actionItems.length < 3) {
    insights
      .filter((ins) => ins.priority === 'medium' && ins.suggested_action)
      .slice(0, 3 - actionItems.length)
      .forEach((ins) => {
        actionItems.push({
          action: ins.suggested_action!,
          source: 'マーケティング示唆（中優先度）',
        })
      })
  }

  // 4. LP/広告/コンテンツから自動生成
  if (actionItems.length === 0) {
    if (lpSuggestions[0]) {
      actionItems.push({
        action: `LP「${lpSuggestions[0].section}」セクションを改善: ${lpSuggestions[0].headline}`,
        source: 'LP 改善案より自動生成',
      })
    }
    if (adCopies[0]) {
      actionItems.push({
        action: `${adCopies[0].platform} 向け広告コピーを制作: 「${adCopies[0].headline}」`,
        source: '広告コピー案より自動生成',
      })
    }
    if (contentIdeas[0]) {
      actionItems.push({
        action: `コンテンツ制作: ${contentIdeas[0].format}「${contentIdeas[0].title}」`,
        source: 'コンテンツアイデアより自動生成',
      })
    }
  }

  if (actionItems.length === 0) {
    lines.push('_アクション候補を抽出できませんでした。マーケティング示唆を確認してください。_')
  } else {
    actionItems.forEach((item, i) => {
      lines.push(`**${i + 1}. ${item.action}**`)
      lines.push(`   _出典: ${item.source}_`)
      if (item.rationale) lines.push(`   - ${item.rationale}`)
      lines.push('')
    })
  }

  // ──────────────────────────────────────────────────
  // 免責
  // ──────────────────────────────────────────────────
  lines.push(h3('免責'))
  lines.push('_本レポートはアップロードされたレビューをもとにした分析結果です。最終的な施策判断は担当者が行ってください。_')
  lines.push('')

  return lines.join('\n')
}
