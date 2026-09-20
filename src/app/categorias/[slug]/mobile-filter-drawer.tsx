'use client'

import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type MobileFilterDrawerProps = {
  children: ReactNode
  activeCount: number
}

export default function MobileFilterDrawer({
  children,
  activeCount,
}: MobileFilterDrawerProps) {
  const [isOpen, setIsOpen] =
    useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setIsOpen(false)
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
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-sm border border-white/10 px-3 text-xs font-black uppercase tracking-[0.08em] text-white/68 transition hover:border-white/24 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
      >
        Filtros
        {activeCount > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-brand text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() =>
              setIsOpen(false)
            }
            className="absolute inset-0 bg-black/72 backdrop-blur-[2px]"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filters-heading"
            className="absolute inset-y-0 right-0 flex w-[min(90vw,24rem)] flex-col border-l border-white/10 bg-[#0e1012] shadow-2xl shadow-black/60"
          >
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
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
                onClick={() =>
                  setIsOpen(false)
                }
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-sm text-xl text-white/54 transition hover:bg-white/6 hover:text-white"
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
