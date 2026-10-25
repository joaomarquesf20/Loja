import type { Metadata } from 'next'

import { CheckoutSuccessClient } from './sucesso-client'

/**
 * O conteúdo depende da query string do retorno do Stripe
 * (order + session_id) e da sessão do utilizador, por isso o
 * segmento é declarado como dinâmico: o build deixa de tentar
 * prerender estático.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Compra concluída',
}

export default function CheckoutSuccessPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-950">
        Compra concluída
      </h1>

      <div className="mt-8">
        <CheckoutSuccessClient />
      </div>
    </main>
  )
}
