import Link from 'next/link'
import {
  getPrimaryProductImage,
} from '@/lib/product-images'
import type { CatalogProduct } from '@/server/catalog'
import AddToCartButton from '@/app/produtos/[slug]/add-to-cart-button'
import Price from './price'
import StockBadge from './stock-badge'

type ProductCardProps = {
  product: CatalogProduct
  variant?: 'default' | 'category'
}

/**
 * Cartão técnico de catálogo: cartão branco com borda definida,
 * imagem em fundo branco puro, referência (SKU) sempre visível e
 * ação principal (Adicionar / Selecionar opções) sem depender de
 * hover. `variant` mantém-se por compatibilidade com os callers —
 * os cartões de categoria e relacionados usam o mesmo visual.
 */
export default function ProductCard({
  product,
}: ProductCardProps) {
  const image =
    getPrimaryProductImage(product)?.url

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-md border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-md hover:shadow-gray-900/5 focus-within:border-gray-300">
      <Link
        href={`/produtos/${product.slug}`}
        aria-label={`Ver ${product.name}`}
        className="block overflow-hidden bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        {image ? (
          <div
            role="img"
            aria-label={product.name}
            className="aspect-[6/5] bg-white bg-contain bg-center bg-no-repeat p-4 transition duration-300 group-hover:scale-[1.015]"
            style={{
              backgroundImage: `url("${image}")`,
            }}
          />
        ) : (
          <div className="relative flex aspect-[6/5] items-center justify-center bg-gray-50">
            <div
              aria-hidden="true"
              className="size-24 rounded-full border-[12px] border-gray-200"
            />

            <span className="absolute bottom-4 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
              Imagem em breve
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col border-t border-gray-200 px-4 pb-4 pt-3">
        <div className="flex min-h-4 items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.09em]">
          {product.brand ? (
            <span className="truncate text-gray-500">
              {product.brand.name}
            </span>
          ) : (
            <span aria-hidden="true" />
          )}

          <StockBadge
            inStock={product.inStock}
          />
        </div>

        {product.variants[0]?.sku ? (
          <p className="mt-2 truncate font-mono text-[11px] font-semibold tracking-[0.04em] text-gray-400">
            <span className="uppercase">Ref.:</span>{' '}
            {product.variants[0].sku}
          </p>
        ) : null}

        <Link
          href={`/produtos/${product.slug}`}
          className="mt-1.5 min-h-[2.5rem] line-clamp-2 rounded-sm text-[14px] font-bold leading-[1.4] text-gray-900 transition hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {product.name}
        </Link>

        <div className="mt-auto pt-4">
          <Price
            value={product.price}
            className="text-xl font-black tracking-tight text-brand"
          />

          <div className="mt-3 grid grid-cols-[1fr_auto] items-stretch gap-2">
            {product.variants.length > 1 ? (
              <Link
                href={`/produtos/${product.slug}`}
                className="inline-flex min-h-9 items-center justify-center rounded-sm bg-brand px-3 py-2 text-[10px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Selecionar opções
              </Link>
            ) : (
              <AddToCartButton
                productId={product.id}
                productVariantId={
                  product.variants[0]?.id
                }
                inStock={product.inStock}
                variant="card"
              />
            )}

            <Link
              href={`/produtos/${product.slug}`}
              className="inline-flex min-h-9 items-center justify-center rounded-sm border border-gray-300 px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-gray-600 transition hover:border-gray-400 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Ver produto
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
