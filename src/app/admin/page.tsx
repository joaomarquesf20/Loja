import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/server/auth'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    notFound()
  }

  return (
    <div>
      <h1>PFAUTOPARTS Admin</h1>
      <p>Sessão autenticada.</p>
      <p>ID: {session.user.id}</p>
      <p>Role: {session.user.role}</p>
    </div>
  )
}