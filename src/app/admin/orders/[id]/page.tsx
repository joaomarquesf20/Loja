import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'
import {
  getAdminOrderById,
} from '@/server/admin-orders'
import LogoutButton from '../../logout-button'
import OrderDetailClient, {
  type AdminOrderDetailClientData,
} from './order-detail-client'

type AdminOrderDetailPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function AdminOrderDetailPage({
  params,
}: AdminOrderDetailPageProps) {
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

  const order =
    await getAdminOrderById(
      id,
    )

  if (!order) {
    notFound()
  }

  const initialOrder:
    AdminOrderDetailClientData = {
    ...order,
    createdAt:
      order.createdAt.toISOString(),
    updatedAt:
      order.updatedAt.toISOString(),
  }

  return (
    <main className="p-6">
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Voltar às encomendas
          </Link>

          <h1 className="mt-2 text-2xl font-bold">
            Ficha da encomenda
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Artigos, destino, pagamento e dados comerciais guardados no momento da compra.
          </p>
        </div>

        <LogoutButton />
      </section>

      <OrderDetailClient
        initialOrder={
          initialOrder
        }
      />
    </main>
  )
}
