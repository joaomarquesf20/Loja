'use client'

import {
  useRouter,
  useSearchParams,
} from 'next/navigation'
import type { CatalogSort } from '@/server/catalog'

type CategorySortControlProps = {
  categorySlug: string
  value?: CatalogSort
}

export default function CategorySortControl({
  categorySlug,
  value,
}: CategorySortControlProps) {
  const router = useRouter()
  const searchParams =
    useSearchParams()

  function handleChange(
    nextValue: string,
  ) {
    const params =
      new URLSearchParams(
        searchParams.toString(),
      )

    if (nextValue) {
      params.set('sort', nextValue)
    } else {
      params.delete('sort')
    }

    const query = params.toString()

    router.push(
      query
        ? `/categorias/${categorySlug}?${query}`
        : `/categorias/${categorySlug}`,
    )
  }

  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-[10px] font-black uppercase tracking-[0.08em] text-white/36 sm:inline">
        Ordenar
      </span>

      <select
        aria-label="Ordenar produtos"
        value={value ?? ''}
        onChange={(event) =>
          handleChange(
            event.target.value,
          )
        }
        className="h-10 max-w-[12.5rem] rounded-sm border border-white/10 bg-[#15181b] px-3 text-xs font-bold text-white/72 outline-none focus:border-brand/60 sm:max-w-none"
      >
        <option value="">
          Nome: A–Z
        </option>
        <option value="name-desc">
          Nome: Z–A
        </option>
        <option value="price-asc">
          Preço: menor para maior
        </option>
        <option value="price-desc">
          Preço: maior para menor
        </option>
      </select>
    </label>
  )
}
