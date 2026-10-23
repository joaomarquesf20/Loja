'use client'

import Link from 'next/link'

export default function Error({
  reset,
}: {
  error: Error & {
    digest?: string
  }
  reset: () => void
}) {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-gray-50 px-4 text-gray-900">
      <section className="w-full max-w-xl rounded-md border border-gray-200 bg-white px-6 py-10 sm:px-8">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          PFAutoParts
        </p>

        <h1 className="mt-3 text-2xl font-black tracking-tight">
          Não foi possível carregar o produto
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-500">
          O produto não ficou disponível
          nesta tentativa. Podes tentar
          novamente ou regressar ao catálogo.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-sm bg-brand px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Tentar novamente
          </button>

          <Link
            href="/"
            className="rounded-sm border border-gray-300 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-gray-600 transition hover:border-gray-400 hover:text-gray-900"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </section>
    </main>
  )
}
