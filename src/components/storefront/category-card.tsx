import Link from 'next/link'
import type { CatalogCategory } from '@/server/catalog'

type CategoryCardProps = {
  category: CatalogCategory
  image?: string | null
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
    >
      <path
        d="M4 10h12M11.5 5.5 16 10l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function CategoryCard({
  category,
  image,
}: CategoryCardProps) {
  return (
    <Link
      href={`/categorias/${category.slug}`}
      className="group relative isolate min-h-56 overflow-hidden rounded-2xl bg-accent text-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {image ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{
            backgroundImage: `url("${image}")`,
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_72%_26%,rgba(239,91,42,0.42),transparent_22%),linear-gradient(135deg,#242a30_0%,#121417_70%)]"
        />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5"
      />

      {!image && (
        <div
          aria-hidden="true"
          className="absolute right-5 top-5 size-24 rounded-full border-[14px] border-white/8"
        />
      )}

      <div className="relative flex h-full min-h-56 flex-col justify-end p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
          Explorar
        </p>

        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-black tracking-tight">
              {category.name}
            </h3>

            {category.description && (
              <p className="mt-1 line-clamp-2 max-w-xs text-sm leading-5 text-white/65">
                {category.description}
              </p>
            )}
          </div>

          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition group-hover:border-brand group-hover:bg-brand">
            <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  )
}
