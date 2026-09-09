'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  signOut,
  useSession,
} from 'next-auth/react'
import { useState } from 'react'

export default function SiteHeader() {
  const pathname = usePathname()

  const {
    data: session,
    status,
  } = useSession()

  const [
    isSigningOut,
    setIsSigningOut,
  ] = useState(false)

  const [
    signOutError,
    setSignOutError,
  ] = useState<string | null>(
    null,
  )

  if (
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  ) {
    return null
  }

  const user =
    status === 'authenticated'
      ? session?.user
      : null

  const accountLabel =
    user?.name?.trim() ||
    user?.email?.trim() ||
    'Conta'

  async function handleSignOut() {
    setSignOutError(null)
    setIsSigningOut(true)

    try {
      await signOut({
        callbackUrl: '/',
      })
    } catch {
      setIsSigningOut(false)

      setSignOutError(
        'Não foi possível terminar a sessão.',
      )
    }
  }

  return (
    <header className="border-b bg-background text-foreground">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-sm font-bold tracking-[0.2em] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
        >
          PFAUTOPARTS
        </Link>

        <nav
          aria-label="Navegação principal"
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <Link
            href="/carrinho"
            className="rounded-lg border px-3 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
          >
            Carrinho
          </Link>

          {status === 'loading' ? (
            <span className="px-2 text-sm text-neutral-500">
              A verificar sessão…
            </span>
          ) : user ? (
            <>
              {user.role ===
                'ADMIN' && (
                <Link
                  href="/admin"
                  className="rounded-lg border px-3 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
                >
                  Administração
                </Link>
              )}

              <Link
                href="/conta"
                className="max-w-48 truncate rounded-lg px-2 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:text-neutral-400 dark:hover:bg-neutral-900"
                title={
                  user.email ??
                  undefined
                }
              >
                {accountLabel}
              </Link>

              <button
                type="button"
                onClick={
                  handleSignOut
                }
                disabled={
                  isSigningOut
                }
                className="rounded-lg border px-3 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-neutral-900"
              >
                {isSigningOut
                  ? 'A sair…'
                  : 'Sair'}
              </button>

              {signOutError && (
                <span
                  role="alert"
                  className="text-sm text-red-700 dark:text-red-400"
                >
                  {signOutError}
                </span>
              )}
            </>
          ) : (
            <>
              <Link
                href="/registar"
                className="rounded-lg border px-3 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
              >
                Criar conta
              </Link>

              <Link
                href="/login"
                className="rounded-lg border px-3 py-2 text-sm font-semibold transition hover:border-neutral-500 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 dark:hover:bg-neutral-900"
              >
                Entrar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
