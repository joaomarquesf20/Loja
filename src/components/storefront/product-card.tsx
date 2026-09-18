import Link from 'next/link'
import type { CatalogProduct } from '@/server/catalog'
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
      <div className="flex aspect-[4/3] items-center justify-center bg-surface-muted px-5 text-center">
        <span className="text-sm font-medium text-muted">
          Sem imagem
        </span>
      </div>
    )
  }

  return (
    <div className="aspect-[4/3] overflow-hidden bg-surface-muted">
      <img
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-[1.02]"
      />
    </div>
  )
}

export default function ProductCard({
  product,
}: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-950/5">
      <Link
        href={`/produtos/${product.slug}`}
        aria-label={`Ver ${product.name}`}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        <ProductImage
          product={product}
        />
      </Link>

      <div className="flex flex-1 flex-col border-t border-line p-5">
        <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.08em]">
          {product.brand && (
            <span className="text-accent">
              {product.brand.name}
            </span>
          )}

          <span className="text-muted">
            {product.category.name}
          </span>
        </div>

        <Link
          href={`/produtos/${product.slug}`}
          className="mt-3 rounded-sm text-base font-extrabold leading-snug tracking-tight text-foreground hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {product.name}
        </Link>

        {product.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted">
            {product.description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div>
            <Price
              value={product.price}
              className="text-xl font-black tracking-tight text-foreground"
            />

            <div className="mt-1.5">
              <StockBadge
                inStock={product.inStock}
              />
            </div>
          </div>

          <Link
            href={`/produtos/${product.slug}`}
            className="rounded-xl border border-line bg-background px-3 py-2 text-xs font-bold text-foreground transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Ver produto
          </Link>
        </div>
      </div>
    </article>
  )
}
