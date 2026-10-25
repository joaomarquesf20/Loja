import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'
import UsersClient from './users-client'

export default async function AdminUsersPage() {
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
    <main className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef5b2a]">
            Comercial
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Clientes
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687078]">
            Consulta as contas registadas
            e gere papéis e estado de
            atividade de cada utilizador.
          </p>
        </div>
      </header>

      <UsersClient />
    </main>
  )
}
