import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'
import LogoutButton from '../logout-button'
import CouponsClient from './coupons-client'

export default async function AdminCouponsPage() {
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
            Cupões
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Cria cupões de desconto, acompanha
            as utilizações e ativa ou desativa
            promoções sem sair do ecrã.
          </p>
        </div>

        <LogoutButton />
      </section>

      <CouponsClient />
    </main>
  )
}
