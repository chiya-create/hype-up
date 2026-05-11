import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  BarChart3,
  Building2,
  ShieldAlert,
  LogIn,
  Users,
  FolderOpen,
  UserPlus,
} from 'lucide-react'
// service role を使用: platform_admin が全組織のメンバー・プロジェクトを横断管理するため
import { createServiceClient } from '@/lib/supabase/service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { requirePlatformAdminAccess } from '@/lib/auth/permissions'
import { addOrUpdateMember, updateMemberRole } from '../actions'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const ROLE_LABEL: Record<string, string> = {
  platform_admin: 'Platform Admin',
  client_owner: 'Client Owner',
  client_member: 'Client Member',
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  platform_admin: 'default',
  client_owner: 'secondary',
  client_member: 'outline',
}

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

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

  const [{ data: org }, { data: members }, { data: projects }] = await Promise.all([
    supabase.from('organizations').select('id, name, plan, status, created_at').eq('id', id).single(),
    supabase
      .from('organization_members')
      .select('id, user_id, email, role, created_at')
      .eq('organization_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('projects')
      .select('id, name, status, review_count, created_at')
      .eq('organization_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!org) notFound()

  const memberList = members ?? []
  const projectList = projects ?? []

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ヘッダー */}
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/admin"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              href="/admin/organizations"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              組織管理
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Platform Admin 権限で保護されています。
        </div>

        {/* 組織情報 */}
        <div className="flex items-start gap-4">
          <Building2 className="h-6 w-6 text-muted-foreground mt-1 shrink-0" />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {org.plan}
              </Badge>
              <Badge
                variant={org.status === 'active' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {org.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                作成日: {formatDate(org.created_at)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{org.id}</p>
          </div>
        </div>

        {/* メンバー一覧 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            メンバー ({memberList.length})
          </h2>
          {memberList.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                メンバーがいません
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2.5 font-medium">メールアドレス</th>
                        <th className="text-left px-4 py-2.5 font-medium">ロール</th>
                        <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">
                          User ID
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">
                          招待日
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium">ロール変更</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {memberList.map((member) => (
                        <tr key={member.id} className="hover:bg-muted/20 transition-colors align-middle">
                          <td className="px-4 py-3 text-sm">{member.email}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={ROLE_VARIANT[member.role] ?? 'outline'}
                              className="text-xs"
                            >
                              {ROLE_LABEL[member.role] ?? member.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                            {member.user_id ? (
                              <span title={member.user_id}>
                                {member.user_id.slice(0, 8)}…
                              </span>
                            ) : (
                              <span className="text-amber-500">未ログイン</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(member.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <form action={updateMemberRole} className="flex items-center gap-2">
                              <input type="hidden" name="member_id" value={member.id} />
                              <input type="hidden" name="organization_id" value={id} />
                              <select
                                name="role"
                                defaultValue={member.role}
                                className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="client_member">client_member</option>
                                <option value="client_owner">client_owner</option>
                                <option value="platform_admin">platform_admin</option>
                              </select>
                              <button
                                type="submit"
                                className={cn(
                                  buttonVariants({ variant: 'outline', size: 'sm' }),
                                  'text-xs h-7 px-2'
                                )}
                              >
                                更新
                              </button>
                            </form>
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

        {/* メンバー追加 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            メンバーを招待
          </h2>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                メールアドレスで招待（既存の場合はロールを更新）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={addOrUpdateMember}
                className="flex flex-col sm:flex-row gap-3 items-end"
              >
                <input type="hidden" name="organization_id" value={id} />
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    メールアドレス <span className="text-destructive">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="user@example.com"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5 sm:w-44">
                  <label className="text-xs font-medium text-muted-foreground">ロール</label>
                  <select
                    name="role"
                    defaultValue="client_member"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="client_member">client_member</option>
                    <option value="client_owner">client_owner</option>
                    <option value="platform_admin">platform_admin</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 shrink-0')}
                >
                  <UserPlus className="h-4 w-4" />
                  招待
                </button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* プロジェクト一覧 */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            プロジェクト ({projectList.length})
          </h2>
          {projectList.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                プロジェクトがありません
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
                        <th className="text-left px-4 py-2.5 font-medium">ステータス</th>
                        <th className="text-right px-4 py-2.5 font-medium whitespace-nowrap">
                          レビュー数
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">
                          作成日
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {projectList.map((project) => (
                        <tr key={project.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <Link
                              href={`/projects/${project.id}`}
                              className="hover:underline text-primary"
                            >
                              {project.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                project.status === 'done'
                                  ? 'default'
                                  : project.status === 'error'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className="text-xs"
                            >
                              {project.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-xs">
                            {(project.review_count ?? 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(project.created_at)}
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
      </main>
    </div>
  )
}
