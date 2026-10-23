'use client'

import {
  useState,
  type ReactNode,
} from 'react'

type CollapsibleFilterSectionProps = {
  title: ReactNode
  /** Número de valores ativos dentro da secção (mostrado no cabeçalho). */
  activeCount?: number
  /** Secções com poucos valores começam abertas; as longas começam fechadas. */
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * Secção de filtros em acordeão: o cabeçalho expande/colapsa a lista
 * de valores. Mantém a interação dos catálogos de jantes de referência
 * — DIÂMETRO, FURAÇÃO, LARGURA... com contagem no cabeçalho — sem
 * perder acessibilidade (botão real, aria-expanded).
 */
export default function CollapsibleFilterSection({
  title,
  activeCount = 0,
  defaultOpen = true,
  children,
}: CollapsibleFilterSectionProps) {
  const [isOpen, setIsOpen] = useState(
    defaultOpen,
  )

  return (
    <section className="border-t border-white/8 pt-3">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38 transition group-hover:text-white/60">
            {title}
          </span>

          {activeCount > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-black text-white">
              {activeCount}
            </span>
          )}
        </span>

        <span
          aria-hidden="true"
          className={`text-xs text-white/34 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="pb-3">
          {children}
        </div>
      )}
    </section>
  )
}
