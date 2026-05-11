'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePlatformAdminAccess } from '@/lib/auth/permissions'

// ---------------------------------------------------------------------------
// createOrganization
// ---------------------------------------------------------------------------

export async function createOrganization(formData: FormData) {
  const access = await requirePlatformAdminAccess()
  if (!access.allowed) throw new Error('Unauthorized')

  const name = (formData.get('name') as string | null)?.trim()
  const plan = (formData.get('plan') as string | null) ?? 'free'
  const status = (formData.get('status') as string | null) ?? 'active'

  if (!name) throw new Error('名前を入力してください')

  const supabase = createServiceClient()
  const { error } = await supabase.from('organizations').insert({ name, plan, status })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/organizations')
}

// ---------------------------------------------------------------------------
// addOrUpdateMember
// ---------------------------------------------------------------------------
// 同一 organization_id + email が存在する場合は role を更新（upsert）
// 存在しない場合は新規 INSERT。user_id は NULL のまま（初回ログイン時に自動補完される）

export async function addOrUpdateMember(formData: FormData) {
  const access = await requirePlatformAdminAccess()
  if (!access.allowed) throw new Error('Unauthorized')

  const organizationId = formData.get('organization_id') as string
  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase()
  const role = (formData.get('role') as string | null) ?? 'client_member'

  if (!email.includes('@')) throw new Error('有効なメールアドレスを入力してください')
  if (!organizationId) throw new Error('organization_id が未指定です')

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('organization_members')
    .upsert(
      { organization_id: organizationId, email, role },
      { onConflict: 'organization_id,email', ignoreDuplicates: false }
    )

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/organizations/${organizationId}`)
}

// ---------------------------------------------------------------------------
// updateMemberRole
// ---------------------------------------------------------------------------

export async function updateMemberRole(formData: FormData) {
  const access = await requirePlatformAdminAccess()
  if (!access.allowed) throw new Error('Unauthorized')

  const memberId = formData.get('member_id') as string
  const organizationId = formData.get('organization_id') as string
  const role = formData.get('role') as string

  if (!memberId || !role) throw new Error('パラメーターが不正です')

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/organizations/${organizationId}`)
}
