import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'
import CommercialSettingsClient from './commercial-settings-client'

export default async function CommercialSettingsPage() {
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
      <section className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/admin"
            className="text-sm font-medium text-gray-600 hover:text-black"
          >
            ← Administração
          </Link>

          <h1 className="mt-3 text-2xl font-bold">
            Configuração comercial
          </h1>

          <p className="mt-2 max-w-3xl text-gray-600">
            Gerir IVA, disponibilidade do
            checkout e regras de transporte
            para Portugal Continental.
          </p>
        </div>

        <CommercialSettingsClient />
      </section>
    </main>
  )
}
