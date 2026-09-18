'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  signOut,
  useSession,
} from 'next-auth/react'
import { useState } from 'react'

const navigationLinkClass =
  'rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const secondaryActionClass =
  'rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold transition hover:border-foreground/25 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background'

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
    <header className="sticky top-0 z-50 border-b border-line bg-background">
      <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            aria-label="PFAUTOPARTS"
            className="group flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-xl bg-brand text-sm font-black tracking-tight text-white shadow-sm transition group-hover:bg-brand-strong"
            >
              PF
            </span>

            <span className="leading-none">
              <span className="block text-sm font-black tracking-[0.12em]">
                PFAUTO
                <span className="text-brand">
                  PARTS
                </span>
              </span>

              <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-muted sm:block">
                Peças automóveis
              </span>
            </span>
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 md:flex"
          >
            <Link
              href="/#categorias"
              className={navigationLinkClass}
            >
              Categorias
            </Link>

            <Link
              href="/#produtos"
              className={navigationLinkClass}
            >
              Catálogo
            </Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/carrinho"
            className="rounded-xl bg-foreground px-3.5 py-2 text-sm font-bold text-background transition hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Carrinho
          </Link>

          {status === 'loading' ? (
            <span className="px-2 text-sm text-muted">
              A verificar sessão…
            </span>
          ) : user ? (
            <>
              {user.role ===
                'ADMIN' && (
                <Link
                  href="/admin"
                  className={secondaryActionClass}
                >
                  Administração
                </Link>
              )}

              <Link
                href="/conta"
                className="max-w-48 truncate rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                className={secondaryActionClass}
              >
                {isSigningOut
                  ? 'A sair…'
                  : 'Sair'}
              </button>

              {signOutError && (
                <span
                  role="alert"
                  className="basis-full text-right text-sm font-medium text-red-700 dark:text-red-400"
                >
                  {signOutError}
                </span>
              )}
            </>
          ) : (
            <>
              <Link
                href="/registar"
                className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
              >
                Criar conta
              </Link>

              <Link
                href="/login"
                className={secondaryActionClass}
              >
                Entrar
              </Link>
            </>
          )}
        </div>

        <nav
          aria-label="Navegação da loja em ecrã pequeno"
          className="flex w-full items-center gap-1 border-t border-line pt-2 md:hidden"
        >
          <Link
            href="/#categorias"
            className={navigationLinkClass}
          >
            Categorias
          </Link>

          <Link
            href="/#produtos"
            className={navigationLinkClass}
          >
            Catálogo
          </Link>
        </nav>
      </div>
    </header>
  )
}
