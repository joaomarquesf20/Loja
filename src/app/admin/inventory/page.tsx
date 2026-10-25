import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'
import LogoutButton from '../logout-button'
import InventoryClient from './inventory-client'

export default async function AdminInventoryPage() {
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
            Inventário
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Consulte o stock por variante, acompanhe os
            alertas de stock baixo e corrija rupturas
            sem sair do ecrã.
          </p>
        </div>

        <LogoutButton />
      </section>

      <InventoryClient />
    </main>
  )
}
