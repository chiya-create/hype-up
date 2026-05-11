# Hype Up AI セキュリティ設計メモ

作成日: 2026-05-11  
対象: 開発者・運用担当者

---

## 1. 環境変数の公開範囲

### NEXT_PUBLIC_ が付く変数 → ブラウザ側に公開される

| 変数名 | 公開先 | 備考 |
|--------|--------|------|
| `NEXT_PUBLIC_SITE_URL` | クライアント・サーバー両方 | Auth のリダイレクト URL |
| `NEXT_PUBLIC_SUPABASE_URL` | クライアント・サーバー両方 | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | クライアント・サーバー両方 | anon key（RLS が守る） |

`NEXT_PUBLIC_` は Next.js がビルド時にバンドルに埋め込む。
**公開されても問題ない値のみ設定すること。**

### NEXT_PUBLIC_ がない変数 → サーバー専用（ブラウザ非公開）

| 変数名 | 公開先 | 備考 |
|--------|--------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server Components / API Routes のみ | **RLS をバイパスする。絶対に漏洩させない** |
| `ANTHROPIC_API_KEY` | API Routes のみ | Claude API 呼び出し用 |
| `CLAUDE_CHUNK_MODEL` | サーバーのみ | 省略可 |
| `CLAUDE_SYNTHESIS_MODEL` | サーバーのみ | 省略可 |

---

## 2. SUPABASE_SERVICE_ROLE_KEY の取り扱い

### なぜ危険か

`service_role` は **すべての RLS ポリシーをバイパス** する。
この key を持つ者は DB の全データを無制限に読み書きできる。

### 安全な使い方

```
✓ Server Component（async function）の中で createServiceClient() を呼ぶ
✓ API Route（app/api/*/route.ts）の中で使う
✓ Vercel Environment Variables の SECRET として設定する

✗ client Component（'use client'）で使う → バンドルに含まれる
✗ NEXT_PUBLIC_ をプレフィックスにする → ブラウザに公開される
✗ GitHub / Slack / ログ等に貼り付ける
✗ フロントエンドの fetch() 呼び出し URL パラメーターに含める
```

### 使用箇所の管理

`lib/supabase/service.ts` の `createServiceClient()` に集約済み。
新規ファイルに追加する場合は必ずこの関数を import する。
`SUPABASE_SERVICE_ROLE_KEY` を直接 `process.env` から参照するコードは書かない。

---

## 3. RLS（Row Level Security）の役割

### RLS の目的

- データベースレベルでのマルチテナント分離
- `service role` か RLS ポリシーを通過した操作のみを許可
- アプリケーション側のバグがあっても DB レベルで他社データを守る

### クライアント（anon key + JWT）が見えるデータ

| テーブル | 見える範囲 |
|---------|-----------|
| `organizations` | 自分が所属する組織のみ |
| `organization_members` | 自分の行のみ（メール一致含む） |
| `projects` | 自組織のプロジェクトのみ |
| `reviews` | 自組織プロジェクトのレビューのみ |
| `analysis_chunks` | 自組織プロジェクトのチャンクのみ |
| `project_analyses` | 自組織プロジェクトの分析のみ |
| `comparison_reports` | 自組織のレポートのみ |
| `analysis_feedback` | 自組織のフィードバックのみ |
| `usage_logs` | 見えない（platform_admin のみ） |
| `aggregated_insights` | 見えない（platform_admin のみ） |

### platform_admin は全テーブルを閲覧可能

platform_admin の SELECT ポリシーは全件許可。
ただし `aggregated_insights` は匿名化済みデータのみ保持する（後述）。

---

## 4. ロール設計

| ロール | 説明 | できること |
|--------|------|-----------|
| `platform_admin` | 運営・開発者 | `/admin` 全機能、全組織のデータ閲覧、組織・メンバー管理 |
| `client_owner` | クライアント企業のオーナー担当者 | 自組織のプロジェクト操作、分析、エクスポート |
| `client_member` | クライアント企業のメンバー | 同上（現状 client_owner と機能差なし） |

### 追加・変更のルール

- ロールの追加・変更は `supabase/migrations/006_normalize_roles.sql` と RLS ポリシー（`007_enable_rls.sql`）を同時に更新する
- 新しいロールを追加する場合は `lib/auth/permissions.ts` の `normalizeRole()` も更新する

---

## 5. aggregated_insights の匿名化方針

### 目的

複数クライアントのデータから業界横断インサイトを生成するが、
**個社・個人が特定できるデータは保存しない**。

### 保存してよいデータ

- ラベル（`label`）: 「配送が遅い」「香りが良い」等の短い分類ラベル
- インサイトタイプ（`insight_type`）: `rating_point` / `complaint` / `purchase_reason` / `appeal_word`
- 業界（`industry`）: `general` / `beauty` / `food` 等
- 出現件数（`count`）: 業界横断の件数（個社件数ではない）
- 匿名化例文（`examples_anonymized`）: **80 文字以内**、商品名・会社名・固有名詞を含まない

### 保存してはいけないデータ

```
✗ レビュー原文そのもの（長文・文脈情報を含むもの）
✗ 商品名・ブランド名・会社名が特定できるデータ
✗ 個人を特定できる情報（ニックネーム・投稿日時の細粒度）
✗ 80 文字を超える文脈のある文章
```

### k-匿名性の原則

外部公開する場合は **集計件数 5 件未満の業界・ラベルは公開しない**（k-匿名性）。

---

## 6. クライアントのレビュー原文の取り扱い

### 原則

- **他社クライアントのレビュー原文を横断利用しない**
- `aggregated_insights` に蓄積するのは匿名化・短縮済みのラベルと例文のみ
- `reviews` テーブルの原文は各クライアントの組織に紐付けられており、RLS で他社からアクセス不可

### 活用可能なデータ

| データ種別 | 用途 |
|-----------|------|
| 匿名化集計インサイト（`aggregated_insights`） | 業界別レポート・提案資料・ホワイトペーパー |
| 利用統計（`usage_logs` の集計値） | 資料に「○○件のレビューを分析」等の実績数値として活用可 |

---

## 7. 本番前に必要な法的対応項目

### 利用規約（Terms of Service）に含めるべき項目

- [ ] Hype Up AI へのデータアップロード・処理の同意
- [ ] AI（Claude API）によるレビュー分析への同意
- [ ] 匿名化・集計データの業界インサイトへの転用に関する規定
- [ ] データの保存期間と削除ポリシー
- [ ] 禁止事項（第三者の個人情報を含むデータのアップロード等）
- [ ] 免責事項（AI 分析の結果は参考情報であり保証しない）

### プライバシーポリシーに含めるべき項目

- [ ] 収集する個人情報（メールアドレス等）
- [ ] Supabase（データ保存）と Anthropic（AI処理）への第三者提供に関する記載
- [ ] データ保存場所（Supabase のリージョン）
- [ ] ユーザーの権利（削除要請・開示請求）
- [ ] Cookie・ローカルストレージの利用有無

### GDPR / 個人情報保護法

- [ ] 顧客のレビューに個人情報が含まれる場合の取り扱い方針を確認
- [ ] Anthropic の Data Processing Agreement（DPA）を確認
- [ ] Supabase の DPA を確認

---

## 8. インシデント対応

### service_role key が漏洩した場合

1. Supabase Dashboard → Project Settings → API → service_role key を **即時 Rotate**
2. Vercel の環境変数を新しい key に更新し **再デプロイ**
3. Supabase の Audit Logs で不審なアクセスがないか確認
4. `usage_logs` で異常なイベントが記録されていないか確認

### Anthropic API key が漏洩した場合

1. Anthropic Console → API Keys → 該当 key を **即時削除**
2. 新しい key を発行して Vercel 環境変数を更新し **再デプロイ**
3. Anthropic の使用量ダッシュボードで不審な呼び出しがないか確認
