'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & {
    digest?: string
  }
  reset: () => void
}) {
  // Em desenvolvimento o erro original (ficheiro, função e
  // mensagem) fica na consola — a UI genérica nunca esconde a
  // causa real de uma categoria que falha a carregar.
  useEffect(() => {
    console.error(
      '[categorias] falha ao carregar a categoria:',
      error,
    )
  }, [error])

  return (
    <main className="grid min-h-[70vh] place-items-center bg-gray-50 px-4 text-gray-900">
      <section className="w-full max-w-xl rounded-md border border-gray-200 bg-white px-6 py-10 sm:px-8">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          Catálogo PFAutoParts
        </p>

        <h1 className="mt-3 text-2xl font-black tracking-tight">
          Não foi possível carregar esta categoria
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-500">
          O catálogo não ficou disponível
          nesta tentativa. Podes voltar a
          tentar sem perder a navegação.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-sm bg-brand px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  )
}
