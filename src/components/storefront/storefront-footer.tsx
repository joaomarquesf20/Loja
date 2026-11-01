import Image from 'next/image'
import Link from 'next/link'
import type { CatalogCategory } from '@/server/catalog'

import {
  DEFAULT_LOGO_URL_DARK,
  DEFAULT_STORE_NAME,
} from '@/lib/brand-defaults'

import FooterSessionLink from './footer-session-link'

type StorefrontFooterProps = {
  categories: CatalogCategory[]
  storeName?: string
  logoUrl?: string
  /** Descrição curta mostrada na coluna da marca. */
  tagline?: string
}

export default function StorefrontFooter({
  categories,
  storeName = DEFAULT_STORE_NAME,
  logoUrl = DEFAULT_LOGO_URL_DARK,
  tagline = 'Catálogo de peças e acessórios automóvel.',
}: StorefrontFooterProps) {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.45fr_1fr_1fr] lg:gap-16 lg:px-8 lg:py-18">
        <div>
          <Link
            href="/"
            aria-label={storeName}
            className="inline-flex rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <Image
              src={logoUrl}
              alt=""
              width={256}
              height={42}
              className="h-auto w-[170px]"
            />
          </Link>

          <p className="mt-5 max-w-sm text-sm leading-6 text-gray-500">
            {tagline}
          </p>
        </div>

        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-900">
            Comprar
          </h2>

          <nav className="mt-5 grid gap-3">
            {categories
              .slice(0, 5)
              .map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className="w-fit text-sm font-semibold text-gray-600 transition hover:text-gray-900"
                >
                  {category.name}
                </Link>
              ))}

            {categories.length === 0 && (
              <Link
                href="/#produtos"
                className="w-fit text-sm font-semibold text-gray-600 transition hover:text-gray-900"
              >
                Produtos
              </Link>
            )}
          </nav>
        </div>

        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-900">
            Conta
          </h2>

          <nav className="mt-5 grid gap-3">
            <Link
              href="/conta"
              className="w-fit text-sm font-semibold text-gray-600 transition hover:text-gray-900"
            >
              A minha conta
            </Link>

            <Link
              href="/carrinho"
              className="w-fit text-sm font-semibold text-gray-600 transition hover:text-gray-900"
            >
              Carrinho
            </Link>

            <FooterSessionLink />
          </nav>
        </div>
      </div>

      <div className="border-t border-gray-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[10px] font-medium uppercase tracking-[0.08em] text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            © {new Date().getFullYear()}{' '}
            {storeName}
          </span>

          <span>
            Peças · Acessórios · Compatibilidade por veículo
          </span>
        </div>
      </div>
    </footer>
  )
}
