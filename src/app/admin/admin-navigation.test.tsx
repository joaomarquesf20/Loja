import { render, screen } from '@testing-library/react'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    usePathname: vi.fn(),
  }),
)

vi.mock('next/navigation', () => ({
  usePathname: mocks.usePathname,
}))

import AdminNavigation from './admin-navigation'

const areas = [
  { href: '/admin', label: 'Painel' },
  {
    href: '/admin/products',
    label: 'Produtos',
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
    label:
      'Compatibilidade de veículos',
  },
  {
    href: '/admin/commercial-settings',
    label: 'Definições da loja',
  },
]

function linkFor(label: string) {
  return screen.getByRole('link', {
    name: label,
  })
}

describe(
  'AdminNavigation',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.usePathname.mockReturnValue(
        '/admin',
      )
    })

    test(
      'renderiza todas as áreas, incluindo o painel',
      () => {
        render(
          <AdminNavigation />,
        )

        for (const {
          href,
          label,
        } of areas) {
          expect(
            linkFor(label).getAttribute(
              'href',
            ),
          ).toBe(href)
        }
      },
    )

    test(
      'marca o painel como ativo apenas no caminho exato',
      () => {
        mocks.usePathname.mockReturnValue(
          '/admin/products/new',
        )

        render(
          <AdminNavigation />,
        )

        const painel = linkFor('Painel')

        expect(
          painel.getAttribute(
            'aria-current',
          ),
        ).toBeNull()

        // "Produtos" é exato: subpáginas não acendem a secção.
        expect(
          linkFor(
            'Produtos',
          ).getAttribute(
            'aria-current',
          ),
        ).toBeNull()
      },
    )

    test(
      'ativa secções por prefixo nas subpáginas',
      () => {
        mocks.usePathname.mockReturnValue(
          '/admin/orders/order-9',
        )

        render(
          <AdminNavigation />,
        )

        expect(
          linkFor(
            'Encomendas',
          ).getAttribute(
            'aria-current',
          ),
        ).toBe('page')

        expect(
          linkFor(
            'Painel',
          ).getAttribute(
            'aria-current',
          ),
        ).toBeNull()
      },
    )

    test(
      'ativa o inventário nas suas subpáginas',
      () => {
        mocks.usePathname.mockReturnValue(
          '/admin/inventory/repor',
        )

        render(
          <AdminNavigation />,
        )

        expect(
          linkFor(
            'Inventário',
          ).getAttribute(
            'aria-current',
          ),
        ).toBe('page')

        expect(
          linkFor(
            'Produtos',
          ).getAttribute(
            'aria-current',
          ),
        ).toBeNull()
      },
    )

    test(
      'marca o painel como ativo na raiz',
      () => {
        render(
          <AdminNavigation />,
        )

        expect(
          linkFor(
            'Painel',
          ).getAttribute(
            'aria-current',
          ),
        ).toBe('page')
      },
    )
  },
)
