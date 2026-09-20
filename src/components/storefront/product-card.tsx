import Link from 'next/link'
import type { CatalogProduct } from '@/server/catalog'
import AddToCartButton from '@/app/produtos/[slug]/add-to-cart-button'
import Price from './price'
import StockBadge from './stock-badge'

type ProductCardProps = {
  product: CatalogProduct
}

function ProductImage({
  product,
}: ProductCardProps) {
  const image = product.images[0]

  if (!image) {
    return (
      <div className="relative flex aspect-[5/4] items-center justify-center overflow-hidden bg-[#171a1d]">
        <div
          aria-hidden="true"
          className="size-24 rounded-full border-[14px] border-white/8"
        />

        <span className="absolute bottom-4 text-[10px] font-bold uppercase tracking-[0.12em] text-white/24">
          Imagem em breve
        </span>
      </div>
    )
  }

  return (
    <div
      role="img"
      aria-label={product.name}
      className="aspect-[5/4] bg-[#171a1d] bg-contain bg-center bg-no-repeat transition duration-300 group-hover:scale-[1.02]"
      style={{
        backgroundImage: `url("${image}")`,
      }}
    />
  )
}

export default function ProductCard({
  product,
}: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-sm bg-[#111315] ring-1 ring-white/6 transition hover:ring-white/12">
      <Link
        href={`/produtos/${product.slug}`}
        aria-label={`Ver ${product.name}`}
        className="block overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ProductImage
          product={product}
        />
      </Link>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <div className="flex min-h-4 items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.09em]">
          <span className="truncate text-white/42">
            {product.brand?.name ??
              'PFAutoParts'}
          </span>

          <StockBadge
            inStock={product.inStock}
          />
        </div>

        <Link
          href={`/produtos/${product.slug}`}
          className="mt-2.5 line-clamp-2 rounded-sm text-[15px] font-bold leading-snug text-white/88 transition hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {product.name}
        </Link>

        <div className="mt-auto pt-4">
          <Price
            value={product.price}
            className="text-lg font-black tracking-tight text-white"
          />

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <Link
              href={`/produtos/${product.slug}`}
              className="inline-flex items-center justify-center rounded-sm border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/62 transition hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Ver produto
            </Link>

            <AddToCartButton
              productId={product.id}
              inStock={product.inStock}
              variant="compact"
            />
          </div>
        </div>
      </div>
    </article>
  )
}
