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
      <div className="relative flex aspect-[6/5] items-center justify-center overflow-hidden bg-[#171a1d]">
        <div
          aria-hidden="true"
          className="size-28 rounded-full border-[16px] border-white/8"
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
      className="aspect-[6/5] bg-[#171a1d] bg-contain bg-center bg-no-repeat transition duration-300 group-hover:scale-[1.015]"
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

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <div className="flex min-h-4 items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.09em]">
          {product.brand ? (
            <span className="truncate text-white/42">
              {product.brand.name}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}

          <StockBadge
            inStock={product.inStock}
          />
        </div>

        <Link
          href={`/produtos/${product.slug}`}
          className="mt-2.5 min-h-[2.75rem] line-clamp-2 rounded-sm text-[15px] font-bold leading-[1.45] text-white/88 transition hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {product.name}
        </Link>

        <div className="mt-auto pt-5">
          <Price
            value={product.price}
            className="text-xl font-black tracking-tight text-white"
          />

          <div className="mt-4 grid grid-cols-[1fr_auto] items-stretch gap-2.5">
            <Link
              href={`/produtos/${product.slug}`}
              className="inline-flex min-h-9 items-center justify-center rounded-sm border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/62 transition hover:border-white/25 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
