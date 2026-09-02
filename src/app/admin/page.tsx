import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'

import { authOptions } from '@/server/auth'
import LogoutButton from './logout-button'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    notFound()
  }

  return (
    <main className="p-6">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Administração PFAUTOPARTS
            </h1>

            <p className="mt-2 text-gray-600">
              Selecione uma área para gerir o catálogo.
            </p>
          </div>

          <LogoutButton />
        </div>

        <nav className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/categories"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Categorias
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Gerir categorias e hierarquia do catálogo
            </p>
          </Link>

          <Link
            href="/admin/products"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Produtos
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Gerir produtos do catálogo
            </p>
          </Link>

          <Link
            href="/admin/product-brands"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Marcas de produtos
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Gerir marcas dos produtos do catálogo
            </p>
          </Link>

          <Link
            href="/admin/vehicle-brands"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Marcas de veículos
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Gerir marcas usadas na compatibilidade de veículos.
            </p>
          </Link>
        </nav>
      </section>
    </main>
  )
}