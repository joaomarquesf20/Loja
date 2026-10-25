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

import AdminBreadcrumb from './admin-breadcrumb'

function renderAt(pathname: string) {
  mocks.usePathname.mockReturnValue(
    pathname,
  )

  return render(<AdminBreadcrumb />)
}

describe(
  'AdminBreadcrumb',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test(
      'não renderiza no painel raiz',
      () => {
        const { container } =
          renderAt('/admin')

        expect(
          container.firstChild,
        ).toBeNull()
      },
    )

    test(
      'mostra Admin e a secção nos produtos',
      () => {
        const { container } =
          renderAt('/admin/products')

        expect(
          screen
            .getByRole('link', {
              name: 'Admin',
            })
            .getAttribute('href'),
        ).toBe('/admin')

        const current =
          container.querySelector(
            '[aria-current="page"]',
          )

        expect(
          current?.textContent,
        ).toBe('Produtos')

        expect(
          screen.getByRole('navigation', {
            name: 'Caminho de navegação',
          }),
        ).toBeInTheDocument()
      },
    )

    test('mostra o caminho completo dos produtos novos', () => {
      renderAt('/admin/products/new')

      const produtos = screen.getByRole(
        'link',
        {
          name: 'Produtos',
        },
      )

      expect(
        produtos.getAttribute(
          'href',
        ),
      ).toBe('/admin/products')

      expect(
        screen.getByText(
          'Novo produto',
        ),
      ).toBeInTheDocument()
    })

    test('alarga a etiqueta da importação e skipa ids de detalhe', () => {
      const { container } =
        renderAt(
          '/admin/products/cmprod123/editar',
        )

      expect(
        screen.getByRole('link', {
          name: 'Admin',
        }),
      ).toBeInTheDocument()

      // Ids desconhecidos não geram crumbs nem finais falsos.
      expect(
        container.textContent,
      ).not.toContain('cmprod123')

      expect(
        container.querySelector(
          '[aria-current="page"]',
        )?.textContent,
      ).toBe('Produtos')
    })

    test('etiqueta as secções de veículos e definições', () => {
      const casos = [
        {
          pathname:
            '/admin/vehicle-generations',
          label:
            'Gerações de veículos',
        },
        {
          pathname:
            '/admin/vehicle-configurations',
          label:
            'Configurações de veículos',
        },
        {
          pathname:
            '/admin/commercial-settings',
          label: 'Definições da loja',
        },
      ]

      const { unmount } =
        renderAt(casos[0]!.pathname)

      expect(
        screen.getByText(
          casos[0]!.label,
        ),
      ).toBeInTheDocument()

      unmount()
      renderAt(casos[1]!.pathname)

      expect(
        screen.getByText(
          casos[1]!.label,
        ),
      ).toBeInTheDocument()

      unmount()
      renderAt(casos[2]!.pathname)

      expect(
        screen.getByText(
          casos[2]!.label,
        ),
      ).toBeInTheDocument()
    })

    test('não renderiza quando nenhum segmento é reconhecido', () => {
      const { container } =
        renderAt('/admin/xyz')

      expect(
        container.firstChild,
      ).toBeNull()
    })
  },
)
