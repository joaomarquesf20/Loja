import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'
import LogoutButton from './logout-button'

export default async function AdminPage() {
  const session =
    await getServerSession(authOptions)

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
              Selecione uma área para
              gerir a loja.
            </p>
          </div>

          <LogoutButton />
        </div>

        <nav className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/orders"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Encomendas
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Acompanhar pagamentos e gerir o
              ciclo de entrega ou levantamento.
            </p>
          </Link>

          <Link
            href="/admin/categories"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Categorias
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Gerir categorias e
              hierarquia do catálogo
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
              Gerir marcas dos produtos
              do catálogo
            </p>
          </Link>

          <Link
            href="/admin/commercial-settings"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Configuração comercial
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Gerir IVA, regiões de
              checkout e regras de
              transporte.
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
              Gerir marcas usadas na
              compatibilidade de veículos.
            </p>
          </Link>

          <Link
            href="/admin/vehicle-models"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Modelos de veículos
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Gerir modelos associados às
              marcas de veículos.
            </p>
          </Link>

          <Link
            href="/admin/vehicle-generations"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Gerações de veículos
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Gerir gerações associadas
              aos modelos de veículos.
            </p>
          </Link>

          <Link
            href="/admin/vehicle-configurations"
            className="rounded-lg border p-4 transition hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold">
              Configurações de veículos
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Gerir motorizações e
              configurações associadas às
              gerações de veículos.
            </p>
          </Link>
        </nav>
      </section>
    </main>
  )
}
