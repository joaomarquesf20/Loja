'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  signOut,
  useSession,
} from 'next-auth/react'
import {
  useEffect,
  useRef,
  useState,
} from 'react'

type HeaderCategory = {
  name: string
  slug: string
}

type SiteHeaderProps = {
  categories?: HeaderCategory[]
  commercialMessage?: string | null
}

/**
 * Cabeçalho técnico de loja de peças: barra central de pesquisa
 * proeminente, cluster compacto de conta/carrinho à direita e
 * navegação por categorias reais (sem links genéricos esparsos).
 */
const navLinkClass =
  'whitespace-nowrap py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-gray-600 transition hover:text-gray-900 focus:outline-none focus-visible:text-gray-900 focus-visible:ring-2 focus-visible:ring-brand'

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

  const accountTriggerRef =
    useRef<HTMLButtonElement>(null)
  const accountMenuRef =
    useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return
    }

    const menu = accountMenuRef.current

    menu
      ?.querySelector<HTMLElement>(
        'a, button:not([disabled])',
      )
      ?.focus()

    function onKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false)

        accountTriggerRef.current?.focus()
      }
    }

    function onPointerDown(
      event: PointerEvent,
    ) {
      if (
        !menu?.contains(
          event.target as Node,
        ) &&
        !accountTriggerRef.current?.contains(
          event.target as Node,
        )
      ) {
        setIsAccountMenuOpen(false)
      }
    }

    window.addEventListener(
      'keydown',
      onKeyDown,
    )
    window.addEventListener(
      'pointerdown',
      onPointerDown,
    )

    return () => {
      window.removeEventListener(
        'keydown',
        onKeyDown,
      )
      window.removeEventListener(
        'pointerdown',
        onPointerDown,
      )
    }
  }, [isAccountMenuOpen])

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
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white text-gray-900">
      {commercialMessage && (
        <div className="bg-brand text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-1.5 text-[11px] font-semibold tracking-[0.025em] sm:px-6 lg:px-8">
            {commercialMessage}
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-[auto_auto] items-center gap-x-3 gap-y-2.5 px-4 py-2.5 sm:px-6 md:grid-cols-[210px_minmax(320px,1fr)_auto] lg:gap-x-6 lg:px-8">
        <Link
          href="/"
          aria-label="PFAUTOPARTS"
          className="flex w-fit shrink-0 items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
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
          className="order-3 col-span-2 flex h-11 min-w-0 overflow-hidden rounded-md border border-gray-300 bg-white transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 md:order-none md:col-span-1"
        >
          <span className="pointer-events-none grid w-11 shrink-0 place-items-center text-gray-400">
            <SearchIcon />
          </span>

          <input
            type="search"
            name="q"
            aria-label="Pesquisar produtos"
            placeholder="Pesquisar produtos, referências ou marcas..."
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
          />

          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center bg-brand px-4 text-[11px] font-black uppercase tracking-[0.09em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:px-6"
          >
            Pesquisar
          </button>
        </form>

        <div className="relative flex items-center justify-end gap-1.5">
          {status === 'loading' ? (
            <span className="hidden px-2 text-xs text-gray-500 xl:inline">
              A verificar sessão…
            </span>
          ) : user ? (
            <div className="relative">
              <button
                ref={accountTriggerRef}
                type="button"
                aria-label="Conta"
                aria-haspopup="menu"
                aria-expanded={
                  isAccountMenuOpen
                }
                onClick={() =>
                  setIsAccountMenuOpen(
                    (current) =>
                      !current,
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <UserIcon />
                <span className="hidden lg:inline">
                  Conta
                </span>
                <ChevronIcon />
              </button>

              {isAccountMenuOpen && (
                <div
                  ref={accountMenuRef}
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-md border border-gray-200 bg-white p-1.5 shadow-xl shadow-gray-900/10"
                >
                  <div className="border-b border-gray-100 px-3 py-2.5">
                    <p className="truncate text-xs font-black text-gray-900">
                      {accountLabel}
                    </p>
                    {user.email && (
                      <p className="mt-0.5 truncate text-[10px] text-gray-500">
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
                    role="menuitem"
                    className="mt-1 flex items-center rounded px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
                  >
                    {accountLabel}
                  </Link>

                  {user.role ===
                    'ADMIN' && (
                    <Link
                      href="/admin"
                      role="menuitem"
                      className="flex items-center rounded px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
                    >
                      Administração
                    </Link>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={
                      handleSignOut
                    }
                    disabled={
                      isSigningOut
                    }
                    className="flex w-full items-center rounded px-3 py-2 text-left text-sm font-bold text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
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
                className="hidden rounded px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand xl:inline-flex"
              >
                Criar conta
              </Link>

              <Link
                href="/login"
                className="hidden items-center gap-2 rounded px-2.5 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:inline-flex"
              >
                <UserIcon />
                Entrar
              </Link>
            </>
          )}

          <Link
            href="/carrinho"
            aria-label="Carrinho"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-brand/50 bg-brand/5 px-3 text-sm font-black text-brand transition hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
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
        className="border-t border-gray-200 bg-gray-50"
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
        </div>
      </nav>
    </header>
  )
}
