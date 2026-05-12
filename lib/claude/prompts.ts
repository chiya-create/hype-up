import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'
import type {
  ChunkAnalysisResult,
  ProjectAnalysisResult,
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
  ComparisonProject,
  ReviewForAnalysis,
} from '@/types/analysis'

// =============================================================================
// 分析思想のコンテキスト
//
// Hype Up AI はレビュー「要約」ツールではなく、レビューから
// 「売れる訴求・LP改善・広告改善・商品改善のヒント」を発掘するツール。
//
// Claude への指示原則:
//   1. 顧客の生の言葉を広告・LP・SNSに転用できる形で抽出する
//   2. 不満点は商品改善だけでなく FAQ改善・訴求改善にも転用する
//   3. 購買理由は「表面的な理由」と「深層心理」に必ず分けて扱う
//   4. 最終出力は「分析結果」ではなく「次に取るべき施策」に寄せる
//   5. 抽象的なラベルを避け、レビュー本文に根ざした具体的な言葉を使う
// =============================================================================

// ---------------------------------------------------------------------------
// チャンク分析プロンプト (50件ずつ送信)
// ---------------------------------------------------------------------------

function buildIndustryFocusSection(industry: string): string {
  const tmpl = INDUSTRY_TEMPLATES[industry as IndustryId] ?? INDUSTRY_TEMPLATES.general
  const focusLines = tmpl.analysisFocus.map((f) => `  - ${f}`).join('\n')
  return `## 業界別分析観点（${tmpl.label}）
以下の観点を考慮してください。ただし、**レビュー本文に明確な根拠がない場合は推測しないでください**。
${focusLines}`
}

export function buildChunkAnalysisPrompt(reviews: ReviewForAnalysis[], industry = 'general'): string {
  const reviewText = reviews
    .map((r, i) => {
      const ratingLine = r.rating != null ? `rating: ${r.rating}` : 'rating: 不明'
      const sourceLine = r.source ? `source: ${r.source}` : null
      const meta = [ratingLine, sourceLine].filter(Boolean).join(' / ')
      return `[Review ${i + 1}]\n${meta}\nbody: ${r.body}`
    })
    .join('\n\n')

  return `あなたはECブランドのマーケティングディレクターです。
以下のカスタマーレビューを読み、売れる訴求・LP改善・広告改善のヒントを抽出してください。

## 絶対に守るべき分析ルール

### rating（星評価）の使い方
- rating は本文解釈の**補助情報**として使う（本文が最優先）
- rating が低い（1〜2）場合: 本文が短くても不満・期待外れ・不安の可能性を注意深く読み取り、complaints に分類しやすくする
- rating が高い（4〜5）場合: 本文が短くても評価ポイント・購入理由の可能性を丁寧に拾う
- rating と本文の印象が矛盾する場合は**本文を優先**し、summary や insight で「評価と本文にズレがある可能性」として言及する
- rating のない（不明）レビューは本文のみから判断する

### ラベルの付け方
- 「品質が良い」「使いやすい」などの抽象的なラベルは禁止
- 必ずレビュー本文の言葉に根ざした具体的なラベルを使う
- 悪い例: 「保湿力が高い」→ 良い例: 「1週間で肌のカサつきが消えた」
- 悪い例: 「コスパが良い」→ 良い例: 「百貨店ブランドと同じ効果でプチプラ」

### appeal_words の抽出ルール
- 単語だけでなく、広告・LPのヘッドラインやボディコピーとしてそのまま使える短いフレーズ（2〜8文字）を優先
- 「モチモチ」「肌なじみ」などの感覚表現、「朝の気分が上がる」などの感情フレーズを重視
- 競合製品との差別化になる独自表現を高スコアで評価する

### complaints の変換ルール
- 不満点は「商品改善ヒント」ではなく「購入者の不安を事前に払拭するためのFAQと訴求改善」に変換する
- faq_suggestion: 購入ページ・LP下部に掲載するQ&A形式の回答案（「Q: ○○ですか？ A: ○○です」形式）
- lp_counter_suggestion: LPのどのセクションで・どんなコンテンツを追加すれば不安を先回りして払拭できるか

### purchase_reasons の分析ルール
- surface_reason（表面的な理由）: 顧客が自分で言語化している購入理由（機能・価格・口コミなど）
- deep_psychology（深層心理）: 顧客が言語化していない本当の動機（不安解消・自己効力感・社会的承認・変化への期待など）
- 必ず両方を分けて書くこと。どちらか片方だけの場合は出力しないこと

${buildIndustryFocusSection(industry)}

## レビュー一覧
${reviewText}

## 出力形式
以下のJSON形式のみで回答してください。それ以外のテキストは一切出力しないでください。

\`\`\`json
{
  "rating_points": [
    {
      "label": "具体的な強みのラベル（顧客の言葉に根ざす・抽象的表現禁止）",
      "count": 該当レビュー数（整数）,
      "examples": ["顧客の原文から引用したフレーズ（そのまま広告に使えるもの優先）"],
      "copyworthy_phrases": ["そのまま広告・LPのヘッドライン・ボディコピーに使えるフレーズを2〜3個（顧客の原文から抽出）"]
    }
  ],
  "complaints": [
    {
      "label": "具体的な不満点のラベル（顧客の言葉に根ざす）",
      "count": 該当レビュー数（整数）,
      "examples": ["顧客の原文フレーズ"],
      "faq_suggestion": "Q: この不満に関する購入前の疑問 A: 購入者の不安を事前に払拭する具体的な回答（100字程度）",
      "lp_counter_suggestion": "LPの[ファーストビュー/ベネフィット/FAQ/お客様の声など]セクションで[具体的なコンテンツ]を追加することでこの不安を先回りして払拭できる"
    }
  ],
  "purchase_reasons": [
    {
      "label": "購買理由のラベル（具体的に）",
      "count": 該当レビュー数（整数）,
      "examples": ["顧客の原文フレーズ"],
      "surface_reason": "顧客が言語化している購入理由（機能・価格・推薦など、具体的に）",
      "deep_psychology": "顧客が言語化していない深層の動機（例:「乾燥肌への不安を解消したい」「若く見られたい」「忙しい中でも自分を大切にしている感覚が欲しい」など感情ベースで記述）"
    }
  ],
  "customer_types": [
    {
      "label": "具体的なペルソナ像（例: 敏感肌に悩む30代共働き女性）",
      "count": 推定人数（整数）,
      "description": "このタイプの具体的な状況・悩み・購入文脈（レビューから読み取れる情報を元に記述）",
      "ad_targeting_hint": "このペルソナへのSNS広告・検索広告でのターゲティング設定・訴求方向性・クリエイティブの方向性を具体的に"
    }
  ],
  "appeal_words": [
    {
      "word": "単語またはLP・広告に使える短いフレーズ（2〜8文字推奨）",
      "score": 0から100の整数（レビュー頻度×感情強度×広告転用可能性×独自性の総合評価）,
      "frequency": このチャンク内での出現回数（整数）,
      "context": "このワード・フレーズがどのような感情・文脈で使われているか（1〜2文）",
      "suggested_use": "LP・広告・SNSのどのポジション（ヘッドライン/ボディ/CTA/ハッシュタグ等）で使うと最も効果的か"
    }
  ],
  "summary": "このチャンクのレビューから読み取れるマーケティング上の主要な洞察（2〜3文。「〜が多い」という要約ではなく「マーケターが次に何をすべきか」の視点で書く）"
}
\`\`\`

注意事項:
- rating_points は最低3件・最大5件（1〜2件では不十分）
- complaints は最低2件・最大5件
- purchase_reasons は最低2件・最大5件（必ず surface_reason と deep_psychology を両方記述する。どちらか欠ける場合は省略する）
- customer_types は最低1件・最大3件
- appeal_words は最低5件・最大10件（単語と短フレーズを混ぜる）
- count はこのチャンク内での該当件数（推定で可・0は禁止）
- rating 1〜2 のレビューが多い場合は complaints を充実させること
- rating 4〜5 のレビューが多い場合は rating_points と copyworthy_phrases を充実させること
- すべて日本語で出力すること
- 「〜と思われます」「〜かもしれません」などの曖昧な表現を避け、断言する`
}

// ---------------------------------------------------------------------------
// 統合プロンプト (全チャンク結果 → 最終マーケティング分析)
// ---------------------------------------------------------------------------

export function buildSynthesisPrompt(
  productName: string,
  productDescription: string | null,
  chunkSummaries: string[],
  aggregated: {
    rating_points: RatingPoint[]
    complaints: Complaint[]
    purchase_reasons: PurchaseReason[]
    customer_types: CustomerType[]
    appeal_words: AppealWord[]
  },
  industry = 'general'
): string {
  const summaryText = chunkSummaries
    .map((s, i) => `[チャンク${i + 1}の洞察] ${s}`)
    .join('\n')

  const tmpl = INDUSTRY_TEMPLATES[industry as IndustryId] ?? INDUSTRY_TEMPLATES.general
  const useCaseLines = tmpl.marketingUseCases.map((u) => `  - ${u}`).join('\n')

  return `あなたはECブランドのCMO（最高マーケティング責任者）です。
以下の分析データをもとに、**次に取るべきマーケティング施策**を提案してください。

## 絶対に守るべき出力ルール

### marketing_insights の構成（必須）
各示唆は「観察 → 解釈 → 推奨アクション」の3段構造で記述する:
- insight（観察）: レビューデータから読み取れる客観的な事実・傾向
- rationale（解釈）: その事実がマーケティング上なぜ重要か・何を意味するか
- suggested_action（推奨アクション）: 具体的にどのLP要素・広告クリエイティブ・施策を変えるべきか（「LP の○○セクションを△△に変更する」レベルまで具体化）

### 全体のトーン
- 「〜と思われます」「〜かもしれません」などの曖昧な表現は禁止
- マーケティング責任者として断言する姿勢で書く
- 「分析結果の羅列」ではなく「クライアントへの提案書」として書く

## 業界・ユースケース（${tmpl.label}）
この分析の主なマーケティング活用場面:
${useCaseLines}
**注意: レビュー本文に根拠がない内容は推測しないこと。**

## 商品情報
商品名: ${productName}
${productDescription ? `補足: ${productDescription}` : ''}

## 各チャンクの主要な洞察
${summaryText}

## 集計済み分析データ（全レビューを統合したもの）

### 評価ポイント（強み）—— LP・広告の訴求軸候補
${JSON.stringify(aggregated.rating_points.slice(0, 5), null, 2)}

### 不満点 —— FAQ・訴求改善の優先課題
${JSON.stringify(aggregated.complaints.slice(0, 5), null, 2)}

### 購買理由 —— 深層心理に響く訴求の根拠
${JSON.stringify(aggregated.purchase_reasons.slice(0, 5), null, 2)}

### 顧客タイプ —— 広告ターゲティングの軸
${JSON.stringify(aggregated.customer_types.slice(0, 3), null, 2)}

### 上位訴求ワード —— コピーライティングの素材
${JSON.stringify(aggregated.appeal_words.slice(0, 10), null, 2)}

## 出力形式
以下のJSON形式のみで回答してください。それ以外のテキストは一切出力しないでください。

\`\`\`json
{
  "summary": "全レビューを通じて見えてきた最重要洞察（3〜5文。「レビューには○○が多い」という要約は禁止。「このブランドが今すぐやるべきことは○○だ。なぜなら○○だからだ。」というCMOとしての提言として書く）",
  "marketing_insights": [
    {
      "insight": "【観察】レビューデータから読み取れる客観的な事実・傾向（具体的な数値・割合を含めると良い）",
      "rationale": "【解釈】この事実がマーケティング上なぜ重要か・放置するとどうなるか・活用するとどうなるか",
      "priority": "high（今すぐ着手） / medium（次フェーズ） / low（中長期検討）",
      "suggested_action": "【推奨アクション】具体的な施策（例: 「LPのファーストビューのヘッドラインを『1週間で肌のカサつきが消えた』に変更する」「Instagram広告のクリエイティブに敏感肌30代女性をモデルにした before/after を追加する」）"
    }
  ],
  "lp_suggestions": [
    {
      "section": "LPのセクション名（例: ファーストビュー・ベネフィット・使い方・FAQ・お客様の声・比較表）",
      "headline": "このセクションの推奨ヘッドライン（顧客の原文フレーズを活かす・30文字以内）",
      "body": "このセクションの推奨ボディコピー（顧客の言葉・感情に寄せる・具体的に・100〜200字）",
      "evidence": "この提案の根拠となったレビューの傾向・具体的なフレーズ"
    }
  ],
  "ad_copy_suggestions": [
    {
      "platform": "媒体（Instagram / Meta / Google検索 / YouTube / LINE / TikTok のいずれか。重複禁止）",
      "headline": "広告ヘッドライン（顧客の言葉を活かす・媒体の文字数制限を意識する・30文字以内）",
      "body": "広告ボディコピー（顧客の感情・深層心理に寄せる・具体的な体験を想起させる・80〜150字）",
      "cta": "CTA文言（例: 今すぐ試す・初回限定で試してみる・詳しく見る・公式サイトへ）",
      "target_persona": "このコピーが最も刺さる顧客タイプ（具体的に：例「敏感肌で何度もコスメを試してきた30代女性」）"
    }
  ],
  "content_ideas": [
    {
      "format": "コンテンツ形式（Instagram投稿 / ブログ記事 / YouTube動画 / リール / メルマガ / TikTok のいずれか）",
      "title": "コンテンツタイトル案（読まれる・シェアされる具体的なタイトル）",
      "angle": "切り口・アングル（なぜ読まれるか・なぜシェアされるか・どの顧客の悩みを刺激するか）",
      "key_message": "このコンテンツが最終的に伝えるべきコアメッセージ（購買につながる1文）"
    }
  ],
  "demand_points": [
    {
      "label": "顧客が購買前に強く求めていた機能・属性の名称（例: 低刺激・無香料・速乾性）",
      "count": 0,
      "description": "このDemandPointの背景・文脈（例: どんな悩みを持つ顧客が何を期待して購入したか）",
      "evidence_examples": ["レビューから抽出した具体的な証拠フレーズ（1〜3個）"],
      "marketing_use": "LP・広告でのこのDemandPointの活用法（例: ファーストビューの訴求軸にする・仕様比較表に明示する）"
    }
  ],
  "occasion_insights": [
    {
      "occasion": "商品を思い出す・欲しくなる具体的な生活シーン（例: 朝の洗顔後・デート前夜・肌荒れがひどい週）",
      "trigger": "そのシーンを発生させる具体的なトリガー（例: 鏡で肌荒れを見た瞬間・友人の「最近肌きれいだね」の一言）",
      "customer_state": "シーン発生時の顧客の心理・感情状態（例: 焦り・期待・自信喪失・変化したい気持ち）",
      "recommended_message": "このシーンで最も刺さる訴求メッセージ（15〜30文字の広告ヘッドライン候補）",
      "evidence_examples": ["そのシーンを示唆するレビューフレーズ（1〜2個）"]
    }
  ],
  "avoid_appeals": [
    {
      "appeal": "避けるべき訴求の具体的な内容（例: 「翌日から効果実感」「敏感肌でも絶対大丈夫」）",
      "reason": "なぜこの訴求が逆効果か（レビューの証拠に基づく根拠）",
      "risk": "この訴求を使った場合の具体的なリスク（例: 期待値過多による返品増加・低評価レビュー集中）",
      "replacement_message": "代わりに使うべき正直で刺さる代替訴求（例: 「1週間後から変化を感じる人が多数」）"
    }
  ]
}
\`\`\`

注意事項:
- marketing_insights は3〜5件（priority: high を必ず1件以上含める）
- lp_suggestions は3〜5件（ファーストビューを必ず含める）
- ad_copy_suggestions は3〜5件（プラットフォームが重複しないこと）
- content_ideas は3〜5件（フォーマットが重複しないこと）
- demand_points は3〜5件（購買前の「これが欲しかった」ポイントを抽出すること）
- occasion_insights は3〜5件（実際の生活シーンに根ざした具体的な場面を抽出すること）
- avoid_appeals は2〜4件（誇張・誤解を招くと思われる訴求を必ず1件以上含めること）
- すべて日本語で出力すること`
}

// ---------------------------------------------------------------------------
// 競合比較プロンプト
// ---------------------------------------------------------------------------

export function buildComparisonPrompt(projects: ComparisonProject[]): string {
  const projectSections = projects
    .map((p, idx) => {
      const rp = p.rating_points.slice(0, 5).map((r, i) => `  ${i + 1}. ${r.label}（${r.count}件）`).join('\n')
      const cmp = p.complaints.slice(0, 5).map((c, i) => `  ${i + 1}. ${c.label}（${c.count}件）`).join('\n')
      const pr = p.purchase_reasons.slice(0, 4).map((r, i) =>
        `  ${i + 1}. ${r.label}（${r.count}件）— 表層: ${r.surface_reason || '—'} / 深層: ${r.deep_psychology || '—'}`
      ).join('\n')
      const ct = p.customer_types.slice(0, 3).map((c, i) => `  ${i + 1}. ${c.label}（${c.count}件）`).join('\n')
      const aw = p.appeal_words.slice(0, 10).map((w) => `${w.word}(${w.score})`).join('、')

      return `### プロジェクト${idx + 1}: 「${p.name}」
- 業界: ${p.industry}
- レビュー件数: ${p.review_count.toLocaleString()}件
- 主要評価ポイント:
${rp || '  （データなし）'}
- 主要不満点:
${cmp || '  （データなし）'}
- 購買理由:
${pr || '  （データなし）'}
- 顧客タイプ:
${ct || '  （データなし）'}
- 上位訴求ワード: ${aw || '（データなし）'}`
    })
    .join('\n\n')

  const projectNames = projects.map((p) => `「${p.name}」`).join('、')

  return `あなたはCMO（最高マーケティング責任者）兼マーケティング戦略コンサルタントです。
以下の ${projects.length} つのプロジェクト（${projectNames}）のレビュー分析データを比較し、**各プロジェクトの勝ち筋と改善点**を明確にしてください。

## 絶対に守るべき出力ルール

- 単なる並列比較・羅列は禁止。**差別化になる点**と**市場共通の課題**を明確に分ける
- 各プロジェクトの強み・弱みは「なぜそれが競合優位/劣位になるか」まで踏み込んで書く
- 推奨アクションは「LP の○○を変更する」レベルまで具体化する
- 「〜と思われます」「〜かもしれません」などの曖昧な表現は禁止
- すべて日本語で出力すること

## 分析データ

${projectSections}

## 出力形式
以下のJSON形式のみで回答してください。それ以外のテキストは一切出力しないでください。

\`\`\`json
{
  "comparison_summary": "全プロジェクトを俯瞰した比較総括（3〜5文。各プロジェクトの位置づけと市場における差別化ポイントを明確に述べる）",
  "winning_appeals": [
    {
      "project_name": "プロジェクト名（上記のプロジェクト名をそのまま使うこと）",
      "appeal": "このプロジェクトが他社より明確に勝っている訴求ポイント（具体的に）",
      "why_it_wins": "なぜこれが競合優位になるか（市場文脈・顧客心理を踏まえて）",
      "suggested_copy": "この訴求をLP・広告で打ち出す際の具体的なコピー案"
    }
  ],
  "strengths": [
    {
      "project_name": "プロジェクト名（全プロジェクト共通の場合は null）",
      "label": "強みのラベル",
      "is_unique": true,
      "description": "この強みの詳細（なぜこれが強みか）"
    }
  ],
  "weaknesses": [
    {
      "project_name": "プロジェクト名",
      "label": "弱みのラベル",
      "description": "この弱みの詳細（競合比較でどう不利か）",
      "improvement_suggestion": "具体的な改善案（LP・広告・商品面で何を変えるか）"
    }
  ],
  "shared_complaints": [
    {
      "label": "市場共通の不満のラベル",
      "description": "この不満が市場全体に存在する理由と、先に解決したブランドが得られる優位性",
      "affected_projects": ["プロジェクト名1", "プロジェクト名2"]
    }
  ],
  "recommended_actions": [
    {
      "project_name": "プロジェクト名（全プロジェクト向けは null）",
      "priority": "high / medium / low",
      "action": "具体的なアクション（LP変更・広告改善・訴求追加など）",
      "rationale": "なぜこのアクションが優先度高いか（比較分析から見えた根拠）"
    }
  ]
}
\`\`\`

注意事項:
- winning_appeals はプロジェクト数と同じ件数（各プロジェクトに1件以上）
- strengths は合計3〜8件（is_unique: true と false を混在させる）
- weaknesses は合計2〜6件
- shared_complaints は0〜3件（共通不満がなければ空配列）
- recommended_actions は合計3〜6件（priority: high を必ず1件以上含める）
- project_name はデータに記載されているプロジェクト名を一字一句変えずに使うこと`
}

// ---------------------------------------------------------------------------
// JSON レスポンスパーサー
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  // ```json ... ``` ブロックを抽出
  const match = text.match(/```json\s*([\s\S]*?)\s*```/)
  if (match) return match[1]
  // フォールバック: { から始まる部分を抽出
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) return text.slice(start, end + 1)
  return text
}

export function parseChunkAnalysisResponse(text: string): ChunkAnalysisResult {
  const json = extractJson(text)
  const parsed = JSON.parse(json)
  return parsed as ChunkAnalysisResult
}

export function parseSynthesisResponse(
  text: string,
  aggregated: {
    rating_points: RatingPoint[]
    complaints: Complaint[]
    purchase_reasons: PurchaseReason[]
    customer_types: CustomerType[]
    appeal_words: AppealWord[]
  }
): Omit<
  ProjectAnalysisResult,
  'rating_points' | 'complaints' | 'purchase_reasons' | 'customer_types' | 'appeal_words' | 'future_axes'
> & {
  marketing_insights: MarketingInsight[]
  lp_suggestions: LpSuggestion[]
  ad_copy_suggestions: AdCopySuggestion[]
  content_ideas: ContentIdea[]
  demand_points: DemandPoint[]
  occasion_insights: OccasionInsight[]
  avoid_appeals: AvoidAppeal[]
} {
  const json = extractJson(text)
  const parsed = JSON.parse(json)
  return {
    summary: parsed.summary ?? '',
    marketing_insights: parsed.marketing_insights ?? [],
    lp_suggestions: parsed.lp_suggestions ?? [],
    ad_copy_suggestions: parsed.ad_copy_suggestions ?? [],
    content_ideas: parsed.content_ideas ?? [],
    demand_points: parsed.demand_points ?? [],
    occasion_insights: parsed.occasion_insights ?? [],
    avoid_appeals: parsed.avoid_appeals ?? [],
  }
}
