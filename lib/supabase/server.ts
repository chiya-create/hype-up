import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import type { User } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// createServerUserClient
// ---------------------------------------------------------------------------
// anon key + ユーザーセッション（Cookie）でアクセスする通常クライアント。
// RLS 有効化後はこのクライアントが RLS ポリシーに従ってデータを返す。
//
// 【Server Component から呼ぶ場合は必ずこちらを使うこと】
//   Next.js の Server Component では cookies() は読み取り専用のため、
//   setAll は try/catch で握りつぶしている。セッション書き込みは行われないが
//   クラッシュを防ぐ。JWT リフレッシュが必要な場合は middleware または
//   Route Handler で行う設計にすること。
// ---------------------------------------------------------------------------
export async function createServerUserClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component では cookies を変更できないため無視する。
            // "Cookies can only be modified in a Server Action or Route Handler"
            // が発生しても処理を継続させる。
          }
        },
      },
    }
  )
}

// ---------------------------------------------------------------------------
// createAuthClient
// ---------------------------------------------------------------------------
// anon key + Cookie 書き込み対応クライアント。
//
// 【Route Handler / Server Action からのみ呼ぶこと】
//   signInWithOtp / exchangeCodeForSession / signOut の呼び出し専用。
//   setAll に try/catch がないため、Server Component から呼ぶと
//   "Cookies can only be modified in a Server Action or Route Handler" が発生する。
//   → Server Component での認証チェックには createServerUserClient を使うこと。
// ---------------------------------------------------------------------------
export async function createAuthClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Route Handler / Server Action 専用なので setAll で Cookie を書き込める
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------
// 現在のセッションユーザーを返す。未ログインなら null。
//
// Server Component / Route Handler / Server Action のどこから呼んでも安全なよう
// createServerUserClient（setAll: try/catch あり）を使う。
// JWT リフレッシュが必要な場合でも Cookie 書き込みエラーでクラッシュしない。
// ---------------------------------------------------------------------------
export async function getCurrentUser(): Promise<User | null> {
  // createAuthClient ではなく createServerUserClient を使う。
  // 理由: createAuthClient の setAll は try/catch がないため、Server Component から
  // 呼ばれた際に JWT refresh が走ると Cookie 書き込みエラーが発生するため。
  const supabase = await createServerUserClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
