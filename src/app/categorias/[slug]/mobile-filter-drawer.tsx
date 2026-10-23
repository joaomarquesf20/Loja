'use client'

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type MobileFilterDrawerProps = {
  children: ReactNode
  activeCount: number
}

const drawerFocusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getDrawerFocusables(
  drawer: HTMLElement | null,
) {
  if (!drawer) {
    return []
  }

  return Array.from(
    drawer.querySelectorAll<HTMLElement>(
      drawerFocusableSelector,
    ),
  )
}

export default function MobileFilterDrawer({
  children,
  activeCount,
}: MobileFilterDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    // Guarda o gatilho para restaurar o foco ao fechar.
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const drawer = drawerRef.current
    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    getDrawerFocusables(drawer)[0]?.focus()

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setIsOpen(false)

        return
      }

      if (
        event.key !== 'Tab' ||
        !drawerRef.current
      ) {
        return
      }

      // Fecha o ciclo de foco no conteúdo do modal.
      const focusables =
        getDrawerFocusables(
          drawerRef.current,
        )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault()

        last?.focus()

        return
      }

      if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault()

        first?.focus()
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.body.style.overflow =
        previousOverflow
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )
      trigger?.focus()
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir filtros"
        className="inline-flex h-10 items-center gap-2 rounded-sm border border-gray-300 bg-white px-3 text-xs font-black uppercase tracking-[0.08em] text-gray-700 transition hover:border-gray-400 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
      >
        Filtros
        {activeCount > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-brand text-[10px] font-black text-white">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/72 backdrop-blur-[2px]"
          />

          <section
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filters-heading"
            className="absolute inset-y-0 right-0 flex w-[min(90vw,24rem)] flex-col border-l border-gray-200 bg-white shadow-2xl shadow-gray-900/20"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-brand">
                  Refina a seleção
                </p>
                <h2
                  id="mobile-filters-heading"
                  className="mt-1 text-lg font-black"
                >
                  Filtros
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-sm text-xl text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              {children}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
