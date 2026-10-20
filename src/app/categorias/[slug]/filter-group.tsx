import Link from 'next/link'

import CollapsibleFilterSection from './collapsible-filter-section'

export type FilterGroupOption = {
  key: string
  label: string
  productCount: number
  selected: boolean
  href?: string
}

type FilterGroupProps = {
  title: string
  options: FilterGroupOption[]
  clearHref?: string
  emptyHint?: string
  /** Secções com muitos valores começam colapsadas. */
  defaultOpen?: boolean
}

/**
 * Grupo de opções de filtro com o número de produtos
 * correspondente a cada opção (dados reais do catálogo).
 * Opções sem correspondência ficam desativadas em vez de
 * terem links, para não levar a uma combinação impossível.
 * A secção é colapsável: o cabeçalho abre/fecha a lista.
 */
export default function FilterGroup({
  title,
  options,
  clearHref,
  emptyHint,
  defaultOpen = true,
}: FilterGroupProps) {
  if (options.length === 0) {
    return null
  }

  const activeCount = options.filter(
    (option) => option.selected,
  ).length

  return (
    <CollapsibleFilterSection
      title={title}
      activeCount={activeCount}
      defaultOpen={defaultOpen}
    >
      {clearHref && (
        <div className="mb-2 flex justify-end">
          <Link
            href={clearHref}
            className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/34 transition hover:text-white"
          >
            Limpar
          </Link>
        </div>
      )}

      {emptyHint && (
        <p className="mt-2 text-xs leading-5 text-white/36">
          {emptyHint}
        </p>
      )}

      <div className="grid gap-1">
        {options.map((option) => {
          const isUnavailable =
            option.productCount === 0 &&
            !option.selected

          const className =
            `flex items-center justify-between gap-3 rounded-sm py-1.5 text-sm font-semibold transition ${
              isUnavailable
                ? 'cursor-not-allowed text-white/24'
                : 'text-white/62 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
            }`

          const content = (
            <>
              <span>{option.label}</span>

              <span className="flex items-center gap-2">
                <span className="text-xs font-medium tabular-nums text-white/28">
                  {option.productCount}
                </span>

                <span
                  aria-hidden="true"
                  className={`grid size-4 place-items-center rounded-[2px] border text-[10px] leading-none ${
                    option.selected
                      ? 'border-brand bg-brand text-white'
                      : 'border-white/24 text-transparent'
                  }`}
                >
                  ✓
                </span>
              </span>
            </>
          )

          if (
            isUnavailable ||
            !option.href
          ) {
            return (
              <span
                key={option.key}
                className={className}
                aria-disabled="true"
                title="Sem produtos para esta opção com os filtros atuais"
              >
                {content}
              </span>
            )
          }

          return (
            <Link
              key={option.key}
              href={option.href}
              className={className}
            >
              {content}
            </Link>
          )
        })}
      </div>
    </CollapsibleFilterSection>
  )
}
