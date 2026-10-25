import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'
import {
  getAdminUserById,
} from '@/server/admin-users'
import UserDetailClient, {
  type AdminUserDetailClientData,
} from './user-detail-client'

type AdminUserDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
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

  const { id } =
    await params

  const user =
    await getAdminUserById(
      id,
    )

  if (!user) {
    notFound()
  }

  const initialUser:
    AdminUserDetailClientData = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive:
      user.isActive,
    createdAt:
      user.createdAt.toISOString(),
    ordersCount:
      user.ordersCount,
    totalExpenditure:
      user.totalExpenditure,
    orders:
      user.orders.map(
        (order) => ({
          ...order,
          createdAt:
            order.createdAt.toISOString(),
        }),
      ),
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin/users"
            className="text-sm font-bold text-[#ef5b2a] underline"
          >
            ← Voltar aos
            clientes
          </Link>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Ficha de cliente
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687078]">
            Perfil, despesa e histórico
            de encomendas do utilizador.
          </p>
        </div>
      </section>

      <UserDetailClient
        initialUser={
          initialUser
        }
        currentUserId={
          session.user
            .id ?? ''
        }
      />
    </main>
  )
}
