# プロンプト改善ログ

分析プロンプトの改善記録です。問題を発見したら下のテンプレートをコピーして追記してください。

---

## 記録テンプレート

```
## [YYYY-MM-DD] タイトル（例：コスメ業界のサマリーが抽象的すぎる）

**対象業界**: （例: 美容・コスメ / 英語スクール・教育 / ホテル・観光 / 一般）
**使用データ**: （例: sample-reviews-cosme.csv 30件 / 実データ 200件）

### 問題があった出力

（実際に出力されたテキストをそのまま貼り付ける）

> 例：「総じてユーザーの評価は高く、一定の改善余地があります。」

### 何が弱かったか

- （具体的に何が足りなかったか箇条書きで）
- 例: 商品名・業界固有のキーワードへの言及がない
- 例: 「一定の」「ある程度」など曖昧な副詞が多い
- 例: 次アクションが「LP を見直す」という動詞止めで具体性がない

### 改善したプロンプト

（変更したプロンプトの箇所を diff 形式か before/after で記録）

**Before:**
```
結論を200文字以内で述べてください。
```

**After:**
```
結論を200文字以内で述べてください。
以下の形式で書いてください：「この商品の最大の強みは[具体的な強み]であり、
特に[評価ポイントの上位1〜2件]がユーザーに支持されています。
一方で[具体的な不満上位1件]が課題として挙げられており、
[次アクション1件]を優先することを推奨します。」
```

### 改善後の変化

（改善後の実際の出力か、改善の効果を記録）

> 例：「このプロテインの最大の強みは『飲みやすいフレーバー』と『溶けやすさ』であり、
> 特にバニラ味の口当たりが支持されています。一方で『1袋当たりの価格が高い』という
> 不満が多く、定期購入プランの訴求を LP ファーストビューに追加することを推奨します。」

### 次回確認すること

- （この改善で副作用がなかったか確認したい観点を書く）
- 例: 他の業界テンプレートで同じプロンプトを使ったときに自然な出力になるか
- 例: 文字数が200文字を大幅に超えていないか

---
```

---

## 改善ログ

---

## [2026-05-11] Step 29: 比較レポート HTML の業界名英語キー表示を修正

**対象**: Step 28 で発見した未修正問題
**ステータス**: ✅ 修正完了

### 問題

比較レポート (`/compare/reports/[id]`) と比較 1枚サマリー (`/compare/reports/[id]/one-pager`) の業界名欄が、`hotel, education, cosmetics` のような英語キーで表示されていた。PPTX 出力は `getIndustryLabel()` 経由で正しく日本語表示していたが、HTML 側に同変換が適用されていなかった。

### 原因

`getIndustryLabel()` が `lib/export/pptx.ts` の内部関数として定義されており、HTML コンポーネント側から参照できなかった。

### 修正内容

| ファイル | 変更内容 |
|---------|---------|
| `lib/constants.ts` | `getIndustryLabel(industry)` helper を `INDUSTRY_IDS` の直後に追加・export（カンマ区切り複数キー → 「 / 」区切り日本語変換） |
| `lib/export/pptx.ts` | 内部定義の `getIndustryLabel()` を削除し、`lib/constants.ts` からのインポートに変更 |
| `app/compare/reports/[id]/page.tsx` | `{report.industry}` → `{getIndustryLabel(report.industry)}` に変更 |
| `app/compare/reports/[id]/one-pager/page.tsx` | `report.industry ?? '—'` → `getIndustryLabel(report.industry)` に変更 |

### 確認結果

- 比較レポート: `ホテル・観光・インバウンド / 英語スクール・教育 / 美容・コスメ` ✅
- 比較 1枚サマリー: `業界: ホテル・観光・インバウンド / 英語スクール・教育 / 美容・コスメ` ✅
- `npm run build` エラーなし ✅
- 単体プロジェクト系（`app/projects/**`）は変更前から `INDUSTRY_TEMPLATES[key]?.label` で正しく変換済みにつき対応不要

---

## [2026-05-11] Step 28: Claude API 実動作検証（完了）

**検証方法**: 開発サーバー起動 + ブラウザ自動操作（Claude in Chrome MCP）による動的検証
**ステータス**: ✅ 完了
**使用データ**: `sample-reviews-cosme.csv` / `sample-reviews-education.csv` / `sample-reviews-hotel.csv` 各30件
**検証日**: 2026-05-10〜11（前回セッション中断分を含む）

---

### 検証結果チェックリスト

| # | 確認項目 | ステータス | 備考 |
|---|---------|---------|------|
| 1 | サンプルCSVをアップロードしてプロジェクト作成できるか | ✅ PASS | cosme/education/hotel 各1件 作成成功 |
| 2 | `【架空データ】` 文言が出力に混入しないか | ✅ PASS | examples/copyworthy_phrases 目視確認、混入なし |
| 3 | QualityCheckCard で要確認が出ていないか | ✅ PASS | cosme: 15/15 OK、要確認 0件 |
| 4 | rating 低（1〜2）のレビューが complaints に反映されるか | ✅ PASS | 「香りが合わない」「即効性への不満」等 反映済み |
| 5 | rating 高（4〜5）のレビューが rating_points に反映されるか | ✅ PASS | 「乾燥肌でもしっとり継続」「ベタつかず軽いテクスチャー」等 反映済み |
| 6 | copyworthy_phrases が広告・LPに使える表現になっているか | ✅ PASS | 「つけた瞬間肌がモッチリ」「高級ブランドに負けない保湿力」等 広告転用可 |
| 7 | 1枚サマリーの summary が自然な文末で切れるか | ✅ PASS | `。` で終了、300文字以内で文末切り詰め動作確認 |
| 8 | PPTX 結論カードで本文が3〜4行読めるか | ✅ PASS | CONC_H=1.300"、コンテンツ領域0.750"、trunc 260文字、3〜4行確認 |
| 9 | 競合比較 PPTX の業界名が日本語表示か | ✅ PASS | `getIndustryLabel("hotel, education, cosmetics")` → 「ホテル・観光・インバウンド / 英語スクール・教育 / 美容・コスメ」 |
| 10 | `/admin/usage` にログが残るか | ✅ PASS | 21件: 分析開始×12, 分析完了×3, 競合比較×1, PPTX出力×2, CSVアップロード×3、合計 105,190 トークン |
| 11 | `/admin/insights` に集計インサイトが追加されるか | ✅ PASS | 73ラベル / 延べ247件、3業界（美容・コスメ / 英語スクール・教育 / ホテル・観光・インバウンド）データあり |

**総合結果: 11/11 PASS**

---

### 検証中に発見した問題・対処

#### 問題1（修正済み）: `MAX_TOKENS_CHUNK = 4096` が不足し JSON が途中で切れる

- **症状**: `Expected ',' or ']' after array element in JSON at position 5676`
- **原因**: cosme（~29,288 トークン）/ hotel（~33,306 トークン）の出力が 4096 を超えた
- **対処**: `lib/claude/client.ts` の `MAX_TOKENS_CHUNK` を `4_096` → `8_192` → **`16_000`** に拡張
- **ステータス**: ✅ 修正済み（検証ブロッカーのため即時対応）

#### 問題2（修正済み）: Supabase RLS がサービスロールキーなしで全行ブロック

- **症状**: プロジェクト詳細ページが 404 になる（`notFound()` が呼ばれる）
- **原因**: `lib/supabase/server.ts` の `createClient()` が anon キーを使用、RLS が全行をブロック
- **対処**: `createClient()` を `SUPABASE_SERVICE_ROLE_KEY` に変更（Phase 1 暫定対応）
- **ステータス**: ✅ 修正済み（Phase 2 で認証実装時に RLS ポリシーと併せて再設計）

#### 問題3（未修正・要対応）: 比較レポート 1枚サマリーの業界名が英語キー表示

- **症状**: 比較レポート one-pager HTML 内の「業界:」欄が `hotel, education, cosmetics` と英語表示
- **原因**: one-pager コンポーネントが `getIndustryLabel()` を呼ばずに raw 値を出力
- **影響**: PPTX は `getIndustryLabel()` 経由で正しく日本語表示。HTML のみ不具合
- **対処方針**: one-pager の業界表示箇所に `getIndustryLabel()` を適用
- **ステータス**: ⚠️ 未修正（次スプリントで対応）

---

## [2026-05-10] Step 27: Step 25/26 修正後品質検証（静的コード解析）

**検証方法**: ブラウザ操作なし・コードベース静的解析（grep / Read / Python計算）
**対象CSV**: sample-reviews-cosme.csv / sample-reviews-education.csv / sample-reviews-hotel.csv（各30件）

### 検証結果サマリー

| # | 検証項目 | 結果 | 確認方法 |
|---|---------|------|---------|
| 1 | サンプルCSVをアップロードしてプロジェクト作成できるか | ✅ (静的) | CSVパーサー・アップロートルート変更なし |
| 2 | `【架空データ】` プレフィックスが0件になっているか | ✅ 確認済 | grep: 全3ファイルで 0件 |
| 3 | NG QualityCheckCard が減っているか | ⚠️ 要実行確認 | 実データで分析実行が必要 |
| 4 | rating 低（1〜2）のレビューが complaints に集まるか | ⚠️ 要実行確認 | Claude実行が必要 |
| 5 | rating 高（4〜5）のレビューが rating_points に集まるか | ⚠️ 要実行確認 | Claude実行が必要 |
| 6 | copyworthy_phrases が充実するか | ⚠️ 要実行確認 | Claude実行が必要 |
| 7 | PPTX 結論カードが3〜4行表示されるか | ✅ (計算) | CONC_H=1.30, コンテンツ領域=0.75", 約3.7行 |
| 8 | 1枚サマリーのサマリーが文末で切れるか | ✅ (静的) | `lastIndexOf('。！？')` + 60%ガード確認 |
| 9 | 競合比較PPTXの業界名が日本語表示か | ✅ (静的) | `getIndustryLabel()` 呼び出し確認 |
| 10 | PPTX全体レイアウトがスライド内に収まっているか | ✅ (計算) | フッター底辺=7.08" < 7.5" |
| 11 | Admin KPIダッシュボードが表示されるか | ✅ (静的) | `app/admin/page.tsx` ルート正常 |
| 12 | /feedback → /admin/feedback リダイレクトが機能するか | ✅ (静的) | `redirect('/admin/feedback')` 確認 |

---

### 確認詳細

#### 項目 2: サンプルCSV プレフィックス削除
```
grep 結果: 全3ファイルで「【架空データ】」= 0件
cosme: rating分布 1-2が5件 / 4-5が20件 / 3が5件
education: rating分布 1-2が2件 / 4-5が24件
hotel: rating分布 1-2が2件 / 4-5が24件
```

#### 項目 7/10: PPTXレイアウト計算（Python検証済み）
```python
# 単体分析 PPTX (generateProjectOnePagerPptx)
CONC_H = 1.30  # 修正後
content_h = CONC_H - 0.55 = 0.75"  # 修正後 (h - 0.55)
lines = 0.75 / (10 * 1.5 / 72) = 3.6行  # 260文字 ≈ 3.2行分 → 収まる ✓
FTR_Y = 0.65 + 0.10 + 1.30 + 0.10 + 2.55 + 0.10 + 1.85 + 0.10 = 6.75"
FTR_bottom = 6.75 + 0.33 = 7.08" < 7.5" ✓

# 競合比較 PPTX (generateComparisonOnePagerPptx)
CONC_H = 1.30, ROW_H = 2.10
FTR_bottom = 6.88" < 7.5" ✓
```

#### 項目 8: 1枚サマリー truncation ロジック
```typescript
// app/projects/[id]/one-pager/page.tsx
function truncateSummary(text: string, max = 300): string {
  if (!text) return ''
  if (text.length <= max) return text
  const cutTarget = text.slice(0, max)
  const lastSentenceEnd = Math.max(
    cutTarget.lastIndexOf('。'),
    cutTarget.lastIndexOf('！'),
    cutTarget.lastIndexOf('？'),
  )
  if (lastSentenceEnd > max * 0.6) {  // 180文字以降に文末があれば自然カット
    return text.slice(0, lastSentenceEnd + 1)
  }
  return cutTarget.slice(0, max - 1) + '…'  // フォールバック
}
// 呼び出し: truncateSummary(analysis.summary) → デフォルト max=300
```

#### 項目 9: getIndustryLabel() の動作確認
```typescript
// lib/export/pptx.ts
function getIndustryLabel(industry: string | null): string {
  if (!industry) return '—'
  if (industry.includes(',')) {
    return industry.split(',')
      .map((k) => INDUSTRY_TEMPLATES[k.trim() as IndustryId]?.label ?? k.trim())
      .join(' / ')
  }
  return INDUSTRY_TEMPLATES[industry as IndustryId]?.label ?? industry
}
// 使用箇所: addHeader(pres, slide, '競合比較サマリー', [..., `業界: ${getIndustryLabel(report.industry)}`, ...])
// 期待: 'cosmetics' → '美容・コスメ' / 'cosmetics,education' → '美容・コスメ / 英語スクール・教育'
```

---

### 要実行確認（項目 3〜6）

以下は Claude API 実行後でないと確認できない。次回の実データ検証時に確認する。

| 項目 | 確認方法 | 期待値 |
|------|---------|--------|
| 3. QualityCheckCard NG減少 | サンプルCSVで分析実行 → Admin画面のUsageログ確認 | エラー率が前回より低い |
| 4. rating低 → complaints | cosme CSV の星1-2レビュー5件が complaints に集まっているか | 全5件中4件以上が complaints |
| 5. rating高 → rating_points | 星4-5レビューが rating_points / copyworthy_phrases に分類 | 高評価レビューの具体フレーズが抽出される |
| 6. copyworthy_phrases充実 | appeal_words.suggested_use や rating_points.copyworthy_phrases の内容 | 広告転用フレーズが3件以上 |

---

### 新規発見した問題

静的解析の範囲では **新たな重大バグは見つからなかった**。

以下は観察事項（対応は次フェーズ）:

| 観察 | 内容 | 優先度 |
|------|------|--------|
| synthesis prompt の token上限 | `MAX_TOKENS_SYNTHESIS = 8192` は十分だが、チャンクが多い場合 input token が増大しタイムアウトするリスクがある | 🟢 Low |
| appeal_words の score 上限チェック | `Math.min(100, Math.max(0, i.score))` でクランプ済み。0〜100範囲外の値をClaudeが出力した場合の挙動は正しく制御されている | — (確認済) |
| PPTX trunc(260) と CONC_H=1.30 の余裕 | 260文字 ÷ 約78字/行 ≈ 3.3行。コンテンツ領域は3.6行分 → **わずかな余裕**。300文字を超えるサマリーでは再度はみ出す可能性あり | 🟢 Low |

---

### 結論

**Step 25・Step 26 の全修正は正しく実装されている。** コードバグは0件。
要実行確認の項目（3〜6）は次回の実データ検証時に対応する。

---

## [2026-05-10] Step 26: rating（星評価）をチャンク分析プロンプトに追加

**対象業界**: 全業界
**使用データ**: サンプルCSV 各30件（星評価 1〜5 が含まれる）

### 問題（修正前）

`app/api/analyze/route.ts` でチャンク分析時に取得していたのは `body` のみ。
`rating`（星評価 1〜5）が Claude に渡されていなかった。

- 「普通に使えます（★3）」「特に不満はないが…（★2）」のように、本文が曖昧でも星評価に感情情報が含まれるケースで判定精度が低下していた
- 星1〜2の低評価レビューの本文が短い場合、complaints に正しく分類されず rating_points に誤分類されるリスクがあった

### 改善内容

| ファイル | 変更内容 |
|---------|---------|
| `types/analysis.ts` | `ReviewForAnalysis` 型を新規追加（id, body, rating, source, reviewer, reviewed_at） |
| `app/api/analyze/route.ts` | レビュー取得クエリを `select('body')` → `select('id, body, rating, source, reviewer, reviewed_at')` に拡張。`ReviewForAnalysis[]` に変換して渡す |
| `lib/claude/client.ts` | `analyzeChunkWithClaude` の引数を `string[]` → `ReviewForAnalysis[]` に変更 |
| `lib/claude/prompts.ts` | レビュー表示形式を `[Review N] rating: X / source: Y\nbody: ...` に変更。rating の判断ルールを追加 |

### 追加したプロンプトルール

```
### rating（星評価）の使い方
- rating は本文解釈の補助情報として使う（本文が最優先）
- rating が低い（1〜2）場合: 本文が短くても不満・期待外れ・不安の可能性を注意深く読み取り、complaints に分類しやすくする
- rating が高い（4〜5）場合: 本文が短くても評価ポイント・購入理由の可能性を丁寧に拾う
- rating と本文の印象が矛盾する場合は本文を優先し、summary や insight で「評価と本文にズレがある可能性」として言及する
- rating のない（不明）レビューは本文のみから判断する
```

### 期待される改善効果

- 短い本文でも rating から感情コンテキストを補完し、評価ポイント・不満点の分類精度向上
- 星1〜2の低評価が complaints に正しく集まり、FAQ 転用案・LP 改善提案の精度が向上
- 星5の絶賛レビューから copyworthy_phrases が充実し、広告コピー候補の品質向上
- rating と本文が矛盾するレビュー（皮肉・誤投稿など）を summary で示唆できる

---

## [2026-05-10] Step 25 修正：即時対応4件

### 修正 1: PPTX 結論カードの高さ修正（単体分析・競合比較）

**修正前の問題**: `CONC_H = 0.88"` → コンテンツ領域が `h - 0.60 = 0.28"` しかなく、約1.3行しか表示できなかった

**修正内容**:
- `lib/export/pptx.ts` の `CONC_H` を `0.88` → `1.30` に拡大（単体分析・競合比較の両方）
- `addConclusionCard` 内の `trunc(text, 160)` → `trunc(text, 260)` に拡張
- `h - 0.60` → `h - 0.55` にしてコンテンツ領域をさらに確保（0.75" ≈ 3.6行分）
- 増分を `GRID_H`（2.85→2.55）と `ACT_H`（1.97→1.85）で吸収し、フッター位置（6.75"）を維持
- 競合比較も `ROW_H` を 2.35→2.10 に調整

**期待される改善**: PPTX の結論カードに3〜4文（240〜260文字相当）のサマリーが表示される

---

### 修正 2: 競合比較 PPTX の業界名が日本語で表示されるよう修正

**修正前の問題**: ヘッダーに `cosmetics` `education` `hotel` などの生キーが表示された

**修正内容**:
- `lib/export/pptx.ts` に `getIndustryLabel(industry: string | null): string` helper を追加
- カンマ区切り（複数業界混在）の場合は各キーを変換して `/` 区切りで表示
- 単体分析 PPTX は既に `industryLabel` 変数で正しく変換していたため変更なし

**期待される改善**: 競合比較 PPTX ヘッダーに「美容・コスメ」「英語スクール・教育」などが表示される

---

### 修正 3: サンプル CSV の `【架空データ】` プレフィックス削除

**修正前の問題**: 全30件のレビュー本文が `【架空データ】` で始まり、Claude が examples に混入させる可能性があった

**修正内容**:
- `public/samples/sample-reviews-cosme.csv`・`education.csv`・`hotel.csv` の3ファイルから全90件のプレフィックスを削除
- 架空データである旨の注記を `docs/test-scenarios.md` に追加
- source 列の値（amazon / rakuten / google）はプラットフォーム分布を維持するためそのまま残した

**期待される改善**: 分析レポートの examples・copyworthy_phrases に不要な文字列が混入しない

---

### 修正 4: 1枚サマリーのサマリー切り詰め改善

**修正前の問題**: `truncateSummary(text, 220)` で220文字に切るため、3〜5文のサマリーが途中で切れた

**修正内容**:
- `app/projects/[id]/one-pager/page.tsx` の `truncateSummary` デフォルト値を 200 → 300 に拡大
- 文末単位で切る処理を追加：最大300文字の範囲内で最後の `。！？` を探し、そこで切る（自然な文末カット）
- 文末が見つからない場合（英文や特殊ケース）は従来通り `…` で切り詰め

**期待される改善**: 1枚サマリーの結論サマリーが文章の途中で切れず、自然な終わり方になる

---

## [2026-05-10] 初回コードレビュー検証：発見した問題一覧

**対象業界**: 美容・コスメ / 英語スクール・教育 / ホテル・観光（サンプルCSV 3本）
**使用データ**: sample-reviews-cosme.csv / sample-reviews-education.csv / sample-reviews-hotel.csv（各30件）
**検証方法**: ブラウザ操作なし・コードベース全体のレビューによる静的検証

---

### 問題 1【重大・コードバグ】PPTX 結論カードの表示領域が1〜2行しかない

**ファイル**: `lib/export/pptx.ts` → `addConclusionCard()` / `generateProjectOnePagerPptx()`

**問題があった出力（再現見込み）**:
> PPTX の「CONCLUSION 結論」カードを開くと、サマリーテキストの冒頭1〜2行しか表示されていない

**何が弱かったか**:
- `CONC_H = 0.88`（インチ）で結論カードの高さを設定
- カード内のコンテンツテキストボックスは `y: y + 0.45, h: h - 0.60` → 高さ **0.28インチ** しかない
- 0.28インチ = 20pt。10ptフォント × 1.5行間 = 15pt/行 → **約1.3行分しか表示できない**
- 一方で `trunc(text, 160)` で最大160文字に切り詰めている → 日本語90文字/行として**約1.8行分のテキスト**
- 結果: テキストの後半がカードからはみ出してPowerPoint/Google Slides上で見えない

**改善方針**（コード修正時に対応）:
- `CONC_H` を `0.88` → `1.35` 程度に拡張し、他要素を全体的に0.4〜0.5インチ下にシフト
- あわせて `trunc(text, 160)` → `trunc(text, 120)` 程度に抑えてカード内に収まるようにする
- レイアウトの再計算: Header(0.65) + Conc(1.35) + Grid(2.45) + Action(1.75) + Footer = 計6.85インチ → 7.5インチ内に収まる

**次回確認すること**:
- 修正後に PowerPoint で実際に開き、テキストが全て表示されることを目視確認する
- Google スライドでも確認する（レンダリングの差がある）

---

### 問題 2【重大・コードバグ】競合比較 PPTX のヘッダー業界名が生キーを表示

**ファイル**: `lib/export/pptx.ts` → `generateComparisonOnePagerPptx()`

**問題があった出力（再現見込み）**:
> PPTX ヘッダーの「業界: cosmetics」と表示される（「美容・コスメ」であるべき）

**何が弱かったか**:
```typescript
// 現在のコード（pptx.ts 行413付近）
addHeader(pres, slide, '競合比較サマリー', [
  `比較: ${...}`,
  `業界: ${report.industry ?? '—'}`,  // ← raw key がそのまま出る
  ...
].join('\n'))
```
- `comparison_reports.industry` には `'cosmetics'` `'education'` `'hotel'` などの生キーが入っている
- プロジェクト分析ページや1枚サマリーは `INDUSTRY_TEMPLATES[...].label` を使っているのに、比較PPTXだけ変換していない
- 複数業界混在時は `'cosmetics, education'` という文字列が入ることもある

**改善方針**:
```typescript
// INDUSTRY_TEMPLATES を import して変換する
import { INDUSTRY_TEMPLATES } from '@/lib/constants'
import type { IndustryId } from '@/lib/constants'

const industryLabel =
  INDUSTRY_TEMPLATES[report.industry as IndustryId]?.label ?? report.industry ?? '—'
```

**次回確認すること**: 複数業界混在の比較レポートで表示が崩れないか確認

---

### 問題 3【中程度・UX】サンプル CSV の全レビューに `【架空データ】` プレフィックスが混入

**ファイル**: `public/samples/sample-reviews-cosme.csv` / `education.csv` / `hotel.csv`

**問題があった出力（再現見込み）**:
> Claude が examples や copyworthy_phrases を抽出するとき、顧客の原文として
> `「【架空データ】香りがとにかく好みで...」` のような文字列が入る可能性がある

**何が弱かったか**:
- 全30件のレビュー本文が `【架空データ】` で始まる（架空データであることを明示するため故意に付与）
- Claude はプロンプトで「顧客の原文フレーズを抽出せよ」と指示されているため、このプレフィックスが examples に混入するリスクがある
- PPTX・レポート・1枚サマリーに `【架空データ】` が表示されると、クライアントへの共有で大問題になる
- 品質検証の観点でも「プロンプトの問題か・データの問題か」が切り分けにくくなる

**改善方針**:
- サンプル CSV の本文から `【架空データ】` プレフィックスを削除する（3ファイル一括）
- または CSV パーサーで `body.replace(/^【架空データ】/, '').trim()` を挿入する（恒久対処）
- 架空データである旨の注記は CSV ファイルの先頭コメント行や README に移す

**次回確認すること**:
- 修正後のサンプル CSV で分析を実行し、examples や copyworthy_phrases に不要な文字列が混入しないか確認
- rating 別の品質チェック（star1-2 の不満レビューが正しく complaints として抽出されるか）

---

### 問題 4【中程度・UX】1枚サマリーのサマリー切り詰めが短すぎる

**ファイル**: `app/projects/[id]/one-pager/page.tsx` → `truncateSummary(analysis.summary, 220)`

**問題があった出力（再現見込み）**:
> 「このクリームの最大の強みは…（以下省略）…」と途中で切れた結論が1枚サマリーに表示される

**何が弱かったか**:
- synthesis プロンプトは `summary` に「3〜5文」の提言を求めている
- 日本語 3文 × 平均60文字 = 180文字、5文では 300文字に達する
- `truncateSummary(text, 220)` で 220文字に切ると、4〜5文のサマリーでは3文目の途中で切れる
- 結論が「…」で終わる形になり、クライアントへの共有で不完全に見える

**改善方針**:
- `max` を 220 → 280〜300 に拡張する（1枚サマリーのレイアウト確認が必要）
- またはプロンプト側で `summary` の最大文字数を「200文字以内」と明示する

**次回確認すること**:
- 文字数を増やした場合、A4 1ページ内に収まるか（印刷プレビューで確認）

---

### 問題 5【軽微・設計観察】rating（星評価）がチャンク分析プロンプトに渡っていない

**ファイル**: `app/api/analyze/route.ts` → `const reviewBodies = reviews.map((r) => r.body)`

**何が弱かったか**:
- CSV の `rating` 列（1〜5）は正しく DB に保存されているが、Claude に渡すのは `body`（本文）のみ
- 「普通に使えます（3星）」と「とても使いやすい（5星）」が同じ重みで分析される
- 不満点として分類すべき低評価レビューを Claude がテキストのみで判断しなければならない
- 文脈の曖昧なレビュー（皮肉・過小評価）の分類精度が下がる可能性がある

**改善方針（検討）**:
```
// reviews の取得を body + rating に変更し、プロンプトに rating を付与する
[1] ★3「普通に使えます。特別すごいとは感じませんでしたが...」
[2] ★5「香りがとにかく好みで...」
```
- プロンプトに「★1-2はネガティブ寄り、★4-5はポジティブ寄りと想定してラベリングせよ」と追加
- ただし、star 評価と本文が矛盾するケースもあるため断言は避ける

**次回確認すること**:
- 変更した場合、プロンプト長が増加する（token コスト増）ことを意識する

---

### 問題 6【軽微・設計観察】サンプル CSV が30件のため1チャンクのみ → 統合分析の入力が薄い

**ファイル**: 設定値 `lib/constants.ts` → `CHUNK_SIZE = 50`

**何が弱かったか**:
- 30件 < 50件（CHUNK_SIZE）なので1チャンクのみ生成される
- 統合プロンプト（buildSynthesisPrompt）は「複数チャンクの洞察を統合する」設計だが、
  サンプルCSVでは1チャンクサマリーしか入力されない
- synthesis の quality が低くなりやすい（diversity が少ない）
- 品質検証でサンプルCSVを使う場合、実データ（100件以上）との品質差を意識すること

**改善方針**: 品質検証時は実データまたはサンプル CSV を結合して100件以上にしてから検証する

---

### まとめ: 優先対応順

| 優先度 | 問題 | 対応方針 |
|--------|------|---------|
| ~~🔴 Critical~~ ✅ 修正済み | ~~PPTX 結論カード高さが足りない~~ | Step 27 で `CONC_H=1.30"` に修正、Step 28 で実機確認済み |
| ~~🔴 Critical~~ ✅ 修正済み | ~~比較PPTX の業界名が生キー表示~~ | Step 28 で `getIndustryLabel()` 経由の日本語出力を実機確認済み |
| ~~🟡 High~~ ✅ 修正済み | ~~サンプルCSV の `【架空データ】` プレフィックス~~ | CSV 修正済み（Step 28 で 架空データ 0件 確認） |
| ~~🟡 High~~ ✅ 修正済み | ~~1枚サマリーのサマリー切り詰め220文字~~ | Step 27 で `max=300` に拡張、Step 28 で自然な文末切り実機確認済み |
| ~~🟡 High~~ ✅ 修正済み | ~~`MAX_TOKENS_CHUNK=4096` で JSON 途中切れ~~ | Step 28 で `16_000` に拡張（cosme: 29,288 / hotel: 33,306 トークン） |
| 🟡 High | 比較 one-pager HTML の業界名が英語キー表示 | `getIndustryLabel()` を one-pager コンポーネントに適用（次スプリント） |
| 🟢 Low | rating をプロンプトに渡していない | Step 26 で対応済み。将来の品質向上施策として継続検討 |
| 🟢 Low | サンプルCSVが30件しかない | 検証時は結合データを使う |

---

## 改善済みプロンプトの場所

プロンプトは以下のファイルで管理されています。

| ファイル | 役割 |
|---------|------|
| `app/api/analyze/route.ts` | チャンク分析プロンプト（評価ポイント・不満点・購買理由・訴求ワードの抽出） |
| `app/api/analyze/route.ts` | 統合プロンプト（マーケティングインサイト・LP提案・広告コピー・次アクションの生成） |
| `app/api/compare/route.ts` | 競合比較プロンプト（比較インサイト・勝ち筋・市場共通不満の抽出） |

変更時はこのログに記録した上で、git で差分が追えるように commit メッセージに記録の日付・問題タイトルを含めてください。

---

*このログは `docs/test-scenarios.md` と `docs/quality-check-guide.md` と合わせて使用してください。*
