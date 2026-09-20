import Link from 'next/link'
import type { CatalogCategory } from '@/server/catalog'

type CategoryCardProps = {
  category: CatalogCategory
  image?: string | null
}

export default function CategoryCard({
  category,
  image,
}: CategoryCardProps) {
  return (
    <Link
      href={`/categorias/${category.slug}`}
      className="group relative isolate min-h-44 overflow-hidden bg-[#15181b] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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

      <div
        aria-hidden="true"
        className={`absolute inset-0 ${
          image
            ? 'bg-gradient-to-t from-black/90 via-black/18 to-transparent'
            : 'bg-[radial-gradient(circle_at_70%_30%,rgba(239,91,42,0.35),transparent_24%),linear-gradient(145deg,#24292d_0%,#111315_72%)]'
        }`}
      />

      <div className="relative flex h-full min-h-44 items-end justify-between gap-4 p-4">
        <h3 className="text-sm font-black uppercase tracking-[0.07em]">
          {category.name}
        </h3>

        <span className="text-lg font-light text-white/55 transition group-hover:translate-x-1 group-hover:text-brand">
          →
        </span>
      </div>
    </Link>
  )
}
