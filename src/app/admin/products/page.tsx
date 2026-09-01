import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/server/auth'
import LogoutButton from '../logout-button'
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
    <main className="p-6">
      <section className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <LogoutButton />
      </section>

      <ProductsClient />
    </main>
  )
}