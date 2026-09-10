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

vi.mock(
  './product-compatibilities-client',
  () => ({
    default: () => null,
  }),
)

import ProductsClient from './products-client'

const fetchMock = vi.fn()

const categories = [
  {
    id: 'category-test',
    name: 'Categoria Teste',
  },
]

const productBrands = [
  {
    id: 'brand-test',
    name: 'Marca Teste',
  },
]

const standardProduct = {
  id: 'product-standard',
  categoryId: 'category-test',
  productBrandId: null,
  name: 'Produto Normal',
  slug: 'produto-normal',
  sku: 'SKU-NORMAL',
  description: null,
  price: '19.99',
  stockQuantity: 10,
  isActive: true,
  shippingClass: 'STANDARD',
  mainlandShippingCost: null,
}

const bulkyProduct = {
  id: 'product-bulky',
  categoryId: 'category-test',
  productBrandId: null,
  name: 'Produto Volumoso',
  slug: 'produto-volumoso',
  sku: 'SKU-BULKY',
  description: null,
  price: '199.99',
  stockQuantity: 2,
  isActive: true,
  shippingClass: 'BULKY',
  mainlandShippingCost: '24.90',
}

const unassignedProduct = {
  id: 'product-unassigned',
  categoryId: 'category-test',
  productBrandId: null,
  name: 'Produto Antigo',
  slug: 'produto-antigo',
  sku: 'SKU-ANTIGO',
  description: null,
  price: '9.99',
  stockQuantity: 1,
  isActive: true,
  shippingClass: 'UNASSIGNED',
  mainlandShippingCost: null,
}

function jsonResponse(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
      },
    },
  )
}

function installApiMock(
  products: unknown[] = [],
) {
  fetchMock.mockImplementation(
    async (
      input:
        | RequestInfo
        | URL,
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
        url ===
          '/api/admin/products'
      ) {
        return jsonResponse(
          products,
        )
      }

      if (
        method === 'GET' &&
        url ===
          '/api/admin/categories'
      ) {
        return jsonResponse(
          categories,
        )
      }

      if (
        method === 'GET' &&
        url ===
          '/api/admin/product-brands'
      ) {
        return jsonResponse(
          productBrands,
        )
      }

      if (
        method === 'POST' &&
        url ===
          '/api/admin/products'
      ) {
        return jsonResponse(
          standardProduct,
          201,
        )
      }

      if (
        method === 'PATCH' &&
        url.startsWith(
          '/api/admin/products/',
        )
      ) {
        return jsonResponse(
          standardProduct,
        )
      }

      throw new Error(
        `Pedido não mockado: ${method} ${url}`,
      )
    },
  )
}

async function waitForLoad() {
  await screen.findByRole(
    'heading',
    {
      name: 'Novo produto',
    },
  )
}

function fillBaseForm() {
  fireEvent.change(
    screen.getByLabelText(
      'Nome',
    ),
    {
      target: {
        value:
          'Produto Teste',
      },
    },
  )

  fireEvent.change(
    screen.getByLabelText(
      'Slug',
    ),
    {
      target: {
        value:
          'produto-teste',
      },
    },
  )

  fireEvent.change(
    screen.getByLabelText(
      'SKU',
    ),
    {
      target: {
        value:
          'SKU-TESTE',
      },
    },
  )

  fireEvent.change(
    screen.getByLabelText(
      'Preço (€)',
    ),
    {
      target: {
        value: '19.99',
      },
    },
  )

  fireEvent.change(
    screen.getByLabelText(
      'Stock',
    ),
    {
      target: {
        value: '10',
      },
    },
  )

  fireEvent.change(
    screen.getByLabelText(
      'Categoria',
    ),
    {
      target: {
        value:
          'category-test',
      },
    },
  )
}

function findRequestBody(
  method: 'POST' | 'PATCH',
) {
  const call =
    fetchMock.mock.calls.find(
      ([, init]) =>
        init?.method === method,
    )

  if (!call) {
    throw new Error(
      `Pedido ${method} não encontrado`,
    )
  }

  const init =
    call[1] as RequestInit

  if (
    typeof init.body !==
    'string'
  ) {
    throw new Error(
      'Body JSON não encontrado',
    )
  }

  return JSON.parse(
    init.body,
  ) as Record<
    string,
    unknown
  >
}

describe(
  'ProductsClient shipping',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.stubGlobal(
        'fetch',
        fetchMock,
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test(
      'mostra classe e tarifa específica de produto volumoso',
      async () => {
        installApiMock([
          bulkyProduct,
        ])

        render(
          <ProductsClient />,
        )

        await waitForLoad()

        const row =
          screen
            .getByText(
              'Produto Volumoso',
            )
            .closest('tr')

        expect(row).not.toBeNull()

        expect(
          within(
            row as HTMLTableRowElement,
          ).getByText(
            'Volumoso — 24.90 €',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'cria produto STANDARD com a classe de transporte',
      async () => {
        installApiMock([])

        render(
          <ProductsClient />,
        )

        await waitForLoad()
        fillBaseForm()

        fireEvent.change(
          screen.getByLabelText(
            'Classe de transporte',
          ),
          {
            target: {
              value:
                'STANDARD',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Criar produto',
            },
          ),
        )

        await waitFor(() => {
          expect(
            fetchMock.mock.calls.some(
              ([, init]) =>
                init?.method ===
                'POST',
            ),
          ).toBe(true)
        })

        expect(
          findRequestBody(
            'POST',
          ),
        ).toMatchObject({
          shippingClass:
            'STANDARD',
          mainlandShippingCost:
            null,
        })
      },
    )

    test(
      'mostra campo específico e envia tarifa para BULKY',
      async () => {
        installApiMock([])

        render(
          <ProductsClient />,
        )

        await waitForLoad()
        fillBaseForm()

        fireEvent.change(
          screen.getByLabelText(
            'Classe de transporte',
          ),
          {
            target: {
              value: 'BULKY',
            },
          },
        )

        const shippingInput =
          screen.getByLabelText(
            'Portes específicos — Portugal Continental (€)',
          )

        expect(
          shippingInput,
        ).toBeInTheDocument()

        fireEvent.change(
          shippingInput,
          {
            target: {
              value: '24.90',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Criar produto',
            },
          ),
        )

        await waitFor(() => {
          expect(
            fetchMock.mock.calls.some(
              ([, init]) =>
                init?.method ===
                'POST',
            ),
          ).toBe(true)
        })

        expect(
          findRequestBody(
            'POST',
          ),
        ).toMatchObject({
          shippingClass:
            'BULKY',
          mainlandShippingCost:
            24.9,
        })
      },
    )

    test(
      'não permite guardar BULKY sem tarifa específica',
      async () => {
        installApiMock([])

        render(
          <ProductsClient />,
        )

        await waitForLoad()
        fillBaseForm()

        fireEvent.change(
          screen.getByLabelText(
            'Classe de transporte',
          ),
          {
            target: {
              value: 'BULKY',
            },
          },
        )

        const form =
          screen
            .getByRole(
              'button',
              {
                name:
                  'Criar produto',
              },
            )
            .closest('form')

        expect(form).not.toBeNull()

        fireEvent.submit(
          form as HTMLFormElement,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Indica os portes específicos do artigo volumoso',
        )

        expect(
          fetchMock.mock.calls.some(
            ([, init]) =>
              init?.method ===
              'POST',
          ),
        ).toBe(false)
      },
    )

    test(
      'identifica produto histórico UNASSIGNED e exige correção',
      async () => {
        installApiMock([
          unassignedProduct,
        ])

        render(
          <ProductsClient />,
        )

        await waitForLoad()

        const row =
          screen
            .getByText(
              'Produto Antigo',
            )
            .closest('tr')

        expect(row).not.toBeNull()

        fireEvent.click(
          within(
            row as HTMLTableRowElement,
          ).getByRole(
            'button',
            {
              name: 'Editar',
            },
          ),
        )

        expect(
          screen.getByText(
            /produto histórico ainda está por classificar/i,
          ),
        ).toBeInTheDocument()

        const form =
          screen
            .getByRole(
              'button',
              {
                name:
                  'Guardar alterações',
              },
            )
            .closest('form')

        expect(form).not.toBeNull()

        fireEvent.submit(
          form as HTMLFormElement,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Seleciona uma classe de transporte válida',
        )

        expect(
          fetchMock.mock.calls.some(
            ([, init]) =>
              init?.method ===
              'PATCH',
          ),
        ).toBe(false)
      },
    )

    test(
      'ao mudar BULKY para STANDARD envia tarifa null para remover a tarifa específica',
      async () => {
        installApiMock([
          bulkyProduct,
        ])

        render(
          <ProductsClient />,
        )

        await waitForLoad()

        const row =
          screen
            .getByText(
              'Produto Volumoso',
            )
            .closest('tr')

        expect(row).not.toBeNull()

        fireEvent.click(
          within(
            row as HTMLTableRowElement,
          ).getByRole(
            'button',
            {
              name: 'Editar',
            },
          ),
        )

        fireEvent.change(
          screen.getByLabelText(
            'Classe de transporte',
          ),
          {
            target: {
              value:
                'STANDARD',
            },
          },
        )

        expect(
          screen.queryByLabelText(
            'Portes específicos — Portugal Continental (€)',
          ),
        ).not.toBeInTheDocument()

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar alterações',
            },
          ),
        )

        await waitFor(() => {
          expect(
            fetchMock.mock.calls.some(
              ([, init]) =>
                init?.method ===
                'PATCH',
            ),
          ).toBe(true)
        })

        expect(
          findRequestBody(
            'PATCH',
          ),
        ).toMatchObject({
          shippingClass:
            'STANDARD',
          mainlandShippingCost:
            null,
        })
      },
    )
  },
)
