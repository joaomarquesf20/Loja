import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * Retorno do Stripe quando o utilizador abandona o Checkout sem
 * pagar. Página estática: o conteúdo não depende da sessão nem da
 * base de dados — a encomenda pendente é inscrita na área de conta.
 */
export const metadata: Metadata = {
  title: 'Pagamento cancelado',
}

export default function CheckoutCanceledPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div
        role="status"
        className="rounded-xl border border-amber-200 bg-amber-50 p-8"
      >
        <h1 className="text-2xl font-bold tracking-tight text-amber-950">
          Pagamento cancelado
        </h1>

        <p className="mt-3 text-sm text-amber-900">
          O pagamento não foi concluído, por isso
          a encomenda não ficou paga. Não
          perdeste nada: podes voltar à loja
          quando quiseres.
        </p>

        <p className="mt-2 text-sm text-amber-900">
          A encomenda criada antes do
          redirecionamento ficou registada como
          pendente na tua conta, onde podes
          acompanhar o seu estado.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Continuar a comprar
          </Link>

          <Link
            href="/carrinho"
            className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-100"
          >
            Voltar ao carrinho
          </Link>

          <Link
            href="/conta"
            className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-100"
          >
            Ver as minhas encomendas
          </Link>
        </div>
      </div>
    </main>
  )
}
