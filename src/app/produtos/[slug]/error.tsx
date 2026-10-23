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
    <main className="grid min-h-[70vh] place-items-center bg-[#0b0d0f] px-4 text-white">
      <section className="w-full max-w-xl border border-white/8 bg-[#111315] px-6 py-10 sm:px-8">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          PFAutoParts
        </p>

        <h1 className="mt-3 text-2xl font-black tracking-tight">
          Não foi possível carregar o produto
        </h1>

        <p className="mt-3 text-sm leading-6 text-white/46">
          O produto não ficou disponível
          nesta tentativa. Podes tentar
          novamente ou regressar ao catálogo.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-sm bg-brand px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Tentar novamente
          </button>

          <Link
            href="/"
            className="rounded-sm border border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-white/62 transition hover:border-white/24 hover:text-white"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </section>
    </main>
  )
}
