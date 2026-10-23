import Link from 'next/link'
import type { CatalogCategory } from '@/server/catalog'

type EditorialCardProps = {
  category: CatalogCategory
  image?: string | null
}

export default function EditorialCard({
  category,
  image,
}: EditorialCardProps) {
  return (
    <Link
      href={`/categorias/${category.slug}`}
      className="group relative isolate block min-h-[22rem] overflow-hidden rounded-sm bg-[#15181b] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {image && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-[1.02]"
          style={{
            backgroundImage: `url("${image}")`,
          }}
        />
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,10,11,0.9)_0%,rgba(8,10,11,0.7)_42%,rgba(8,10,11,0.2)_78%,rgba(8,10,11,0.08)_100%)]"
      />

      <div className="relative flex min-h-[22rem] max-w-2xl flex-col justify-center p-8 sm:p-11 lg:p-12">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">
          Personalização automóvel
        </p>

        <h3 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-[2.65rem]">
          {category.name}.
          <span className="block text-white/72">
            Mais presença. Mais identidade.
          </span>
        </h3>

        <p className="mt-4 max-w-md text-sm leading-6 text-white/58">
          Explora a categoria e encontra
          componentes para definir o visual,
          a postura e a identidade do teu
          projeto.
        </p>

        <span className="mt-5 w-fit border-b border-brand pb-1 text-xs font-black uppercase tracking-[0.1em]">
          Explorar categoria
        </span>
      </div>
    </Link>
  )
}
