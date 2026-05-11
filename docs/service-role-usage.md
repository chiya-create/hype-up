# service role key 使用箇所一覧

RLS 有効化（Phase 3）に向けた現状整理。
`SUPABASE_SERVICE_ROLE_KEY` を使用しているファイル・関数を一覧化し、将来的な移行方針を記載する。

**最終更新: Step 37（007_enable_rls.sql 作成・RLS 設計確定）**

---

## クライアント関数の役割分類（Step 34 完了後）

| 関数 | ファイル | キー | 用途 |
|------|---------|-----|------|
| `createServerUserClient()` | `lib/supabase/server.ts` | anon key | ユーザー画面・フィードバック・エクスポート。RLS 有効化後にポリシーが適用される |
| `createAuthClient()` | `lib/supabase/server.ts` | anon key | login/callback/logout の auth 操作専用 |
| `getCurrentUser()` | `lib/supabase/server.ts` | anon key | createAuthClient 経由でセッションユーザーを取得 |
| `createServiceClient()` | `lib/supabase/service.ts` | service role | API Route・Admin・バックグラウンド処理専用。RLS をバイパスする |

---

## 凡例

| 移行可否 | 意味 |
|---------|------|
| ◎ 移行済 | Step 34 で createServerUserClient() に移行完了 |
| ◎ 移行可 | anon key + ユーザー JWT + RLS ポリシーで代替可能（Phase 3 で対応） |
| △ 条件付き | 一部は移行可能だが、設計変更が必要 |
| × 維持必須 | バックグラウンド処理・横断集計のため service role が必要 |

---

## service role を維持するファイル（Step 38 確定版）

### 1. `lib/supabase/service.ts` — `createServiceClient()`

| 項目 | 内容 |
|-----|------|
| 使用目的 | service role 専用クライアントの定義。バックグラウンド処理専用 |
| anon 移行可否 | × 維持必須 |
| 対応方針 | このファイルに service role を集約する。server.ts には service role を置かない |

### 2. `app/api/upload/route.ts`

| 項目 | 内容 |
|-----|------|
| 使用目的 | reviews の大量 INSERT（最大 1,000 件/バッチ）、projects 作成、analysis_chunks 作成 |
| anon 移行可否 | △ 条件付き。RLS ポリシー設定後は移行可能だがバッチ INSERT のパフォーマンスが懸念 |
| 対応方針 | API Route 経由を維持。認証チェックは `getCurrentUserAccessContext()` で実施済み |

### 3. `app/api/analyze/route.ts`

| 項目 | 内容 |
|-----|------|
| 使用目的 | analysis_chunks の SELECT・UPDATE、project_analyses の UPSERT、projects の status 更新 |
| anon 移行可否 | × 維持必須。Claude API 呼び出しと連動した長時間処理のため service role が適切 |
| 対応方針 | API Route 経由を維持。認証・org チェックを Route Handler 冒頭で実施済み |

### 4. `app/api/compare/route.ts`

| 項目 | 内容 |
|-----|------|
| 使用目的 | projects・project_analyses の横断取得、comparison_reports の INSERT |
| anon 移行可否 | △ 条件付き。単一 org 内の比較なら RLS で絞れるが platform_admin の横断操作は不可 |
| 対応方針 | API Route 経由を維持。認証・org チェックを Route Handler 冒頭で実施済み |

### 4.5. `app/api/projects/[id]/export/route.ts`

| 項目 | 内容 |
|-----|------|
| 使用目的 | project_analyses の SELECT → CSV エクスポート生成。logUsageEvent も service role で記録 |
| anon 移行可否 | △ 条件付き。RLS ポリシーがあれば anon key で代替可能。logUsageEvent が service role 必須のため API Route 維持が簡潔 |
| 対応方針 | API Route 経由を維持。認証・org チェックを Route Handler 冒頭で実施済み |

### 5. `lib/usage/log.ts` — `logUsageEvent()`

| 項目 | 内容 |
|-----|------|
| 使用目的 | usage_logs への INSERT（API Route 完了後に記録） |
| anon 移行可否 | × 維持必須。ユーザーコンテキストに依存せずシステムログを記録する設計のため |
| 対応方針 | service role を維持。usage_logs の INSERT 権限は service role のみに限定 |

### 6. `lib/insights/aggregate.ts` — `aggregateProjectInsights()`

| 項目 | 内容 |
|-----|------|
| 使用目的 | aggregated_insights の UPSERT（全クライアントを横断した匿名集計） |
| anon 移行可否 | × 維持必須。複数組織をまたいだ集計のため anon key では不可能 |
| 対応方針 | service role を維持。aggregated_insights は service role のみ書き込み可能にする |

### 7. `app/admin/*.tsx`（usage / insights / feedback / ダッシュボード）

| 項目 | 内容 |
|-----|------|
| 使用目的 | platform_admin が全組織の利用ログ・インサイト・フィードバックを横断閲覧 |
| anon 移行可否 | △ 条件付き。platform_admin 用 RLS ポリシー（全 SELECT 許可）を整備すれば移行可能 |
| 対応方針 | 各ファイルにコメントで理由を明記済み。Phase 3 で RLS ポリシー整備後に検討 |

### 8. `lib/insights/get-project-benchmark.ts` — `getProjectBenchmark()`

| 項目 | 内容 |
|-----|------|
| 使用目的 | `aggregated_insights` を service role 経由で取得し `buildIndustryBenchmark()` を実行する server-only helper |
| anon 移行可否 | × 維持必須。RLS 有効化後 client key では aggregated_insights が読めないため |
| 対応方針 | `createServiceClient()` を使用し、必要な業界の集計データのみ取得して IndustryBenchmark を返す |

### 9. `app/projects/[id]/debug/page.tsx`

| 項目 | 内容 |
|-----|------|
| 使用目的 | デバッグ用画面。全チャンク・全レビューデータへのアクセスが必要 |
| anon 移行可否 | ◎ Phase 3 で RLS ポリシー整備後に createServerUserClient() に移行可能 |
| 対応方針 | TODO コメントを追記済み。Phase 3 で対応 |

---

## Step 34 で createServerUserClient() に移行したファイル

以下のファイルは `createClient()` (service role) から `createServerUserClient()` (anon key) に移行完了。
RLS 有効化後、これらのファイルは自動的に RLS ポリシーに従う。

| ファイル | 用途 |
|---------|------|
| `lib/auth/permissions.ts` | organization_members のルックアップ |
| `app/projects/page.tsx` | プロジェクト一覧表示 |
| `app/projects/[id]/page.tsx` | プロジェクト詳細・分析結果表示 |
| `app/projects/[id]/one-pager/page.tsx` | 1枚サマリー表示 |
| `app/projects/[id]/report/page.tsx` | 詳細レポート表示 |
| `app/projects/[id]/reviews/page.tsx` | レビュー一覧表示 |
| `app/compare/page.tsx` | 競合比較プロジェクト選択 |
| `app/compare/reports/[id]/page.tsx` | 比較レポート詳細表示 |
| `app/compare/reports/[id]/one-pager/page.tsx` | 比較 1枚サマリー表示 |
| `app/compare/result/page.tsx` | 比較結果表示 |
| `app/api/projects/[id]/feedback/route.ts` | プロジェクトフィードバック GET/POST |
| `app/api/projects/[id]/export-pptx/route.ts` | プロジェクト PPTX エクスポート |
| `app/api/compare/reports/[id]/feedback/route.ts` | 比較レポートフィードバック GET/POST |
| `app/api/compare/reports/[id]/export-pptx/route.ts` | 比較レポート PPTX エクスポート |

---

## RLS 有効化前に残っている課題（Step 37 時点）

1. **`lib/supabase/server.ts` の整理完了**（Step 34 完了）  
   `createClient()` を廃止し `createServerUserClient()` / `createAuthClient()` / `getCurrentUser()` に分離。✅

2. **`supabase/migrations/007_enable_rls.sql` 作成完了**（Step 37 完了）  
   `supabase/policies/001_rls_policies.sql` も最新方針に同期済み。✅

3. **✅ `aggregated_insights` アクセスの移行（Step 38 完了）**  
   `lib/insights/get-project-benchmark.ts`（server helper、`createServiceClient()` 使用）と  
   `app/api/projects/[id]/benchmark/route.ts`（API Route）を新規作成。  
   以下 3 ファイルは直接 select をやめ、server helper 経由に移行済み。  
   - `app/projects/[id]/page.tsx` → `getProjectBenchmark()` 呼び出し  
   - `app/projects/[id]/one-pager/page.tsx` → 同上  
   - `app/projects/[id]/report/page.tsx` → 同上  
   詳細方針は `docs/data-assets.md` を参照。

4. **`organization_id = NULL` レコードの確認**（本番 DB 適用前に要対応）  
   `005_add_multitenancy.sql` で大半は補完済みだが、RLS 有効化前に NULL がないことを確認する。

5. **`app/projects/[id]/debug/page.tsx` の移行**（Phase 3 で実施）  
   TODO コメント追記済み。RLS ポリシー整備後に `createServerUserClient()` に移行する。

---

## RLS 適用後の client 確認（`createServerUserClient()` 使用ファイル）

RLS 適用後、以下のファイルは自動的に RLS ポリシーに従う。
**追加のコード変更は不要**。

| ファイル | RLS 適用後の動作 |
|---------|----------------|
| `lib/auth/permissions.ts` | 自組織の organization_members のみ参照 |
| `app/projects/page.tsx` | 自組織のプロジェクト一覧のみ表示 |
| `app/projects/[id]/page.tsx` | 自組織のプロジェクトのみ表示（他組織は空返り → `notFound`） |
| `app/projects/[id]/one-pager/page.tsx` | 同上 |
| `app/projects/[id]/report/page.tsx` | 同上 |
| `app/projects/[id]/reviews/page.tsx` | 同上 |
| `app/compare/page.tsx` | 自組織のプロジェクトのみ表示 |
| `app/compare/reports/[id]/page.tsx` | 自組織のレポートのみ表示 |
| `app/compare/reports/[id]/one-pager/page.tsx` | 同上 |
| `app/compare/result/page.tsx` | 自組織のプロジェクトのみ参照可 |
| `app/api/projects/[id]/feedback/route.ts` | 自組織の feedback のみ GET/POST |
| `app/api/compare/reports/[id]/feedback/route.ts` | 同上 |
| `app/api/projects/[id]/export-pptx/route.ts` | 自組織のプロジェクトのみ取得 |
| `app/api/compare/reports/[id]/export-pptx/route.ts` | 自組織のレポートのみ取得 |
