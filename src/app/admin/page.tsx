import Link from 'next/link'
import { getServerSession } from 'next-auth'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { authOptions } from '@/server/auth'

const areas = [
  {
    href: '/admin/products',
    title: 'Produtos',
    description:
      'Pesquisa, cria e atualiza produtos, variantes, preços, stock e estado.',
    action: 'Gerir produtos',
  },
  {
    href: '/admin/orders',
    title: 'Encomendas',
    description:
      'Acompanha pagamentos, preparações, entregas e levantamentos.',
    action: 'Ver encomendas',
  },
  {
    href: '/admin/catalog',
    title: 'Catálogo',
    description:
      'Organiza categorias comerciais e fabricantes de produtos.',
    action: 'Organizar catálogo',
  },
  {
    href: '/admin/vehicle-compatibility',
    title: 'Compatibilidade de veículos',
    description:
      'Gerir a hierarquia Marca → Modelo → Geração → Motor.',
    action: 'Gerir compatibilidade',
  },
  {
    href: '/admin/commercial-settings',
    title: 'Definições da loja',
    description:
      'Configura IVA, checkout, regiões e regras de transporte.',
    action: 'Abrir definições',
  },
]

export default async function AdminPage() {
  const session =
    await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    notFound()
  }

  return (
    <main className="space-y-7">
      <section className="flex flex-col gap-5 rounded-xl bg-[#171a1d] p-6 text-white sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef5b2a]">
            Central de administração
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Gere a loja sem lidar com
            entidades de base de dados
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60 sm:text-base">
            Começa pelo produto que precisas
            vender. As áreas abaixo regroupam o
            trabalho por objetivos da loja.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/products/new"
            className="rounded-lg bg-[#ef5b2a] px-5 py-3 text-sm font-black text-white transition hover:bg-[#d94a1b]"
          >
            + Novo produto
          </Link>
          <Link
            href="/"
            target="_blank"
            className="rounded-lg border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/8"
          >
            Ver loja ↗
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            className="group flex min-h-44 flex-col rounded-xl border border-black/8 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md"
          >
            <h2 className="text-lg font-black tracking-tight">
              {area.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#687078]">
              {area.description}
            </p>
            <span className="mt-5 text-sm font-bold text-[#ef5b2a]">
              {area.action} →
            </span>
          </Link>
        ))}
      </section>
    </main>
  )
}
