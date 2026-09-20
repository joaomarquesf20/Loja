import Image from 'next/image'
import Link from 'next/link'
import type { CatalogCategory } from '@/server/catalog'

type StorefrontFooterProps = {
  categories: CatalogCategory[]
}

export default function StorefrontFooter({
  categories,
}: StorefrontFooterProps) {
  return (
    <footer className="border-t border-white/6 bg-[#080a0c] text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.45fr_1fr_1fr] lg:gap-16 lg:px-8 lg:py-18">
        <div>
          <Link
            href="/"
            aria-label="PFAUTOPARTS"
            className="inline-flex rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Image
              src="/brand/pfautoparts-logo-horizontal.png"
              alt=""
              width={256}
              height={42}
              className="h-auto w-[170px]"
            />
          </Link>

          <p className="mt-5 max-w-sm text-sm leading-6 text-white/46">
            Jantes premium, suspensão,
            body-kits e acessórios para
            personalização automóvel.
          </p>
        </div>

        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">
            Comprar
          </h2>

          <nav className="mt-5 grid gap-3">
            {categories
              .slice(0, 5)
              .map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className="w-fit text-sm font-semibold text-white/58 transition hover:text-white"
                >
                  {category.name}
                </Link>
              ))}

            {categories.length === 0 && (
              <Link
                href="/#produtos"
                className="w-fit text-sm font-semibold text-white/58 transition hover:text-white"
              >
                Produtos
              </Link>
            )}
          </nav>
        </div>

        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">
            Conta
          </h2>

          <nav className="mt-5 grid gap-3">
            <Link
              href="/conta"
              className="w-fit text-sm font-semibold text-white/58 transition hover:text-white"
            >
              A minha conta
            </Link>

            <Link
              href="/carrinho"
              className="w-fit text-sm font-semibold text-white/58 transition hover:text-white"
            >
              Carrinho
            </Link>

            <Link
              href="/login"
              className="w-fit text-sm font-semibold text-white/58 transition hover:text-white"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </div>

      <div className="border-t border-white/6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[10px] font-medium uppercase tracking-[0.08em] text-white/24 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            © {new Date().getFullYear()} PFAutoParts
          </span>

          <span>
            Jantes · Suspensão · Body-kits · Personalização
          </span>
        </div>
      </div>
    </footer>
  )
}
