'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Etiquetas dos segmentos conhecidos de /admin; segmentos
 * desconhecidos (ids de detalhe p. ex. /admin/products/cmeq...)
 * são ignorados porque o título real vive na própria página.
 */
const crumbLabels: Record<string, string> =
  {
    products: 'Produtos',
    orders: 'Encomendas',
    catalog: 'Catálogo',
    categories: 'Categorias',
    'product-brands':
      'Marcas de produto',
    'commercial-settings':
      'Definições da loja',
    'vehicle-compatibility':
      'Compatibilidade de veículos',
    'vehicle-brands':
      'Marcas de veículos',
    'vehicle-models':
      'Modelos de veículos',
    'vehicle-generations':
      'Gerações de veículos',
    'vehicle-configurations':
      'Configurações de veículos',
    new: 'Novo produto',
    import: 'Importação',
  }

export default function AdminBreadcrumb() {
  const pathname = usePathname()

  if (!pathname.startsWith('/admin')) {
    return null
  }

  const segments = pathname
    .slice('/admin'.length)
    .split('/')
    .filter(Boolean)

  if (segments.length === 0) {
    // Painel raiz: o logo do cabeçalho já é o caminho "Admin".
    return null
  }

  const crumbs: Array<{
    href: string
    label: string
  }> = []

  let href = '/admin'

  for (const segment of segments) {
    href = `${href}/${segment}`

    const label = crumbLabels[segment]

    if (label) {
      crumbs.push({ href, label })
    }
  }

  if (crumbs.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="Caminho de navegação"
      className="text-xs font-semibold"
    >
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link
            href="/admin"
            className="text-[#687078] transition hover:text-[#17181c]"
          >
            Admin
          </Link>
        </li>

        {crumbs.map(
          (crumb, index) => (
            <li
              key={crumb.href}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden="true"
                className="text-black/25"
              >
                ›
              </span>

              {index ===
              crumbs.length - 1 ? (
                <span
                  aria-current="page"
                  className="text-[#17181c]"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-[#687078] transition hover:text-[#17181c]"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>
    </nav>
  )
}
