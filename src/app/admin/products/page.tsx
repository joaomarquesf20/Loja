import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/server/auth'
import ProductsClient from './products-client'

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    notFound()
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef5b2a]">
            Comercial
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Produtos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687078]">
            Gere cada modelo como um produto e
            mantenha as suas configurações como
            variantes.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/products/import"
            className="rounded-lg border border-black/12 bg-white px-5 py-3 text-center text-sm font-black text-[#171a1d] shadow-sm transition hover:border-black/30"
          >
            Importar catálogo
          </Link>

          <Link
            href="/admin/products/new"
            className="rounded-lg bg-[#ef5b2a] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#d94a1b]"
          >
            + Novo produto
          </Link>
        </div>
      </header>

      <ProductsClient />
    </main>
  )
}