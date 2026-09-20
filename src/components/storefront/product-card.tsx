import Image from 'next/image'
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
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#f0f1ef]">
        <div
          aria-hidden="true"
          className="size-28 rounded-full border-[18px] border-slate-300/50"
        />

        <span className="absolute bottom-4 text-xs font-bold uppercase tracking-[0.12em] text-muted">
          Imagem em breve
        </span>
      </div>
    )
  }

  return (
    <div className="aspect-square overflow-hidden bg-[#f0f1ef]">
      <Image
        src={image}
        alt=""
        width={520}
        height={520}
        loading="lazy"
        unoptimized={!image.startsWith('/')}
        className="h-full w-full object-contain p-6 transition duration-300 group-hover:scale-[1.035]"
      />
    </div>
  )
}

export default function ProductCard({
  product,
}: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-950/6">
      <Link
        href={`/produtos/${product.slug}`}
        aria-label={`Ver ${product.name}`}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        <ProductImage
          product={product}
        />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex min-h-5 items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.09em]">
          <span className="truncate text-brand">
            {product.brand?.name ??
              'PFAutoParts'}
          </span>

          <span className="truncate text-muted">
            {product.category.name}
          </span>
        </div>

        <Link
          href={`/produtos/${product.slug}`}
          className="mt-3 line-clamp-2 rounded-sm text-base font-extrabold leading-snug tracking-tight text-foreground transition hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {product.name}
        </Link>

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
            className="rounded-xl bg-accent px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Ver produto
          </Link>
        </div>
      </div>
    </article>
  )
}
