import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}))

import ProductsClient from './products-client'

const fetchMock = vi.fn()
let bulkResponse:
  | ((body: {
      ids: string[]
      action: string
    }) => unknown)
  | null = null

const products = [
  {
    id: 'product-wheel',
    name: 'Japan Racing JR11',
    slug: 'japan-racing-jr11',
    sku: 'JR11-MODEL',
    description: null,
    price: '169.90',
    stockQuantity: 12,
    isActive: true,
    images: [],
    shippingClass: 'STANDARD',
    mainlandShippingCost: null,
    category: {
      id: 'category-wheels',
      name: 'Jantes',
      slug: 'jantes',
      parentId: null,
    },
    brand: {
      id: 'brand-japan-racing',
      name: 'Japan Racing',
      slug: 'japan-racing',
    },
    variants: [
      {
        id: 'variant-one',
        sku: 'JR11-18',
        price: '169.90',
        stockQuantity: 12,
        isActive: true,
        position: 0,
        optionKey: '18',
        options: [],
        specifications: [],
      },
      {
        id: 'variant-two',
        sku: 'JR11-19',
        price: '219.90',
        stockQuantity: 0,
        isActive: true,
        position: 1,
        optionKey: '19',
        options: [],
        specifications: [],
      },
    ],
    compatibilities: [],
  },
  {
    id: 'product-suspension',
    name: 'Molas Suspension',
    slug: 'molas-suspension',
    sku: 'SPRING-MODEL',
    description: null,
    price: '289.90',
    stockQuantity: 4,
    isActive: false,
    images: [],
    shippingClass: 'STANDARD',
    mainlandShippingCost: null,
    category: {
      id: 'category-suspension',
      name: 'Suspensão',
      slug: 'suspensao',
      parentId: null,
    },
    brand: {
      id: 'brand-hr',
      name: 'H&R',
      slug: 'h-r',
    },
    variants: [
      {
        id: 'variant-three',
        sku: 'HR-30',
        price: '289.90',
        stockQuantity: 4,
        isActive: true,
        position: 0,
        optionKey: '30',
        options: [],
        specifications: [],
      },
    ],
    compatibilities: [],
  },
]

function jsonResponse(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

function installApiMock() {
  fetchMock.mockImplementation(
    async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      const method =
        init?.method ?? 'GET'

      if (
        method === 'GET' &&
        url === '/api/admin/products/manage'
      ) {
        return jsonResponse(products)
      }

      if (
        method === 'GET' &&
        url === '/api/admin/categories'
      ) {
        return jsonResponse([
          ...products.map((product) => ({
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          })),
          {
            id: 'category-empty',
            name: 'Vendas',
            slug: 'vendas',
          },
        ])
      }

      if (
        method === 'GET' &&
        url === '/api/admin/product-brands'
      ) {
        return jsonResponse(
          products.map((product) => ({
            id: product.brand!.id,
            name: product.brand!.name,
            slug: product.brand!.slug,
          })),
        )
      }

      if (
        method === 'PATCH' &&
        url ===
          '/api/admin/products/product-wheel/manage'
      ) {
        return jsonResponse({
          ...products[0],
          isActive: false,
        })
      }

      if (
        method === 'POST' &&
        url === '/api/admin/products/bulk'
      ) {
        const body = JSON.parse(
          (init?.body as string) ?? '{}',
        ) as {
          ids: string[]
          action: string
        }
        if (bulkResponse) {
          return jsonResponse(bulkResponse(body))
        }

        return jsonResponse({
          action: body.action,
          updated:
            body.action === 'activate' ||
            body.action === 'deactivate'
              ? body.ids.map((id) => ({
                  id,
                  name:
                    products.find(
                      (product) =>
                        product.id === id,
                    )?.name ?? id,
                  isActive:
                    body.action === 'activate',
                }))
              : [],
          deleted: [],
          archived: [],
          failed: [],
          counts: {
            requested: body.ids.length,
            updated:
              body.action === 'activate' ||
              body.action === 'deactivate'
                ? body.ids.length
                : 0,
            deleted: 0,
            archived: 0,
            failed: 0,
          },
        })
      }

      if (
        method === 'DELETE' &&
        url ===
          '/api/admin/products/product-wheel/manage'
      ) {
        return jsonResponse({
          id: 'product-wheel',
          name: products[0].name,
          status: 'deleted',
          orderNumbers: [],
          references: {
            orderItems: 0,
            cartItems: 0,
          },
          message: 'Produto eliminado permanentemente.',
        })
      }

      if (
        method === 'POST' &&
        url ===
          '/api/admin/products/product-wheel/duplicate'
      ) {
        return jsonResponse(
          {
            ...products[0],
            id: 'product-copy',
            name: 'Japan Racing JR11 (cópia)',
            isActive: false,
          },
          201,
        )
      }

      throw new Error(
        `Pedido não mockado: ${method} ${url}`,
      )
    },
  )
}

async function waitForProducts() {
  await screen.findByRole('heading', {
    name: 'Todos os produtos',
  })
}

describe('ProductsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bulkResponse = null
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    installApiMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('mostra os campos e ações por produto', async () => {
    render(<ProductsClient />)
    await waitForProducts()

    const row =
      screen
        .getByText('Japan Racing JR11')
        .closest('tr')

    expect(row).not.toBeNull()
    const productRow =
      within(row as HTMLTableRowElement)

    expect(
      productRow.getByText('Japan Racing'),
    ).toBeInTheDocument()
    expect(
      productRow.getByText('Jantes'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', {
        name: 'Vendas',
      }),
    ).toBeInTheDocument()
    expect(
      productRow.getByText('2'),
    ).toBeInTheDocument()
    expect(
      productRow.getByText(
        '12 em stock · 1 variante esgotada',
      ),
    ).toBeInTheDocument()
    expect(
      productRow.getByText(
        '169,90 € – 219,90 €',
      ),
    ).toBeInTheDocument()

    const suspensionRow = screen
      .getByText('Molas Suspension')
      .closest('tr') as HTMLTableRowElement

    expect(
      within(suspensionRow).getByText(
        '289,90 €',
      ),
    ).toBeInTheDocument()
    fireEvent.click(
      productRow.getByRole('button', {
        name: 'Ações para Japan Racing JR11',
      }),
    )

    expect(
      productRow.getByRole('menuitem', {
        name: 'Editar',
      }),
    ).toHaveAttribute(
      'href',
      '/admin/products/product-wheel',
    )
    expect(
      productRow.getByRole('menuitem', {
        name: 'Preview',
      }),
    ).toHaveAttribute(
      'href',
      '/produtos/japan-racing-jr11',
    )
    expect(
      productRow.getByRole('menuitem', {
        name: 'Duplicar',
      }),
    ).toBeInTheDocument()
    expect(
      productRow.getByRole('menuitem', {
        name: 'Desativar',
      }),
    ).toBeInTheDocument()
    expect(
      productRow.getByRole('menuitem', {
        name: 'Eliminar',
      }),
    ).toBeInTheDocument()
  })

  test('o menu de ações por linha fecha com Escape', async () => {
    render(<ProductsClient />)
    await waitForProducts()

    const row = screen
      .getByText('Japan Racing JR11')
      .closest('tr') as HTMLTableRowElement
    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Ações para Japan Racing JR11',
      }),
    )
    expect(
      within(row).getByRole('menu', {
        name: 'Ações para Japan Racing JR11',
      }),
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(
      within(row).queryByRole('menu'),
    ).not.toBeInTheDocument()
  })

  test('pesquisa e filtra por categoria e estado', async () => {
    render(<ProductsClient />)
    await waitForProducts()

    fireEvent.change(
      screen.getByLabelText('Pesquisar'),
      {
        target: {
          value: 'Molas',
        },
      },
    )

    expect(
      screen.queryByText('Japan Racing JR11'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Molas Suspension'),
    ).toBeInTheDocument()

    fireEvent.change(
      screen.getByLabelText('Pesquisar'),
      { target: { value: '' } },
    )
    fireEvent.change(
      screen.getByLabelText('Categoria'),
      {
        target: {
          value: 'category-wheels',
        },
      },
    )

    expect(
      screen.getByText('Japan Racing JR11'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Molas Suspension'),
    ).not.toBeInTheDocument()

    fireEvent.change(
      screen.getByLabelText('Categoria'),
      { target: { value: '' } },
    )
    fireEvent.change(
      screen.getByLabelText('Estado'),
      {
        target: {
          value: 'inactive',
        },
      },
    )

    expect(
      screen.getByText('Molas Suspension'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Japan Racing JR11'),
    ).not.toBeInTheDocument()
  })

  test('altera o estado ativo sem apagar o produto', async () => {
    render(<ProductsClient />)
    await waitForProducts()

    const row =
      screen
        .getByText('Japan Racing JR11')
        .closest('tr') as HTMLTableRowElement
    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Ações para Japan Racing JR11',
      }),
    )
    fireEvent.click(
      within(row).getByRole('menuitem', {
        name: 'Desativar',
      }),
    )

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([, init]) =>
          init?.method === 'PATCH',
      )
      expect(call).toBeDefined()
      expect(
        JSON.parse(
          (call?.[1] as RequestInit)
            .body as string,
        ),
      ).toEqual({
        isActive: false,
      })
    })
  })

  test('duplica e abre a cópia inativa', async () => {
    render(<ProductsClient />)
    await waitForProducts()

    const row =
      screen
        .getByText('Japan Racing JR11')
        .closest('tr') as HTMLTableRowElement
    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Ações para Japan Racing JR11',
      }),
    )
    fireEvent.click(
      within(row).getByRole('menuitem', {
        name: 'Duplicar',
      }),
    )

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        '/admin/products/product-copy',
      )
    })
  })

  test('seleciona apenas os produtos visíveis e permite limpar a seleção', async () => {
    render(<ProductsClient />)
    await waitForProducts()

    const selectAll =
      screen.getByRole('checkbox', {
        name: 'Selecionar todos os produtos visíveis',
      })
    fireEvent.click(selectAll)

    expect(
      screen.getByText('2 produtos selecionados'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: 'Selecionar Japan Racing JR11',
      }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', {
        name: 'Selecionar Molas Suspension',
      }),
    ).toBeChecked()

    fireEvent.change(
      screen.getByLabelText('Pesquisar'),
      { target: { value: 'Molas' } },
    )

    await waitFor(() => {
      expect(
        screen.queryByText('2 produtos selecionados'),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('checkbox', {
        name: 'Selecionar Molas Suspension',
      }),
    ).not.toBeChecked()
  })

  test(' executa ativação em massa e atualiza a lista', async () => {
    render(<ProductsClient />)
    await waitForProducts()

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Selecionar todos os produtos visíveis',
      }),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ativar selecionados',
      }),
    )

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url, init]) =>
          url === '/api/admin/products/bulk' &&
          init?.method === 'POST',
      )
      expect(call).toBeDefined()
      expect(
        JSON.parse(
          (call?.[1] as RequestInit)
            .body as string,
        ),
      ).toEqual({
        ids: ['product-wheel', 'product-suspension'],
        action: 'activate',
      })
    })
    expect(
      await screen.findByText(
        '2 produtos ativados.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('2 produtos selecionados'),
    ).not.toBeInTheDocument()
  })

  test('confirma e elimina um produto, removendo-o da lista', async () => {
    render(<ProductsClient />)
    await waitForProducts()

    const row =
      screen
        .getByText('Japan Racing JR11')
        .closest('tr') as HTMLTableRowElement
    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Ações para Japan Racing JR11',
      }),
    )
    fireEvent.click(
      within(row).getByRole('menuitem', {
        name: 'Eliminar',
      }),
    )

    await waitFor(() => {
      expect(
        vi.mocked(window.confirm),
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          'Eliminar “Japan Racing JR11”?',
        ),
      )
      expect(
        screen.queryByText('Japan Racing JR11'),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByText(
        'Japan Racing JR11 eliminado.',
      ),
    ).toBeInTheDocument()
  })

  test('mostra sucesso parcial e erros úteis na eliminação em massa', async () => {
    bulkResponse = () => ({
      action: 'delete',
      updated: [],
      deleted: [
        {
          id: 'product-wheel',
          name: 'Japan Racing JR11',
          status: 'deleted',
          orderNumbers: [],
          references: {
            orderItems: 0,
            cartItems: 0,
          },
          message: 'Eliminado.',
        },
      ],
      archived: [
        {
          id: 'product-suspension',
          name: 'Molas Suspension',
          status: 'archived',
          reason: 'order_history',
          orderNumbers: ['PFA-66BAACBA42F0'],
          references: {
            orderItems: 1,
            cartItems: 0,
          },
          message: 'Arquivado para preservar histórico.',
        },
      ],
      failed: [
        {
          id: 'product-missing',
          error: 'Produto não encontrado',
        },
      ],
      counts: {
        requested: 3,
        updated: 0,
        deleted: 1,
        archived: 1,
        failed: 1,
      },
    })

    render(<ProductsClient />)
    await waitForProducts()

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Selecionar todos os produtos visíveis',
      }),
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Eliminar permanentemente',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          '1 produto eliminado · 1 produto arquivado para preservar o histórico; 1 produto sem alteração.',
        ),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent(
      'Produto não encontrado',
    )
    expect(
      screen.queryByText('Japan Racing JR11'),
    ).not.toBeInTheDocument()
  })

  test('pagina a lista e volta à primeira página ao filtrar', async () => {
    const paginated = Array.from(
      { length: 12 },
      (_, index) => ({
        ...products[0]!,
        id: `product-page-${index}`,
        name: `Produto ${index + 1}`,
        sku: `PAG-${index + 1}`,
      }),
    )

    fetchMock.mockImplementation(
      async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string'
            ? input
            : input.toString()

        if (
          url === '/api/admin/products/manage'
        ) {
          return jsonResponse(paginated)
        }

        if (
          url === '/api/admin/categories'
        ) {
          return jsonResponse(
            paginated.map((product) => ({
              id: product.category.id,
              name: product.category.name,
              slug: product.category.slug,
            })),
          )
        }

        if (
          url === '/api/admin/product-brands'
        ) {
          return jsonResponse([])
        }

        throw new Error(
          `Pedido não mockado: ${url}`,
        )
      },
    )

    render(<ProductsClient />)
    await waitForProducts()

    expect(
      screen.getByText('Produto 1'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Produto 10'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Produto 11'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Página 1 de 2'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Página anterior',
      }),
    ).toBeDisabled()
    expect(
      screen.getByText('12 de 12 produtos'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Página seguinte',
      }),
    )

    expect(
      screen.getByText('Página 2 de 2'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Produto 11'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Produto 12'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Produto 10'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Página seguinte',
      }),
    ).toBeDisabled()

    fireEvent.change(
      screen.getByLabelText('Pesquisar'),
      { target: { value: 'Produto 11' } },
    )

    expect(
      screen.getByText('1 de 12 produtos'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Página \d de \d/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Produto 11'),
    ).toBeInTheDocument()
  })
})
