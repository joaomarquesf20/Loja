'use client'

import Image from 'next/image'
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

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-3.5"
      fill="none"
    >
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
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

  const [
    isAccountMenuOpen,
    setIsAccountMenuOpen,
  ] = useState(false)

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

      <div className="mx-auto grid max-w-7xl grid-cols-[auto_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 md:grid-cols-[210px_minmax(320px,1fr)_auto] lg:gap-x-6 lg:px-8">
        <Link
          href="/"
          aria-label="PFAUTOPARTS"
          className="flex w-fit shrink-0 items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Image
            src="/brand/pfautoparts-logo-horizontal.png"
            alt=""
            width={256}
            height={42}
            priority
            className="h-auto w-[158px] sm:w-[188px]"
          />
        </Link>

        <form
          action="/#produtos"
          method="get"
          role="search"
          className="order-3 col-span-2 flex h-11 min-w-0 overflow-hidden rounded-md border border-white/12 bg-[#171a1d] transition focus-within:border-brand/65 focus-within:ring-1 focus-within:ring-brand/35 md:order-none md:col-span-1"
        >
          <span className="pointer-events-none grid w-10 shrink-0 place-items-center text-white/34">
            <SearchIcon />
          </span>

          <input
            type="search"
            name="q"
            aria-label="Pesquisar produtos"
            placeholder="Pesquisar produtos, marcas ou categorias..."
            className="min-w-0 flex-1 bg-transparent px-0 py-2 text-sm font-medium text-white outline-none placeholder:text-white/28"
          />

          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center border-l border-white/10 px-4 text-[10px] font-black uppercase tracking-[0.09em] text-white/58 transition hover:bg-brand hover:text-white focus:outline-none focus-visible:bg-brand focus-visible:text-white sm:px-5"
          >
            Pesquisar
          </button>
        </form>

        <div className="relative flex items-center justify-end gap-1.5">
          {status === 'loading' ? (
            <span className="hidden px-2 text-xs text-white/40 xl:inline">
              A verificar sessão…
            </span>
          ) : user ? (
            <div className="relative">
              <button
                type="button"
                aria-label="Conta"
                aria-expanded={
                  isAccountMenuOpen
                }
                onClick={() =>
                  setIsAccountMenuOpen(
                    (current) =>
                      !current,
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-sm font-bold text-white/64 transition hover:bg-white/7 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <UserIcon />
                <span className="hidden lg:inline">
                  Conta
                </span>
                <ChevronIcon />
              </button>

              {isAccountMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-md border border-white/10 bg-[#15181b] p-1.5 shadow-2xl shadow-black/45"
                >
                  <div className="border-b border-white/8 px-3 py-2.5">
                    <p className="truncate text-xs font-black text-white/88">
                      {accountLabel}
                    </p>
                    {user.email && (
                      <p className="mt-0.5 truncate text-[10px] text-white/38">
                        {user.email}
                      </p>
                    )}
                  </div>

                  <Link
                    href="/conta"
                    title={
                      user.email ??
                      undefined
                    }
                    className="mt-1 flex items-center rounded px-3 py-2 text-sm font-bold text-white/64 transition hover:bg-white/7 hover:text-white"
                  >
                    {accountLabel}
                  </Link>

                  {user.role ===
                    'ADMIN' && (
                    <Link
                      href="/admin"
                      className="flex items-center rounded px-3 py-2 text-sm font-bold text-white/64 transition hover:bg-white/7 hover:text-white"
                    >
                      Administração
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={
                      handleSignOut
                    }
                    disabled={
                      isSigningOut
                    }
                    className="flex w-full items-center rounded px-3 py-2 text-left text-sm font-bold text-white/48 transition hover:bg-white/7 hover:text-white disabled:opacity-50"
                  >
                    {isSigningOut
                      ? 'A sair…'
                      : 'Sair'}
                  </button>
                </div>
              )}

              {signOutError && (
                <span
                  role="alert"
                  className="sr-only"
                >
                  {signOutError}
                </span>
              )}
            </div>
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
                className="hidden items-center gap-2 rounded px-2.5 py-2 text-sm font-bold text-white/62 transition hover:bg-white/7 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex"
              >
                <UserIcon />
                Entrar
              </Link>
            </>
          )}

          <Link
            href="/carrinho"
            aria-label="Carrinho"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-brand/45 bg-brand/10 px-3 text-sm font-black text-brand transition hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8">
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
