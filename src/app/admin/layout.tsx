import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'
import type { ReactNode } from 'react'

import { authOptions } from '@/server/auth'
import {
  getPublicStoreBranding,
} from '@/server/branding-settings'
import AdminBreadcrumb from './admin-breadcrumb'
import AdminNavigation from './admin-navigation'
import LogoutButton from './logout-button'

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const session =
    await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    notFound()
  }

  // Identidade da loja configurada no backoffice — o
  // backoffice apresenta o mesmo nome que a vitrine.
  const branding =
    await getPublicStoreBranding()

  return (
    <div className="min-h-screen bg-[#f4f4f2]">
      <div className="border-b border-black/8 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/admin"
            className="text-lg font-black tracking-tight"
          >
            {branding.storeName}
            <span className="ml-2 text-xs font-bold uppercase tracking-[0.12em] text-brand">
              Admin
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/products/new"
              className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-strong"
            >
              + Novo produto
            </Link>
            <Link
              href="/"
              target="_blank"
              className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-semibold transition hover:border-black/30"
            >
              Ver loja ↗
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <AdminNavigation />
        </aside>

        <div className="min-w-0 space-y-5">
          <AdminBreadcrumb />
          {children}
        </div>
      </div>
    </div>
  )
}
