'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  signOut,
  useSession,
} from 'next-auth/react'
import { useState } from 'react'

type HeaderCategory = {
  name: string
  slug: string
}

type SiteHeaderProps = {
  categories?: HeaderCategory[]
  commercialMessage?: string | null
}

const navLinkClass =
  'whitespace-nowrap py-3 text-[11px] font-black uppercase tracking-[0.09em] text-white/62 transition hover:text-white focus:outline-none focus-visible:text-white'

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m15 15 4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

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

export default function SiteHeader({
  categories = [],
  commercialMessage = null,
}: SiteHeaderProps) {
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
    <header className="sticky top-0 z-50 bg-[#0b0d0f] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]">
      {commercialMessage && (
        <div className="border-b border-white/7 bg-black/30">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/48 sm:px-6 lg:px-8">
            {commercialMessage}
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:gap-5 lg:px-8">
        <Link
          href="/"
          aria-label="PFAUTOPARTS"
          className="flex shrink-0 items-center rounded-sm px-0.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className="text-sm font-black uppercase tracking-[0.16em] sm:text-[15px]">
            <span className="text-white">
              PFAUTO
            </span>
            <span className="text-brand">
              PARTS
            </span>
          </span>
        </Link>

        <form
          action="/#produtos"
          method="get"
          role="search"
          className="relative min-w-0 justify-self-stretch lg:max-w-xl lg:justify-self-end"
        >
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>

          <input
            type="search"
            name="q"
            aria-label="Pesquisar produtos"
            placeholder="Pesquisar produtos, marcas ou categorias..."
            className="h-10 w-full rounded-md border border-white/12 bg-[#171a1d] px-9 pr-20 text-sm font-medium text-white outline-none placeholder:text-white/30 focus:border-brand/70 focus:ring-1 focus:ring-brand/40"
          />

          <button
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-white/7 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white/68 transition hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Procurar
          </button>
        </form>

        <div className="flex items-center justify-end gap-1">
          {status === 'loading' ? (
            <span className="hidden px-2 text-xs text-white/40 xl:inline">
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
                  className="grid size-9 place-items-center rounded text-white/48 transition hover:bg-white/7 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <AdminIcon />
                </Link>
              )}

              <Link
                href="/conta"
                className="hidden max-w-36 items-center gap-2 truncate rounded px-2 py-2 text-sm font-bold text-white/62 transition hover:bg-white/7 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:inline-flex"
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
                className="hidden rounded px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/35 transition hover:bg-white/7 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 xl:inline-flex"
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
                className="hidden rounded px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/35 transition hover:bg-white/7 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand xl:inline-flex"
              >
                Criar conta
              </Link>

              <Link
                href="/login"
                className="hidden items-center gap-2 rounded px-2 py-2 text-sm font-bold text-white/62 transition hover:bg-white/7 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:inline-flex"
              >
                <UserIcon />
                Entrar
              </Link>
            </>
          )}

          <Link
            href="/carrinho"
            aria-label="Carrinho"
            className="inline-flex items-center gap-2 rounded-md border border-brand/45 bg-brand/10 px-3 py-2.5 text-sm font-black text-brand transition hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <CartIcon />
            <span className="hidden xl:inline">
              Carrinho
            </span>
          </Link>
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        className="border-t border-white/7 bg-black/15"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {categories.length > 0 ? (
            categories.map(
              (category) => (
                <Link
                  key={
                    category.slug
                  }
                  href={`/categorias/${category.slug}`}
                  className={
                    navLinkClass
                  }
                >
                  {category.name}
                </Link>
              ),
            )
          ) : (
            <Link
              href="/#categorias"
              className={navLinkClass}
            >
              Categorias
            </Link>
          )}

          <Link
            href="/#marcas"
            className={navLinkClass}
          >
            Marcas
          </Link>
        </div>
      </nav>
    </header>
  )
}
