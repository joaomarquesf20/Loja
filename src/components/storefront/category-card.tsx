import Link from 'next/link'
import type { CatalogCategory } from '@/server/catalog'

type CategoryCardProps = {
  category: CatalogCategory
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
}: CategoryCardProps) {
  return (
    <Link
      href={`/categorias/${category.slug}`}
      className="group flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-lg hover:shadow-slate-950/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div>
        <p className="text-base font-extrabold tracking-tight text-foreground">
          {category.name}
        </p>

        {category.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">
            {category.description}
          </p>
        )}
      </div>

      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-background text-muted transition group-hover:border-brand group-hover:bg-brand group-hover:text-white">
        <ArrowIcon />
      </span>
    </Link>
  )
}
