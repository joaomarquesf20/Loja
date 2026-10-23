import Link from 'next/link'
import type { CatalogCategory } from '@/server/catalog'

type CategoryCardProps = {
  category: CatalogCategory
  image?: string | null
}

/**
 * Mosaico de categoria do catálogo técnico: cartão branco com
 * borda definida, imagem em fundo branco quando existe e seta
 * com acento de marca; sem imagem, gradiente neutro claro.
 */
export default function CategoryCard({
  category,
  image,
}: CategoryCardProps) {
  return (
    <Link
      href={`/categorias/${category.slug}`}
      className="group relative isolate block min-h-40 overflow-hidden rounded-md border border-gray-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      {image && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{
            backgroundImage: `url("${image}")`,
          }}
        />
      )}

      {!image && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(145deg,#f9fafb_0%,#eceef1_100%)]"
        />
      )}

      <div
        aria-hidden="true"
        className={`absolute inset-0 ${
          image
            ? 'bg-gradient-to-t from-black/70 via-black/20 to-transparent'
            : ''
        }`}
      />

      <div className="relative flex h-full min-h-40 items-end justify-between gap-4 p-4">
        <h3
          className={`text-sm font-black uppercase tracking-[0.07em] ${
            image ? 'text-white' : 'text-gray-900'
          }`}
        >
          {category.name}
        </h3>

        <span
          className={`text-lg font-light transition group-hover:translate-x-1 group-hover:text-brand ${
            image ? 'text-white/60' : 'text-gray-400'
          }`}
        >
          →
        </span>
      </div>
    </Link>
  )
}
