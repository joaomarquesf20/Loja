import Link from 'next/link'
import type { CatalogCategory } from '@/server/catalog'

type EditorialCardProps = {
  category: CatalogCategory
  image?: string | null
  featured?: boolean
}

export default function EditorialCard({
  category,
  image,
  featured = false,
}: EditorialCardProps) {
  return (
    <Link
      href={`/categorias/${category.slug}`}
      className={`group relative isolate overflow-hidden rounded-3xl bg-accent text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        featured
          ? 'min-h-[25rem] lg:row-span-2'
          : 'min-h-48'
      }`}
    >
      {image ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
          style={{
            backgroundImage: `url("${image}")`,
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(239,91,42,0.5),transparent_24%),linear-gradient(135deg,#272d32_0%,#121417_72%)]"
        />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent"
      />

      <div className="relative flex h-full min-h-[inherit] flex-col justify-end p-6 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
          PFAutoParts
        </p>

        <h3
          className={`mt-2 font-black uppercase tracking-[-0.03em] ${
            featured
              ? 'text-4xl sm:text-5xl'
              : 'text-2xl sm:text-3xl'
          }`}
        >
          {category.name}
        </h3>

        <p className="mt-2 max-w-md text-sm leading-6 text-white/70">
          Descobre a seleção e dá
          outra presença ao teu carro.
        </p>

        <span className="mt-5 inline-flex w-fit items-center border-b border-brand pb-1 text-sm font-black">
          Ver categoria
        </span>
      </div>
    </Link>
  )
}
