import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'
import LogoutButton from '../../logout-button'
import MovementsClient from './movements-client'

export default async function AdminInventoryMovementsPage() {
  const session =
    await getServerSession(
      authOptions,
    )

  if (!session) {
    redirect('/login')
  }

  if (
    session.user.role !==
    'ADMIN'
  ) {
    notFound()
  }

  return (
    <main className="p-6">
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Voltar à administração
          </Link>

          <h1 className="mt-2 text-2xl font-bold">
            Movimentos de stock
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Histórico de todas as alterações de
            stock registadas atomicamente:
            reposições, vendas, correções
            manuais e devoluções por
            cancelamento.
          </p>
        </div>

        <LogoutButton />
      </section>

      <nav
        aria-label="Secções de inventário"
        className="mb-6 flex flex-wrap gap-2"
      >
        <Link
          href="/admin/inventory"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
        >
          Inventário
        </Link>

        <Link
          href="/admin/inventory/movements"
          aria-current="page"
          className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white"
        >
          Movimentos
        </Link>
      </nav>

      <MovementsClient />
    </main>
  )
}
