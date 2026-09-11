import Link from 'next/link'

import { CheckoutClient } from './checkout-client'

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/carrinho"
        className="text-sm font-medium text-gray-600 hover:text-gray-950"
      >
        ← Voltar ao carrinho
      </Link>

      <div className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">
          Finalizar compra
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Confirma a morada de entrega e calcula o
          total antes de criares a encomenda.
        </p>
      </div>

      <div className="mt-8">
        <CheckoutClient />
      </div>
    </main>
  )
}