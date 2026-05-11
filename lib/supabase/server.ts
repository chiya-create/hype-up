import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import type { User } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// createServerUserClient
// ---------------------------------------------------------------------------
// anon key + ユーザーセッション（Cookie）でアクセスする通常クライアント。
// RLS 有効化後はこのクライアントが RLS ポリシーに従ってデータを返す。
// サーバーコンポーネント・API Route の通常 DB 操作に使用する。
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
            // Server Component コンテキストではクッキーが読み取り専用になる場合がある
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
// signInWithOtp / exchangeCodeForSession / signOut 専用。
// セッションクッキーの読み書きが必要なため setAll でエラーをスローしない。
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
// createAuthClient を使って auth.getUser() で JWT を検証する。
// ---------------------------------------------------------------------------
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
