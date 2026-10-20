import Link from 'next/link'

import { listCartItems } from '@/server/cart'
import {
  requireActiveUserId,
  UnauthorizedUserError,
} from '@/server/user-auth'

import { CheckoutClient } from './checkout-client'

/**
 * Verifica no servidor se o carrinho da sessão está vazio.
 * Sem sessão devolve false: o cliente redireciona para o login.
 */
async function isAuthenticatedCartEmpty() {
  try {
    const userId =
      await requireActiveUserId()

    const items =
      await listCartItems(userId)

    return items.length === 0
  } catch (error) {
    if (
      error instanceof
      UnauthorizedUserError
    ) {
      return false
    }

    console.error(
      'Checkout cart check failed:',
      error,
    )

    return false
  }
}

export default async function CheckoutPage() {
  const cartIsEmpty =
    await isAuthenticatedCartEmpty()

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
        {cartIsEmpty ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-950">
              O carrinho está vazio
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Adiciona produtos ao carrinho antes de
              finalizar a compra.
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Ver produtos
            </Link>
          </div>
        ) : (
          <CheckoutClient />
        )}
      </div>
    </main>
  )
}