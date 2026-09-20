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
}

const navLinkClass =
  'whitespace-nowrap py-3 text-xs font-black uppercase tracking-[0.08em] text-white/70 transition hover:text-white focus:outline-none focus-visible:text-white focus-visible:underline focus-visible:decoration-brand focus-visible:decoration-2 focus-visible:underline-offset-8'

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
    <header className="sticky top-0 z-50 bg-accent text-white shadow-[0_1px_0_rgba(255,255,255,0.08)]">
      <div className="border-b border-white/8 bg-black/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45 sm:px-6 lg:px-8">
          <span>
            Styling · Performance · Aftermarket
          </span>
          <span className="hidden sm:inline">
            PFAutoParts
          </span>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:gap-5 lg:px-8">
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

          <span className="hidden text-sm font-black tracking-[0.11em] sm:inline">
            PFAUTO
            <span className="text-brand">
              PARTS
            </span>
          </span>
        </Link>

        <form
          action="/"
          method="get"
          role="search"
          className="relative min-w-0"
        >
          <SearchIcon />

          <input
            type="search"
            name="q"
            aria-label="Pesquisar produtos"
            placeholder="Pesquisar produtos, marcas ou categorias..."
            className="h-10 w-full rounded-xl border border-white/10 bg-white px-10 py-2 text-sm font-medium text-foreground outline-none placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/25"
          />

          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-brand px-3 py-1.5 text-xs font-black text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Pesquisar
          </button>
        </form>

        <div className="flex items-center justify-end gap-1.5">
          {status === 'loading' ? (
            <span className="hidden px-2 text-xs font-semibold text-white/55 lg:inline">
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
                className="hidden max-w-36 items-center gap-2 truncate rounded-lg px-2.5 py-2 text-sm font-bold text-white/70 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:inline-flex"
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
                className="hidden rounded-lg px-2 py-2 text-xs font-bold text-white/50 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60 xl:inline-flex"
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
                className="hidden rounded-lg px-2 py-2 text-xs font-bold text-white/50 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand xl:inline-flex"
              >
                Criar conta
              </Link>

              <Link
                href="/login"
                className="hidden items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-white/75 transition hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:inline-flex"
              >
                <UserIcon />
                Entrar
              </Link>
            </>
          )}

          <Link
            href="/carrinho"
            aria-label="Carrinho"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-black text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
        className="border-t border-white/8"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-4 sm:px-6 lg:px-8">
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
