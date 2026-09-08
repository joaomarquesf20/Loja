import Link from 'next/link'
import { CartClient } from './cart-client'

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm font-medium text-gray-600 hover:text-gray-950"
        >
          ← Continuar a comprar
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-950">
          Carrinho
        </h1>
      </div>

      <CartClient />
    </main>
  )
}
