import Link from 'next/link'
import { BarChart3, Building2, ShieldAlert, LogIn, ChevronRight, Plus } from 'lucide-react'
// service role を使用: platform_admin が全組織を横断管理するため RLS バイパスが必要
import { createServiceClient } from '@/lib/supabase/service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { requirePlatformAdminAccess } from '@/lib/auth/permissions'
import { createOrganization } from './actions'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default async function AdminOrganizationsPage() {
  const access = await requirePlatformAdminAccess()

  if (!access.allowed) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4 py-16 text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold">アクセスできません</h1>
          <p className="text-sm text-muted-foreground">
            このページは Platform Admin 権限で保護されています。
            {access.isAuthenticated ? 'アクセス権限がありません。' : 'ログインが必要です。'}
          </p>
          <Link
            href={access.isAuthenticated ? '/' : '/login'}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
          >
            <LogIn className="h-4 w-4" />
            {access.isAuthenticated ? 'トップページへ' : 'ログイン'}
          </Link>
        </div>
      </div>
    )
  }

  const supabase = createServiceClient()

  const [{ data: orgs }, { data: allMembers }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, plan, status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('organization_members').select('organization_id'),
  ])

  const orgList = orgs ?? []

  const memberCountMap = (allMembers ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.organization_id] = (acc[row.organization_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ヘッダー */}
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Platform Admin 権限で保護されています。
        </div>

        {/* タイトル */}
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">組織管理</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{orgList.length} 組織</p>
          </div>
        </div>

        {/* 組織一覧 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            組織一覧
          </h2>
          {orgList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                まだ組織がありません
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2.5 font-medium">名前</th>
                        <th className="text-left px-4 py-2.5 font-medium">プラン</th>
                        <th className="text-left px-4 py-2.5 font-medium">ステータス</th>
                        <th className="text-right px-4 py-2.5 font-medium whitespace-nowrap">
                          メンバー数
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">
                          作成日
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orgList.map((org) => (
                        <tr key={org.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{org.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {org.plan}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={org.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {org.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-xs">
                            {memberCountMap[org.id] ?? 0}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(org.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/organizations/${org.id}`}
                              className="flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                            >
                              詳細 <ChevronRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* 新規組織作成 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            新規組織作成
          </h2>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                組織を作成
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={createOrganization}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    組織名 <span className="text-destructive">*</span>
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="例: Acme Corp"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">プラン</label>
                  <select
                    name="plan"
                    defaultValue="free"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="free">free</option>
                    <option value="starter">starter</option>
                    <option value="pro">pro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">ステータス</label>
                  <select
                    name="status"
                    defaultValue="active"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
                  >
                    <Plus className="h-4 w-4" />
                    組織を作成
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
