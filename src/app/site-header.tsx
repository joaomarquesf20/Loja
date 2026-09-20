'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  signOut,
  useSession,
} from 'next-auth/react'
import { useState } from 'react'

const navLinkClass =
  'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
    >
      <path
        d="M3.5 5h2l1.7 9h9.9l2-6.5H7M9 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
    >
      <path
        d="M12 3.5 19 7v5c0 4.2-2.8 7-7 8.5C7.8 19 5 16.2 5 12V7l7-3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12 11 13.5l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
    <header className="sticky top-0 z-50 bg-accent text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="PFAUTOPARTS"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-lg bg-brand text-xs font-black text-white"
          >
            PF
          </span>

          <span className="text-sm font-black tracking-[0.11em]">
            PFAUTO
            <span className="text-brand">
              PARTS
            </span>
          </span>
        </Link>

        <nav
          aria-label="Navegação principal"
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
        >
          <Link
            href="/#categorias"
            className={navLinkClass}
          >
            Categorias
          </Link>

          <Link
            href="/#produtos"
            className={navLinkClass}
          >
            Produtos
          </Link>

          <Link
            href="/#marcas"
            className={navLinkClass}
          >
            Marcas
          </Link>
        </nav>

        <div className="flex items-center justify-end gap-1.5">
          {status === 'loading' ? (
            <span className="hidden px-2 text-xs font-semibold text-white/55 sm:inline">
              A verificar sessão…
            </span>
          ) : user ? (
            <>
              {user.role ===
                'ADMIN' && (
                <Link
                  href="/admin"
                  aria-label="Administração"
                  title="Administração"
                  className="grid size-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <AdminIcon />
                </Link>
              )}

              <Link
                href="/conta"
                className="hidden max-w-40 items-center gap-2 truncate rounded-lg px-2.5 py-2 text-sm font-bold text-white/70 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex"
                title={
                  user.email ??
                  undefined
                }
              >
                <UserIcon />
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
                className="hidden rounded-lg px-2.5 py-2 text-xs font-bold text-white/55 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
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
                className="hidden rounded-lg px-2.5 py-2 text-xs font-bold text-white/55 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:inline-flex"
              >
                Criar conta
              </Link>

              <Link
                href="/login"
                className="hidden items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-bold text-white/75 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex"
              >
                <UserIcon />
                Entrar
              </Link>
            </>
          )}

          <Link
            href="/carrinho"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-black text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <CartIcon />
            <span className="hidden sm:inline">
              Carrinho
            </span>
          </Link>
        </div>
      </div>

      <nav
        aria-label="Navegação da loja em ecrã pequeno"
        className="border-t border-white/8 lg:hidden"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
          <Link
            href="/#categorias"
            className={navLinkClass}
          >
            Categorias
          </Link>

          <Link
            href="/#produtos"
            className={navLinkClass}
          >
            Produtos
          </Link>

          <Link
            href="/#marcas"
            className={navLinkClass}
          >
            Marcas
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
