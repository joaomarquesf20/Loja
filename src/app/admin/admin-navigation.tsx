'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  {
    href: '/admin',
    label: 'Painel',
    exact: true,
  },
  {
    href: '/admin/products',
    label: 'Produtos',
    exact: true,
  },
  {
    href: '/admin/inventory',
    label: 'Inventário',
  },
  {
    href: '/admin/orders',
    label: 'Encomendas',
  },
  {
    href: '/admin/coupons',
    label: 'Cupões',
  },
  {
    href: '/admin/users',
    label: 'Clientes',
  },
  {
    href: '/admin/catalog',
    label: 'Catálogo',
  },
  {
    href: '/admin/vehicle-compatibility',
    label: 'Compatibilidade de veículos',
  },
  {
    href: '/admin/commercial-settings',
    label: 'Definições da loja',
  },
]

function isActive(
  pathname: string,
  href: string,
  exact?: boolean,
) {
  return exact
    ? pathname === href
    : pathname === href ||
      pathname.startsWith(`${href}/`)
}

export default function AdminNavigation() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Áreas de administração"
      className="flex gap-1 overflow-x-auto rounded-lg bg-[#171a1d] p-1 lg:flex-col"
    >
      {navigation.map((item) => {
        const active = isActive(
          pathname,
          item.href,
          item.exact,
        )

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={
              active ? 'page' : undefined
            }
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-white text-[#171a1d]'
                : 'text-white/65 hover:bg-white/8 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
