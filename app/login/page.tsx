import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, Mail } from 'lucide-react'
import { createAuthClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

async function sendMagicLink(formData: FormData) {
  'use server'
  const email = formData.get('email')
  if (typeof email !== 'string' || !email.includes('@')) {
    redirect('/login?error=invalid_email')
  }
  const supabase = await createAuthClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  })
  redirect('/login?sent=1')
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const { sent, error } = await searchParams

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Hype Up AI</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold">ログイン</h1>
            <p className="text-sm text-muted-foreground">
              メールアドレスにログインリンクを送信します
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              {sent ? (
                <div className="space-y-4 text-center py-4">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-3">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">メールを送信しました</p>
                    <p className="text-sm text-muted-foreground">
                      受信トレイのログインリンクをクリックしてください。
                      <br />
                      メールが届かない場合は迷惑メールフォルダをご確認ください。
                    </p>
                  </div>
                  <Link
                    href="/login"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  >
                    別のメールアドレスで試す
                  </Link>
                </div>
              ) : (
                <form action={sendMagicLink} className="space-y-4">
                  {error === 'invalid_email' && (
                    <p className="text-sm text-destructive">
                      有効なメールアドレスを入力してください。
                    </p>
                  )}
                  {error === 'auth_failed' && (
                    <p className="text-sm text-destructive">
                      認証に失敗しました。もう一度お試しください。
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-medium">
                      メールアドレス
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <button
                    type="submit"
                    className={cn(buttonVariants({ size: 'default' }), 'w-full')}
                  >
                    ログインリンクを送信
                  </button>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            <Link href="/" className="underline hover:text-foreground">
              トップページへ戻る
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
