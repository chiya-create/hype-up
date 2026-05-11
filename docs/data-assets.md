# Hype Up AI データ資産化方針

作成日: 2026-05-11

---

## 1. 目的

Hype Up AI は「顧客の声」を AI で分析し、マーケティング施策に変換するサービスである。
同時に、複数クライアントのデータを処理する中で**業界横断の匿名化インサイト**を蓄積し、
将来的に業界レポート・提案資料・ホワイトペーパー等のコンテンツ資産として活用する設計とする。

---

## 2. データ資産の分類

| 分類 | テーブル | 説明 | 外部利用可否 |
|------|---------|------|------------|
| 顧客レビュー原文 | `reviews` | 各クライアントがアップロードした原文 | ✗ 不可（個社データ） |
| 分析結果 | `project_analyses` | 各クライアントの分析 JSON | ✗ 不可（個社データ） |
| 匿名化集計インサイト | `aggregated_insights` | 業界別に匿名化・集計したラベル | ◎ 可（匿名化済み） |
| 利用ログ | `usage_logs` | API 呼び出し・エクスポート記録 | ✗ 不可（運用データ） |

---

## 3. 匿名化された顧客の声の保存方針

### 3-1. 保存してよい内容

`aggregated_insights` テーブルに蓄積するデータは以下の基準を満たすこと。

- **ラベル（`label`）**: 「配送が遅い」「香りが良い」「コスパが良い」等の短い分類ラベル
- **インサイトタイプ（`insight_type`）**: `rating_point` / `complaint` / `purchase_reason` / `appeal_word`
- **業界（`industry`）**: `general` / `beauty` / `food` 等の業界分類
- **件数（`count`）**: そのラベルが何件のプロジェクトで出現したか（個社件数ではなく業界横断件数）
- **匿名化例文（`examples_anonymized`）**: **80文字以内**の短い例文。商品名・会社名・固有名詞を含まない

### 3-2. 保存してはいけない内容

- レビュー原文そのもの（長文・文脈情報を含むもの）
- 商品名・ブランド名・会社名が特定できるデータ
- 個人を特定できる情報（ニックネーム・投稿日時の粒度が高いもの等）
- 80文字を超える文脈のある文章

### 3-3. aggregated_insights のスキーマ方針

```sql
-- 現在のスキーマ（005_add_multitenancy.sql 以降）
aggregated_insights (
  id               UUID PRIMARY KEY,
  industry         TEXT,          -- 業界分類
  insight_type     TEXT,          -- rating_point / complaint / purchase_reason / appeal_word
  label            TEXT,          -- 匿名化ラベル（「配送が遅い」等）
  count            INTEGER,       -- 出現プロジェクト数（業界横断）
  examples_anonymized JSONB,      -- 匿名化例文（80文字以内、固有名詞なし）
  confidence_score FLOAT,         -- 信頼スコア
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
```

---

## 4. 蓄積データの活用方針

### 4-1. 社内活用（現在）

- 業界ベンチマーク表示: クライアントの分析結果と業界集計を比較し、「差別化」「台頭中」「共通」を判定
- 分析精度向上: 業界別の頻出ラベルを参考に、新規分析の品質をチェック

### 4-2. 将来の外部コンテンツ活用（将来）

匿名化・集計済みのデータは以下の形式で外部利用可能とする。

| 活用形式 | 例 |
|---------|-----|
| 業界別レポート | 「2026年 美容業界 顧客不満 Top10」 |
| 提案資料 | 「食品 EC 業界における購入動機ランキング」 |
| ホワイトペーパー | 「LP改善に効果的な訴求ワード 業界別分析」 |
| 営業資料 | 「Hype Up AI が扱う業界別インサイト数」 |

> **原則**: 個社名・商品名・レビュー原文が特定される形では外部利用しない。
> 集計件数が 5 件未満の業界・ラベルは外部公開しない（k-匿名性の観点）。

---

## 5. Hype Up AI が将来的に蓄積すべき独自データ資産

### 5-1. 現在蓄積中

| 資産 | テーブル / 仕組み | 状態 |
|------|----------------|------|
| 業界別不満データベース | `aggregated_insights` (insight_type: complaint) | ✅ 稼働中 |
| 売れる訴求ワード辞書 | `aggregated_insights` (insight_type: appeal_word) | ✅ 稼働中 |
| LP改善パターン集 | `aggregated_insights` (insight_type: rating_point) + `project_analyses.lp_suggestions` | 🟡 部分的（各社個別） |
| 競合比較ベンチマーク | `comparison_reports` + `aggregated_insights` | 🟡 部分的 |

### 5-2. 将来追加候補

#### `product_demand_points`（商品別の求められているポイント）

クライアントの商品に対して「何が求められているか」を蓄積するテーブル。
業界単位ではなく商品カテゴリ・ポジション単位での集計を想定。

```sql
-- 将来テーブル案
product_demand_points (
  id            UUID,
  product_type  TEXT,   -- 例: 'skincare_moisturizer', 'supplement_diet'
  demand_label  TEXT,   -- 例: '保湿力が高い', '続けやすい価格'
  count         INTEGER,
  industry      TEXT,
  examples_anonymized JSONB,
  updated_at    TIMESTAMPTZ
)
```

#### `product_occasion_insights`（購入・検討の文脈・想起状況）

商品がどのような状況・タイミングで想起・購入されているかを蓄積。
広告のタイミング設計・ターゲティングへの応用を想定。

```sql
-- 将来テーブル案
product_occasion_insights (
  id             UUID,
  product_type   TEXT,
  occasion_label TEXT,   -- 例: '乾燥が気になる季節に', '友人の勧めで', 'SNSで見て'
  occasion_type  TEXT,   -- 'seasonal' / 'social' / 'media' / 'problem_triggered'
  count          INTEGER,
  industry       TEXT,
  examples_anonymized JSONB,
  updated_at     TIMESTAMPTZ
)
```

### 5-3. データ蓄積のロードマップ

| フェーズ | 内容 |
|---------|------|
| Phase 1（完了） | `aggregated_insights` で業界別の基本 4 軸（評価・不満・購買理由・訴求ワード）を蓄積 |
| Phase 2（現在） | RLS 有効化・マルチテナント完備。データ品質向上 |
| Phase 3（将来） | `product_demand_points` 追加。商品タイプ別の蓄積開始 |
| Phase 4（将来） | `product_occasion_insights` 追加。想起状況・購入文脈の蓄積開始 |
| Phase 5（将来） | 業界別レポートの自動生成・販売・ホワイトペーパー展開 |

---

## 6. アクセス制御方針（aggregated_insights）

RLS 有効化後、`aggregated_insights` は **platform_admin のみ直接 SELECT 可能**。

client ページ（client_owner / client_member）は、API Route または server helper 経由で
必要な範囲（自プロジェクトの業界に絞ったベンチマーク結果）のみ受け取る。

```
client page (Server Component)
    → lib/insights/get-project-benchmark.ts  ← createServiceClient() で aggregated_insights を取得
    → buildIndustryBenchmark()               ← ラベル単位の比較結果を生成
    → IndustryBenchmark JSON                 ← 必要な結果のみ page に渡す
```

これにより、クライアントは集計ラベルのみを確認でき、他社の raw データや詳細な業界分布にはアクセスできない。
