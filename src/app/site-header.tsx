'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  signOut,
  useSession,
} from 'next-auth/react'
import { useState } from 'react'

const navLinkClass =
  'rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

const actionClass =
  'rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:border-slate-300 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

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
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 text-foreground backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/"
            aria-label="PFAUTOPARTS"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg bg-brand text-xs font-black text-white"
            >
              PF
            </span>

            <span className="text-sm font-black tracking-[0.1em]">
              PFAUTO
              <span className="text-brand">
                PARTS
              </span>
            </span>
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 lg:flex"
          >
            <Link
              href="/#categorias"
              className={navLinkClass}
            >
              Peças Auto
            </Link>

            <Link
              href="/#produtos"
              className={navLinkClass}
            >
              Catálogo
            </Link>
          </nav>
        </div>

        <div className="flex items-center justify-end gap-2">
          {status === 'loading' ? (
            <span className="hidden px-2 text-sm text-muted sm:inline">
              A verificar sessão…
            </span>
          ) : user ? (
            <>
              {user.role ===
                'ADMIN' && (
                <Link
                  href="/admin"
                  className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:inline-flex"
                >
                  Administração
                </Link>
              )}

              <Link
                href="/conta"
                className="hidden max-w-40 truncate rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex"
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
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
              >
                {isSigningOut
                  ? 'A sair…'
                  : 'Sair'}
              </button>

              {signOutError && (
                <span
                  role="alert"
                  className="sr-only"
                >
                  {signOutError}
                </span>
              )}
            </>
          ) : (
            <>
              <Link
                href="/registar"
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:inline-flex"
              >
                Criar conta
              </Link>

              <Link
                href="/login"
                className={actionClass}
              >
                Entrar
              </Link>
            </>
          )}

          <Link
            href="/carrinho"
            className="rounded-xl bg-accent px-3.5 py-2 text-sm font-bold text-white transition hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Carrinho
          </Link>
        </div>
      </div>

      <nav
        aria-label="Navegação da loja em ecrã pequeno"
        className="border-t border-line lg:hidden"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          <Link
            href="/#categorias"
            className={navLinkClass}
          >
            Peças Auto
          </Link>

          <Link
            href="/#produtos"
            className={navLinkClass}
          >
            Catálogo
          </Link>

          {user && (
            <Link
              href="/conta"
              className={navLinkClass}
            >
              Conta
            </Link>
          )}

        </div>
      </nav>
    </header>
  )
}
