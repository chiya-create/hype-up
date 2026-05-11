# Hype Up AI デプロイ前チェックリスト

作成日: 2026-05-11  
対象: Vercel + Supabase (本番) へのデプロイ担当者

チェックが完了したら `[x]` に変更してください。

---

## 1. Vercel 環境変数

Vercel Dashboard → Project → Settings → Environment Variables に以下を設定する。

| 変数名 | 本番値の入手先 | NEXT_PUBLIC | 備考 |
|--------|-------------|:-----------:|------|
| `NEXT_PUBLIC_SITE_URL` | 本番ドメイン（例: `https://hype-up.vercel.app`） | ✓ | 末尾スラッシュなし |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | ✓ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上 → anon key | ✓ | |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上 → service_role key | ✗ | **絶対に公開しない** |
| `ANTHROPIC_API_KEY` | Anthropic Console → API Keys | ✗ | |
| `CLAUDE_CHUNK_MODEL` | 省略可（デフォルト: `claude-haiku-4-5-20251001`） | ✗ | |
| `CLAUDE_SYNTHESIS_MODEL` | 省略可（デフォルト: `claude-sonnet-4-6`） | ✗ | |

### チェック項目

- [ ] すべての必須変数が Vercel の **Production** 環境に設定されている
- [ ] `NEXT_PUBLIC_SITE_URL` が本番ドメインと一致している（末尾スラッシュなし）
- [ ] `SUPABASE_SERVICE_ROLE_KEY` が Preview / Development と本番で別の値になっている
- [ ] Preview 環境がある場合は開発用 Supabase Project を指定している

---

## 2. Supabase Auth URL Configuration

Supabase Dashboard → Authentication → URL Configuration で設定する。

### Site URL

```
https://your-domain.com
```

- [ ] **Site URL** を本番ドメインに設定した

### Redirect URLs（Allowed Redirect URLs）

以下をすべて追加する。

```
https://your-domain.com/**
https://your-domain.com/auth/callback
http://localhost:3000/**          ← ローカル開発用（削除しなくてよい）
http://localhost:3000/auth/callback
```

- [ ] 本番ドメインの Redirect URL を登録した
- [ ] ワイルドカード `/**` を含めて登録した（Next.js の動的ルートのため）

### Magic Link の有効期限

- [ ] Authentication → Email → Magic Link expiry を確認（デフォルト: 60 分）

---

## 3. Supabase RLS（Row Level Security）

### マイグレーション適用確認

- [ ] `supabase/migrations/007_enable_rls.sql` を本番 DB に適用済み
- [ ] SQL Editor で RLS 有効テーブルを確認:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

期待値: 以下 10 テーブルが `rowsecurity = true`

| テーブル |
|---------|
| aggregated_insights |
| analysis_chunks |
| analysis_feedback |
| comparison_reports |
| organization_members |
| organizations |
| project_analyses |
| projects |
| reviews |
| usage_logs |

- [ ] ポリシー一覧を確認:

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

- [ ] helper functions が存在することを確認:

```sql
SELECT proname FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname IN ('get_user_org_ids', 'is_platform_admin', 'user_belongs_to_org');
```

### NULL organization_id の確認

- [ ] 移行期間中のレガシーレコードがないことを確認（または移行済み）:

```sql
SELECT COUNT(*) FROM projects WHERE organization_id IS NULL;
SELECT COUNT(*) FROM reviews WHERE organization_id IS NULL;
SELECT COUNT(*) FROM comparison_reports WHERE organization_id IS NULL;
SELECT COUNT(*) FROM analysis_feedback WHERE organization_id IS NULL;
```

---

## 4. 初期データ・ユーザー確認

### platform_admin の設定

- [ ] `organization_members` に platform_admin ロールのユーザーが最低 1 名いる
- [ ] そのユーザーで `/admin` にアクセスできることをローカルで確認済み

```sql
-- platform_admin 確認
SELECT om.email, om.role, o.name
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE om.role = 'platform_admin';
```

### client_owner テスト確認

- [ ] client_owner ロールのテストユーザーで以下が動作することを確認:
  - ログイン（マジックリンク）
  - CSVアップロード
  - 分析実行
  - レポート表示
  - PPTX出力

### 組織分離テスト

- [ ] Org A のユーザーが Org B のプロジェクトにアクセスできないことを確認（404 / 403）

---

## 5. 本番 DB と開発 DB の分離方針

```
開発 (ローカル / Preview)
  └── Supabase Project: hype-up-dev
      └── .env.local → NEXT_PUBLIC_SUPABASE_URL=https://xxxdev.supabase.co

本番 (Production)
  └── Supabase Project: hype-up-prod
      └── Vercel Env: NEXT_PUBLIC_SUPABASE_URL=https://xxxprod.supabase.co
```

- [ ] 本番用 Supabase Project が開発用と別プロジェクトになっている
- [ ] 開発用の `SUPABASE_SERVICE_ROLE_KEY` が本番 Vercel 環境に混入していない
- [ ] 本番 DB に対してローカルから直接マイグレーションを実行する場合は `supabase db push --linked` を使う

---

## 6. セキュリティ確認

### 環境変数

- [ ] `.env.local` が `.gitignore` に含まれている（デフォルトで含まれているはず）
- [ ] `git log --all -- .env.local` で過去に commit していないことを確認
- [ ] `SUPABASE_SERVICE_ROLE_KEY` が GitHub リポジトリのどこにも露出していない
- [ ] `ANTHROPIC_API_KEY` が同様に露出していない

```bash
# リポジトリ全体をスキャン（要注意なキーワード）
git grep -n "service_role" -- "*.ts" "*.tsx" "*.js" "*.json"
```

### service_role の利用箇所

service role を使用するファイルは以下に限定されていることを確認:

| ファイル | 用途 |
|---------|------|
| `lib/supabase/service.ts` | createServiceClient() 定義 |
| `app/api/upload/route.ts` | reviews 大量 INSERT |
| `app/api/analyze/route.ts` | 分析処理 |
| `app/api/compare/route.ts` | 競合比較 |
| `app/api/projects/[id]/export/route.ts` | CSV エクスポート（org 横断が不要だが PPTX と統一） |
| `lib/usage/log.ts` | usage_logs INSERT |
| `lib/insights/aggregate.ts` | aggregated_insights UPSERT |
| `lib/insights/get-project-benchmark.ts` | ベンチマーク取得 |
| `app/admin/page.tsx` | Admin ダッシュボード KPI |
| `app/admin/usage/page.tsx` | 利用ログ一覧 |
| `app/admin/insights/page.tsx` | 集計インサイト一覧 |
| `app/admin/feedback/page.tsx` | フィードバック一覧 |
| `app/admin/organizations/page.tsx` | 組織一覧 |
| `app/admin/organizations/[id]/page.tsx` | 組織詳細 |
| `app/admin/organizations/actions.ts` | 組織・メンバー作成 Server Actions |

- [ ] 上記以外のファイルで `createServiceClient()` が使われていないことを確認

```bash
grep -rn "createServiceClient\|SERVICE_ROLE" app/ lib/ --include="*.ts" --include="*.tsx"
```

---

## 7. ビルド・CI 確認

- [ ] `npm run build` がエラーなしで完了する
- [ ] TypeScript の型エラーが 0 件
- [ ] `npm run lint` を実行し、**error** 件数を確認する
  - `FeedbackForm.tsx` の `react-hooks/set-state-in-effect` は **false positive**（useCallback 非同期関数内の setState。コード動作に問題なし）
  - `@typescript-eslint/no-unused-vars` の warning は軽微。将来 cleanup 対応でよい

---

## 7.5. Vercel タイムアウト設定（長時間 API Route）

Vercel のデフォルト関数タイムアウトは **Hobby プラン: 10 秒 / Pro プラン: 60 秒** です。

### ✅ 設定済み（Step 45 で実施）

| ルート | maxDuration | 最大処理時間の試算 |
|--------|:-----------:|-----------------|
| `/api/analyze` | **300 秒** | 1,000 件 ÷ 50件/チャンク = 最大 20 チャンク × ~10秒 ≒ 200 秒 |
| `/api/compare` | **120 秒** | Claude 1 回呼び出し。通常 30〜60 秒 |
| `/api/upload` | 設定なし | DB INSERT のみ。10 秒以内 |

> **注意:** `maxDuration > 60` は **Vercel Pro プラン以上** が必要です。
> Hobby プランの場合は上限 60 秒に自動クランプされます。

### MVP 時点のレビュー件数上限

`lib/constants.ts` にて `MAX_REVIEWS_PER_PROJECT = 1,000` を設定済み。

- アップロード API（`/api/upload`）は 1,001 件以上で 400 を返す
- フォーム（`CsvUploadForm`）はアップロード前に件数を確認し、超過時は送信ボタンを無効化
- 500 件超は「時間がかかる可能性」の警告を表示

### 将来の非同期ジョブキュー化候補

大規模分析（数千件以上）に対応する場合は以下の設計変更を検討:

| 手法 | 概要 |
|------|------|
| Inngest | バックグラウンド関数。Vercel と相性◎ |
| Supabase Edge Functions + pg_cron | DB トリガーで分析キューを実行 |
| Vercel Cron Jobs | 定期的に pending プロジェクトを処理 |

- [x] `maxDuration` を各ルートに追加済み（Step 45）
- [x] MVP 件数上限（1,000 件）を実装済み（Step 45）
- [ ] 将来: 大規模分析の非同期ジョブキュー化を検討する

---

## 8. デプロイ後 動作確認項目

デプロイ直後に本番 URL で以下を確認してください。詳細手順は `docs/production-smoke-test.md` を参照。

- [ ] トップページが表示される（`/`）
- [ ] 未ログインで `/projects` → ログイン案内が表示される
- [ ] 未ログインで `/admin` → アクセス拒否が表示される
- [ ] マジックリンクメールが届く（Supabase Auth のメール設定確認）
- [ ] platform_admin でログイン → `/admin` にアクセスできる
- [ ] client_owner でログイン → CSV アップロード → 分析 → レポート表示
- [ ] Org B のプロジェクト URL に Org A ユーザーでアクセス → 404

---

## 9. 運用初日チェック

- [ ] `/admin/organizations` で本番用 Organization を作成
- [ ] 最初の client_owner を招待（メールアドレスを `organization_members` に追加）
- [ ] platform_admin で `/admin` の KPI が正常に表示される
- [ ] 利用ログ（`/admin/usage`）が記録されている
