import { createServerUserClient, getCurrentUser } from '@/lib/supabase/server'
import type { OrganizationRole } from '@/lib/constants'
import type { User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserProfile = {
  id: string
  email: string | undefined
  organizations: Array<{
    organization_id: string
    role: OrganizationRole
  }>
}

export type OrgInfo = {
  id: string
  name: string
  plan: string
  status: string
}

export type AccessContext = {
  user: User | null
  organizations: OrgInfo[]
  activeOrganizationId: string | null
  /** 正規化済みロール (client_owner | client_member | platform_admin | null) */
  role: OrganizationRole | null
  isAdmin: boolean
  isAuthenticated: boolean
}

// ---------------------------------------------------------------------------
// Role normalization
// ---------------------------------------------------------------------------

/**
 * 旧ロール名が残っていても新ロールに変換する。
 * 旧ロール → 新ロール マッピング（既存データ互換）:
 *   owner  → client_owner
 *   member → client_member
 *   admin  → platform_admin
 *   viewer → client_member（安全側に倒す）
 */
export function normalizeRole(role: string | null | undefined): OrganizationRole | null {
  switch (role) {
    case 'client_owner':
    case 'client_member':
    case 'platform_admin':
      return role as OrganizationRole
    // Legacy role mappings
    case 'owner':
      return 'client_owner'
    case 'member':
      return 'client_member'
    case 'admin':
      return 'platform_admin'
    case 'viewer':
      return 'client_member'
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Role predicate helpers
// ---------------------------------------------------------------------------

/** client_owner / client_member かどうか */
export function isClientRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'client_owner' || normalized === 'client_member'
}

/** platform_admin かどうか */
export function isPlatformAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'platform_admin'
}

/** プロジェクト編集が可能か（client_owner / client_member / platform_admin） */
export function canEditProject(role: string | null | undefined): boolean {
  return normalizeRole(role) !== null
}

/** 分析実行が可能か */
export function canAnalyze(role: string | null | undefined): boolean {
  return normalizeRole(role) !== null
}

/** エクスポートが可能か */
export function canExport(role: string | null | undefined): boolean {
  return normalizeRole(role) !== null
}

/** 競合比較の作成が可能か */
export function canCreateComparison(role: string | null | undefined): boolean {
  return normalizeRole(role) !== null
}

// ---------------------------------------------------------------------------
// Core helper: access context
// ---------------------------------------------------------------------------

/**
 * 現在のログインユーザーの認証・組織コンテキストを返す。
 * - 未ログイン: isAuthenticated=false
 * - email 一致で user_id が null の organization_members があれば自動補完
 * - 複数 organization がある場合は最初の org を activeOrganizationId とする
 * - role は normalizeRole() で正規化
 */
export async function getCurrentUserAccessContext(): Promise<AccessContext> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      user: null,
      organizations: [],
      activeOrganizationId: null,
      role: null,
      isAdmin: false,
      isAuthenticated: false,
    }
  }

  const supabase = await createServerUserClient()

  // user_id または email で organization_members を検索
  const orFilter = user.email
    ? `user_id.eq.${user.id},email.eq.${user.email}`
    : `user_id.eq.${user.id}`

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('id, organization_id, role, user_id, email')
    .or(orFilter)
    .order('created_at')

  // email 一致で user_id が null の行を補完
  const toUpdate = (memberships ?? []).filter(
    (m) => m.user_id === null && m.email === user.email
  )
  if (toUpdate.length > 0) {
    await supabase
      .from('organization_members')
      .update({ user_id: user.id })
      .in('id', toUpdate.map((m) => m.id))
  }

  const orgIds = [...new Set((memberships ?? []).map((m) => m.organization_id))]

  let organizations: OrgInfo[] = []
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, plan, status')
      .in('id', orgIds)
    organizations = (orgs ?? []) as OrgInfo[]
  }

  const firstMembership = (memberships ?? [])[0]
  const activeOrganizationId = firstMembership?.organization_id ?? null
  const role = normalizeRole(firstMembership?.role) ?? null

  return {
    user,
    organizations,
    activeOrganizationId,
    role,
    isAdmin: isPlatformAdmin(role),
    isAuthenticated: true,
  }
}

// ---------------------------------------------------------------------------
// Access guards (throw redirect / return error response info)
// ---------------------------------------------------------------------------

/**
 * 未ログインなら /login にリダイレクト。
 * Server Component から呼ぶ場合に使用。
 */
export async function requireAuth(): Promise<AccessContext> {
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    redirect('/login')
  }
  return ctx
}

/**
 * クライアント側画面へのアクセス権限チェック。
 * - ログイン済み
 * - activeOrganizationId が存在する
 * - role が client_owner / client_member / platform_admin のいずれか
 * platform_admin は検証・運営用としてクライアント画面も利用可能。
 * 条件を満たさない場合は /login にリダイレクト。
 */
export async function requireClientAccess(): Promise<AccessContext> {
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    redirect('/login')
  }
  if (!ctx.activeOrganizationId || ctx.role === null) {
    redirect('/login?error=no_organization')
  }
  return ctx
}

/**
 * Platform Admin 専用ページのアクセス権限チェック。
 * platform_admin のみ許可。それ以外はアクセス不可を示す AccessContext を返す。
 * （Server Component でガード UI を表示するため redirect ではなく返り値で制御）
 */
export async function requirePlatformAdminAccess(): Promise<
  { allowed: true; ctx: AccessContext } | { allowed: false; isAuthenticated: boolean }
> {
  const ctx = await getCurrentUserAccessContext()
  if (!ctx.isAuthenticated) {
    return { allowed: false, isAuthenticated: false }
  }
  if (!isPlatformAdmin(ctx.role)) {
    return { allowed: false, isAuthenticated: true }
  }
  return { allowed: true, ctx }
}

// ---------------------------------------------------------------------------
// Granular helpers (kept for compatibility)
// ---------------------------------------------------------------------------

/** 現在のログインユーザーのプロフィールと所属組織一覧を返す。未ログインなら null */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createServerUserClient()
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)

  return {
    id: user.id,
    email: user.email,
    organizations: (memberships ?? []).map((m) => ({
      organization_id: m.organization_id,
      role: normalizeRole(m.role) ?? 'client_member',
    })),
  }
}

/** 指定ユーザーが所属する組織一覧を返す */
export async function getUserOrganizations(userId: string) {
  const supabase = await createServerUserClient()
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
  return data ?? []
}

/** 指定ユーザーの指定組織でのロールを返す（正規化済み）。メンバーでなければ null */
export async function getUserRoleInOrganization(
  userId: string,
  organizationId: string
): Promise<OrganizationRole | null> {
  const supabase = await createServerUserClient()
  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single()
  return data ? normalizeRole(data.role) : null
}
