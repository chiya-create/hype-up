# RLS（Row Level Security）設計書

## 1. RLS 有効化の目的

現在、アプリケーション層（`lib/auth/permissions.ts`）で `organization_id` によるデータ絞り込みを実装しているが、
DB レベルの保護はない。RLS を有効化することで以下を担保する。

- **多層防御**：アプリのバグや直接 Supabase Dashboard へのアクセス時でも、他組織のデータが漏洩しない
- **クライアント公開前提**：ブラウザから anon key を使った Supabase SDK 呼び出しが安全になる
- **コンプライアンス対応**：組織をまたいだデータアクセスを DB レベルで禁止できる

**現状の問題**：`lib/supabase/server.ts` の `createClient()` が `SUPABASE_SERVICE_ROLE_KEY` を使用しており、
Server Component・API Route のすべてが事実上 service role で動いている。
RLS 有効化の恩恵を受けるには、`createClient()` を anon key + ユーザー JWT に切り替える必要がある（Phase 2）。

---

## 2. Supabase における RLS Helper Function のスキーマ方針

**Supabase の `auth` schema はマネージドであり、独自関数を作成できない。**

```
ERROR: 42501: permission denied for schema auth
```

このエラーは `CREATE FUNCTION auth.xxx()` を試みたときに発生する。

### 対応方針

| 種別 | スキーマ | 変更可否 |
|------|---------|---------|
| RLS helper functions（独自） | **`public` schema** に作成 | ✅ 必須 |
| Supabase 標準関数 | `auth.uid()` はそのまま使用 | 変更しない |

```sql
-- NG: permission denied for schema auth
CREATE FUNCTION auth.get_user_org_ids() ...

-- OK: public schema に作成する
CREATE FUNCTION public.get_user_org_ids() ...

-- auth.uid() はそのまま（Supabase 標準 — 変更しない）
WHERE user_id = auth.uid()
```

policy 内での参照も `public.` 修飾子を付ける:

```sql
-- NG
USING ( auth.is_platform_admin() OR id = ANY(auth.get_user_org_ids()) )

-- OK
USING ( public.is_platform_admin() OR id = ANY(public.get_user_org_ids()) )
```

> **Step 39 で修正済み**: `007_enable_rls.sql` および `001_rls_policies.sql` を `auth.*` → `public.*` に全面修正した。

---

## 4. ロール別権限方針

| ロール | 説明 | SELECT | INSERT | UPDATE | DELETE |
|--------|------|--------|--------|--------|--------|
| `client_owner` | クライアント組織の管理者 | 自組織のデータのみ | 自組織のデータのみ | 自組織のデータのみ | 自組織のデータのみ |
| `client_member` | クライアント組織の通常利用者 | 自組織のデータのみ | 自組織のデータのみ | 自組織のデータのみ | 基本不可 |
| `platform_admin` | Hype Up AI 運営者 | 全組織（横断） | 基本不要 | 基本不要 | 基本不要 |
| `service role` | API Routes・バックグラウンド処理 | 全データ | 全データ | 全データ | 全データ |
| 未ログイン (anon) | ゲストユーザー | 原則不可 | 不可 | 不可 | 不可 |

---

## 5. organization_id によるデータ分離方針

### 基本パターン
```sql
-- client_owner / client_member: 自組織のみ
organization_id IN (
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid()
)

-- platform_admin: 全組織
EXISTS (
  SELECT 1 FROM organization_members
  WHERE user_id = auth.uid()
  AND role = 'platform_admin'
)
```

### 間接参照テーブルの扱い
`reviews` / `analysis_chunks` / `project_analyses` は `organization_id` を持たないが、
`projects.organization_id` を経由して組織に紐づく。

```sql
-- reviews の場合
project_id IN (
  SELECT id FROM projects
  WHERE organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
)
```

### NULL organization_id の扱い
現時点で一部レコードが `organization_id = NULL`（Default Organization 移行前データ等）。
RLS 有効化時はこれらを明示的に Default Organization へ紐付けるか、
NULL を許可する経過措置ポリシーを設ける必要がある（`005_add_multitenancy.sql` の移行を完了させること）。

---

## 6. service role key を使う処理と使わない処理

### service role key が必要な処理（API Route・バックグラウンド）

| 処理 | ファイル | 理由 |
|------|---------|------|
| CSV アップロード → reviews 一括挿入 | `app/api/upload/route.ts` | 大量 INSERT、RLS チェックのオーバーヘッドを避けたい |
| Claude API 分析 → analysis_chunks 更新 | `app/api/analyze/route.ts` | バックグラウンド処理、service role が適切 |
| 競合比較 → comparison_reports 保存 | `app/api/compare/route.ts` | 複数 org をまたぐ可能性あり（platform_admin 操作時） |
| usage_logs 記録 | `lib/usage/log.ts` | ユーザー JWT が不要なシステムログ |
| aggregated_insights 集計 | `lib/insights/aggregate.ts` | org をまたいだ集計処理 |

### anon key + ユーザー JWT に移行できる処理（Server Component）

| 処理 | ファイル | 移行可否 | 備考 |
|------|---------|---------|------|
| プロジェクト一覧取得 | `app/projects/page.tsx` | ◎ 可能 | RLS ポリシーで自組織に絞るだけ |
| プロジェクト詳細取得 | `app/projects/[id]/page.tsx` | ◎ 可能 | 同上 |
| 比較レポート取得 | `app/compare/reports/[id]/page.tsx` | ◎ 可能 | 同上 |
| Admin: 利用ログ表示 | `app/admin/usage/page.tsx` | △ 要検討 | platform_admin ロールの RLS ポリシーが必要 |
| Admin: インサイト表示 | `app/admin/insights/page.tsx` | △ 要検討 | 同上 |
| フィードバック取得・保存 | `app/api/projects/[id]/feedback/route.ts` | ◎ 可能 | 同上 |
| PPTX エクスポート | `app/api/projects/[id]/export-pptx/route.ts` | ◎ 可能 | 読み取りのみ |
| CSV エクスポート | `app/api/projects/[id]/export/route.ts` | ◎ 可能 | 読み取りのみ |

---

## 7. テーブル別アクセス制御方針

### public client（anon key）からアクセスして良いテーブル

将来的に ブラウザ側 Supabase SDK を使う場合のみ発生。現在は Server Component 経由のため該当なし。
ただし RLS 設計上は以下は「ユーザー JWT 付きで自組織のみ」を許可する想定：

- `projects`（自組織のみ SELECT・INSERT・UPDATE）
- `reviews`（自組織 project 配下のみ SELECT）
- `project_analyses`（自組織 project 配下のみ SELECT）
- `comparison_reports`（自組織のみ SELECT）
- `analysis_feedback`（自組織のみ SELECT・INSERT・UPDATE）
- `organization_members`（自分の行のみ SELECT）

### Server Action / API Route 経由に限定すべきテーブル

直接クライアントからアクセスしてはいけないテーブル：

| テーブル | 理由 |
|---------|------|
| `usage_logs` | 運営管理データ。INSERT は API Route のみ、SELECT は platform_admin のみ |
| `aggregated_insights` | 全クライアントの匿名化データ。SELECT は platform_admin のみ |
| `analysis_chunks` | 中間処理データ。分析 API Route 経由でのみ操作 |
| `organizations` | テナント管理。直接変更不可 |

---

## 8. RLS 有効化ロードマップ

```
現状（Phase 1）
  createClient() = service role key
  アプリ層で organization_id フィルタ
  ↓

Phase 2（RLS 有効化準備）[← 今回の Step 33]
  ポリシー SQL 設計・レビュー
  service role 使用箇所一覧化
  ↓

Phase 3（RLS 有効化）
  Supabase Dashboard で各テーブルの RLS を ON
  001_rls_policies.sql を migration として適用
  createClient() を anon key + JWT に切り替え
  E2E テストで動作確認
  ↓

Phase 4（完全移行）
  server.ts の createClient() を anon key に変更
  すべての Server Component が JWT ベースで動作
  service role は API Route のバックグラウンド処理のみに限定
```

---

## 9. 重要な前提条件・注意事項

1. **`lib/supabase/server.ts` の `createClient()` は現在 service role key を使用**  
   RLS を ON にするだけでは Server Component 側で RLS が効かない。Phase 3 で anon key + JWT に切り替えが必要。

2. **`SUPABASE_SERVICE_ROLE_KEY` は絶対にブラウザ側に渡さない**  
   現在は `NEXT_PUBLIC_` prefix がないため安全。維持すること。

3. **organization_members テーブル自体の RLS**  
   ユーザーは自分の行だけ見れる設計にする。`user_id = auth.uid()` で絞る。

4. **DEFAULT_ORGANIZATION（NULL org）の取り扱い**  
   `005_add_multitenancy.sql` でほぼ補完済みだが、RLS 有効化前に NULL が残っていないか確認する。

5. **helper function の活用**  
   ポリシー内で繰り返す `organization_id` 取得ロジックは Postgres 関数化してパフォーマンスを確保する。
   詳細は `supabase/policies/001_rls_policies.sql` 参照。

---

## 10. Step 35 動作確認結果（コードレビューによる検証）

実施日: 2026-05-11  
確認方法: コード静的解析

### PASS 項目

| 確認項目 | 結果 | 備考 |
|---------|------|------|
| `/` 未ログインアクセス | ✅ PASS | `getCurrentUserAccessContext()` でログイン状態を判定、ページは表示される |
| `/login` への導線（未ログイン） | ✅ PASS | ヘッダーにログインリンクが表示される |
| `/projects` 未ログイン | ✅ PASS | `isAuthenticated=false` でログイン案内 UI を返す |
| `/admin` 未ログイン | ✅ PASS | `requirePlatformAdminAccess()` → `isAuthenticated=false` → ログイン案内表示 |
| `/admin` client_owner/member でアクセス | ✅ PASS | `isPlatformAdmin()=false` → 「Platform Admin 権限で保護されています」表示 |
| `/admin/usage` `/admin/insights` `/admin/feedback` の platform_admin ガード | ✅ PASS | 全 4 ページに `requirePlatformAdminAccess()` 実装済み |
| Admin リンクの表示制御 | ✅ PASS | `/` と `/projects` で `isPlatformAdmin(ctx.role)` による条件表示 |
| `upload` API の認証・org チェック | ✅ PASS | `isAuthenticated` + `activeOrganizationId` + `role` の 3 重チェック、`organization_id` を INSERT |
| `analyze` API の認証・ロール・org チェック | ✅ PASS | `canAnalyze()` + `isPlatformAdmin` 例外付き org チェック |
| `compare` API の認証・ロール・org チェック | ✅ PASS | `canCreateComparison()` + 全プロジェクトの org 帰属チェック、`organization_id` を INSERT |
| export (CSV/PPTX) API の認証・org チェック | ✅ PASS | `canExport()` + `isPlatformAdmin` 例外付き org チェック（3 エンドポイント） |
| feedback POST の `organization_id` 保存 | ✅ PASS | project/comparison_report から `organization_id` を取得して保存 |
| `createServerUserClient` / `createServiceClient` の分離 | ✅ PASS | server.ts に `createClient()` は存在しない。admin と API が正しいクライアントを使用 |

### 問題一覧

#### ✅ 修正済み（Step 36）

**[Issue-1] フィードバック API に認証チェックがない → 修正済み**

- 対象: `app/api/projects/[id]/feedback/route.ts` (GET・POST)、`app/api/compare/reports/[id]/feedback/route.ts` (GET・POST)
- 対応: `getCurrentUserAccessContext()` を追加。GET・POST ともに `isAuthenticated` チェック + `isPlatformAdmin` 例外付き org チェックを実装。未ログイン → 401、他 org → 403。

**[Issue-2] プロジェクト詳細サブページに認証・org チェックがない → 修正済み**

- 対象: `app/projects/[id]/one-pager/page.tsx`、`app/projects/[id]/report/page.tsx`、`app/projects/[id]/reviews/page.tsx`
- 対応: `requireClientAccess()` を追加（未ログイン → `/login` リダイレクト）。`project.organization_id !== ctx.activeOrganizationId` の場合 `notFound()`。

**[Issue-3] 比較レポートサブページに認証・org チェックがない → 修正済み**

- 対象: `app/compare/reports/[id]/one-pager/page.tsx`、`app/compare/result/page.tsx`
- 対応: Issue-2 と同様。`requireClientAccess()` + org チェック実装。`compare/result` は全プロジェクトの org 帰属を検証。

**[Issue-5] サブページが anon key フルアクセスに依存 → Issue-2・3 の修正により解決**

**[Issue-6] `compare/result` の org チェックがない → Issue-3 の修正により解決**

#### 🔵 将来対応（Phase 3）

**[Issue-4] `platform_admin` がプロジェクト詳細・比較レポート詳細を閲覧できない**

- 対象: `app/projects/[id]/page.tsx`（行 92-97）、`app/compare/reports/[id]/page.tsx`（行 52-57）
- 内容: org チェックに `isPlatformAdmin` の例外がなく、platform_admin が自分の org とは異なるクライアントプロジェクトを開くと `notFound()` になる。
- Step 32 の仕様: "platform_admin は検証・運営用としてclient側画面も利用可能でOK"
- 対応: Phase 3（RLS 有効化）時に org チェック条件に `!isPlatformAdmin(ctx.role)` を追加する。

### service role 使用箇所の整合性確認

| ファイル | 使用クライアント | 判定 |
|---------|--------------|------|
| `app/admin/*.tsx` (4 ページ) | `createServiceClient()` from service.ts | ✅ 正しい（全組織横断が必要） |
| `app/api/upload/route.ts` | `createServiceClient()` from service.ts | ✅ 正しい（大量 INSERT） |
| `app/api/analyze/route.ts` | `createServiceClient()` from service.ts | ✅ 正しい（バックグラウンド処理） |
| `app/api/compare/route.ts` | `createServiceClient()` from service.ts | ✅ 正しい（横断取得） |
| `lib/usage/log.ts` | `createServiceClient()` from service.ts | ✅ 正しい（システムログ） |
| `lib/insights/aggregate.ts` | `createServiceClient()` from service.ts | ✅ 正しい（横断集計） |
| `app/projects/[id]/debug/page.tsx` | `createServiceClient()` from service.ts | ✅ 一時対応（TODO コメントあり） |
| `lib/auth/permissions.ts` | `createServerUserClient()` | ✅ 正しい（RLS 後に自組織データのみ取得） |
| クライアント画面 14 ファイル | `createServerUserClient()` | ✅ 正しい（RLS 後にポリシー適用） |
| auth (login/callback/logout) | `createAuthClient()` | ✅ 正しい（セッション管理専用） |

---

## 11. Step 37〜39 — 007_enable_rls.sql 適用ガイド

作成日: 2026-05-11  
Migration ファイル: `supabase/migrations/007_enable_rls.sql`

---

### 9-1. 適用前チェックリスト

#### 🔴 必須（未対応だとアプリが壊れる）

- [x] **`aggregated_insights` アクセスの移行 → Step 38 で対応済み ✅**  
  `lib/insights/get-project-benchmark.ts`（server helper）と  
  `app/api/projects/[id]/benchmark/route.ts`（API Route）を新規作成。  
  以下 3 ファイルを直接 select から server helper 経由に移行完了。  
  - `app/projects/[id]/page.tsx`  
  - `app/projects/[id]/one-pager/page.tsx`  
  - `app/projects/[id]/report/page.tsx`

#### 🟡 推奨（未対応でも動くが確認すること）

- [ ] **`organization_id = NULL` レコードがないことを確認**  
  `005_add_multitenancy.sql` で補完済みのはずだが、本番 DB で確認する。  
  ```sql
  SELECT 'projects', COUNT(*) FROM projects WHERE organization_id IS NULL
  UNION ALL
  SELECT 'comparison_reports', COUNT(*) FROM comparison_reports WHERE organization_id IS NULL
  UNION ALL
  SELECT 'analysis_feedback', COUNT(*) FROM analysis_feedback WHERE organization_id IS NULL;
  ```  
  NULL が残る場合、migration の `OR organization_id IS NULL` 条件により既存データは引き続きアクセス可能だが、長期的に埋めることを推奨。

- [ ] **ステージング環境での動作確認**  
  本番適用前にステージング DB（または Supabase local dev）で 007_enable_rls.sql を実行し、以下の全テストケース（9-3 節）をパスすることを確認する。

- [ ] **`public.get_user_org_ids()` の動作確認**  
  ログイン済みセッションで `SELECT public.get_user_org_ids()` を実行し、正しい UUID 配列が返ることを確認する。

- [ ] **`platform_admin` ロール名の確認**  
  `006_normalize_roles.sql` を適用済みで、DB 内に `owner / admin / member / viewer` などのレガシーロールが残っていないことを確認する。  
  ```sql
  SELECT DISTINCT role FROM organization_members WHERE role NOT IN ('client_owner', 'client_member', 'platform_admin');
  ```

---

### 9-2. 適用後チェックリスト

- [ ] RLS 有効テーブルを確認  
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public' ORDER BY tablename;
  ```  
  全 10 テーブルが `rowsecurity = true` になっていること。

- [ ] ポリシー一覧を確認  
  ```sql
  SELECT tablename, policyname, cmd FROM pg_policies
  WHERE schemaname = 'public' ORDER BY tablename, policyname;
  ```

- [ ] client_owner でログインし、自組織のプロジェクト一覧が表示されること
- [ ] client_owner で他組織の project UUID を URL に直打ちしても `notFound` になること
- [ ] platform_admin で `/admin` の全データが表示されること
- [ ] feedback の GET・POST が認証済みユーザーで動作すること
- [ ] 分析 API（アップロード・analyze）が正常に完了すること（service role は RLS バイパス）
- [ ] 業界ベンチマーク表示が壊れていないこと（上記の aggregated_insights 対応完了後）

---

### 9-3. ロール別テストケース

#### client_owner / client_member

| 操作 | 期待結果 |
|------|---------|
| `/projects` 表示 | 自組織のプロジェクトのみ表示 |
| 他組織の `/projects/[id]` に直接アクセス | `notFound`（アプリ層 + RLS の二重保護） |
| フィードバック GET | 自組織の feedback のみ返す |
| フィードバック POST | 自組織の feedback のみ更新可 |
| `/admin` アクセス | `requirePlatformAdminAccess()` でアクセス拒否（RLS の前にアプリ層でブロック） |
| `aggregated_insights` への直接クエリ | 空配列（RLS でブロック）※対応完了後 |
| `usage_logs` への直接クエリ | 空配列（RLS でブロック） |

#### platform_admin

| 操作 | 期待結果 |
|------|---------|
| `/admin/usage` | 全組織の usage_logs が表示 |
| `/admin/insights` | 全組織の aggregated_insights が表示 |
| `/admin/feedback` | 全組織の analysis_feedback が表示 |
| 任意の projects SELECT | 全組織のデータが返る |
| Issue-4 の対応前に他組織の `/projects/[id]` に直接アクセス | アプリ層の org チェックで `notFound`（Phase 3 対応待ち） |

#### 未ログイン（anon）

| 操作 | 期待結果 |
|------|---------|
| 任意のテーブルへの直接クエリ | 空配列（RLS ポリシーなし = SELECT 不可） |
| client ページへのアクセス | `requireClientAccess()` でログインリダイレクト |
| feedback API (GET/POST) | 401 Unauthorized（アプリ層でブロック） |

---

### 9-4. Rollback 方針

RLS を無効化して元の状態に戻す場合:

```sql
-- RLS を無効化（ポリシーは残るが適用されなくなる）
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_insights DISABLE ROW LEVEL SECURITY;
```

ポリシーも削除する場合（完全 rollback）:
```sql
-- 例: projects のポリシーを削除
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
-- 他テーブルも同様
```

Helper function も削除する場合:
```sql
DROP FUNCTION IF EXISTS public.get_user_org_ids();
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP FUNCTION IF EXISTS public.user_belongs_to_org(UUID);
```

> **注意**: RLS 無効化は即時反映。Supabase Dashboard > SQL Editor で実行可能。
> アプリの再デプロイは不要。

---

## 12. Step 39 — RLS 適用後に発見した Issues と対処

実施日: 2026-05-11

### Issue A: `auth` schema に独自関数を作成できない → ✅ 解決済み

**症状**: `CREATE FUNCTION auth.get_user_org_ids()` 実行時に `ERROR: 42501: permission denied for schema auth`

**原因**: Supabase の `auth` schema はマネージドであり、カスタム関数の作成が禁止されている。

**対応**: helper functions をすべて `public` schema に移動。詳細はセクション 2 を参照。

---

### Issue B: `org_members_select` ポリシーで `auth.users` サブクエリが失敗 → ✅ 解決済み

**症状**: RLS 有効化後、`platform_admin` ユーザーが `/admin` にアクセスできず「アクセス権限がありません」

**根本原因 1**: `organization_members.user_id = NULL`  
マジックリンクログイン後の初回セッションでは `user_id` が NULL のまま。
`public.is_platform_admin()` は `WHERE user_id = auth.uid()` で絞るため、NULL 行はヒットしない。

**根本原因 2**: `(SELECT email FROM auth.users WHERE id = auth.uid())` が `authenticated` ロールで実行不可  
Supabase の `authenticated` ロールは `auth.users` を SELECT する権限を持たない。
サブクエリが失敗し、メールアドレスのフォールバック条件も false になる。

**対応 1**: SQL Editor で `user_id` を手動補完（初回のみ）
```sql
UPDATE organization_members
SET user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com')
WHERE email = 'your@email.com'
  AND user_id IS NULL;
```

**対応 2**: ポリシーの email 条件を `auth.email()` に変更（`007_enable_rls.sql` 修正済み）

`auth.email()` は JWT から直接メールアドレスを読むため、`auth.users` へのアクセス権限不要。

```sql
-- Before（NG: authenticated ロールは auth.users を SELECT できない）
OR (user_id IS NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))

-- After（OK: JWT から直接読む）
OR (user_id IS NULL AND email = auth.email())
```

`007_enable_rls.sql` の `org_members_select` と `org_members_update_self` の両ポリシーを修正済み。

**再適用 SQL** (既に RLS が有効な DB に対して再実行する場合):
```sql
DROP POLICY IF EXISTS "org_members_select" ON organization_members;
CREATE POLICY "org_members_select"
ON organization_members FOR SELECT
USING (
  public.is_platform_admin()
  OR user_id = auth.uid()
  OR (user_id IS NULL AND email = auth.email())
);

DROP POLICY IF EXISTS "org_members_update_self" ON organization_members;
CREATE POLICY "org_members_update_self"
ON organization_members FOR UPDATE
USING (user_id IS NULL AND email = auth.email())
WITH CHECK (user_id = auth.uid());
```

---

## 13. Step 40 — client_owner RLS 動作検証結果

実施日: 2026-05-11  
検証アカウント: `chihaya.toyoshima+client@gmail.com`（role: `client_owner`、org: Default Organization）  
隔離テスト用: `テストクライアント組織B`（別組織、ダミープロジェクト1件）

### ✅ シナリオ D（client_owner）全 PASS

| 確認項目 | 期待結果 | 実際の結果 |
|---------|---------|-----------|
| ヘッダーに Admin リンクなし | 表示されない | ✅ 非表示（メールアドレスとログアウトのみ） |
| `/projects` | 自組織の3件のみ表示 | ✅ Default Organization の3件のみ（Org B プロジェクト非表示） |
| `/projects/[id]` | 自組織のプロジェクト詳細表示 | ✅ 分析結果・業界ベンチマーク全表示 |
| `/projects/[id]/one-pager` | 表示される | ✅ 正常表示 |
| `/projects/[id]/reviews` | 30件表示 | ✅ 正常表示 |
| `/projects/[id]/report` | 全セクション表示 | ✅ 正常表示（業界ベンチマーク含む） |
| `GET /api/.../feedback`（自組織） | 200 OK | ✅ `status:200 body:null`（未登録のため null） |
| `/admin` | アクセス拒否 | ✅ 「アクセス権限がありません」表示 |
| `/projects/<org_b_id>`（他組織・直接URL） | 404 | ✅ 404 Not Found（RLS でデータ取得不可 → notFound） |
| `GET /api/.../feedback`（他組織） | 403 | ✅ `{"error":"アクセス権限がありません"}` |

### テスト環境セットアップ

```sql
-- Org B（隔離テスト用）
INSERT INTO organizations ... VALUES ('テストクライアント組織B', ...)
-- Org B ダミープロジェクト（status: 'pending'）
INSERT INTO projects ... VALUES ('Org B 専用プロジェクト（見えてはいけない）', organization_id=<org_b_id>)
-- client_owner 登録（user_id は初回ログイン時に permissions.ts が自動補完）
INSERT INTO organization_members (email, role) VALUES ('chihaya.toyoshima+client@gmail.com', 'client_owner')
```

### 確認できた RLS の動作

1. **データ分離**: client_owner は自組織（Default Organization）の3プロジェクトのみ参照可能。Org B のプロジェクトは SELECT できないため `/projects` に表示されず、直接 URL アクセスも `notFound()` になる
2. **API 保護**: feedback API も organization_id チェックにより他組織は 403 返却
3. **Admin ガード**: `requirePlatformAdminAccess()` により `/admin` は UI レベルでもブロック（Admin リンク非表示 + アクセス拒否メッセージ）
4. **user_id 自動補完**: `permissions.ts` の `getCurrentUserAccessContext()` が初回ログイン時に `email` 一致の `user_id = NULL` 行を自動的に `auth.uid()` で補完（`org_members_update_self` RLS ポリシーが許可）

### 発見した問題

なし。全項目 PASS。
