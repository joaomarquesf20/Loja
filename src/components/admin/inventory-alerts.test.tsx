import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import InventoryAlerts from './inventory-alerts'

const fetchMock = vi.fn()

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
      },
    },
  )
}

function createVariant(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    variantId:
      'variant-1',
    sku: 'FLT-001',
    stock: 3,
    productId:
      'product-1',
    productName:
      'Filtro de óleo',
    productSlug:
      'filtro-de-oleo',
    ...overrides,
  }
}

function patchBody(
  callIndex: number,
) {
  const init = fetchMock.mock
    .calls[callIndex]?.[1] as
    | RequestInit
    | undefined

  if (
    !init ||
    typeof init.body !==
      'string'
  ) {
    throw new Error(
      'Pedido sem body JSON no teste',
    )
  }

  return JSON.parse(
    init.body,
  ) as Record<string, unknown>
}

describe(
  'InventoryAlerts',
  () => {
    beforeEach(() => {
      fetchMock.mockReset()

      vi.stubGlobal(
        'fetch',
        fetchMock,
      )
    })

    afterEach(() => {
      cleanup()
      vi.unstubAllGlobals()
    })

    test(
      'apresenta as variantes com stock baixo e o limiar configurado',
      () => {
        render(
          <InventoryAlerts
            threshold={
              5
            }
            variants={[
              createVariant(),
              createVariant(
                {
                  variantId:
                    'variant-2',
                  sku: 'FLT-002',
                  stock: 0,
                },
              ),
            ]}
          />,
        )

        expect(
          screen.getByText(
            'Alertas de ruptura',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Variantes ativas com stock igual ou inferior a 5 unidades.',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getAllByText(
            'Filtro de óleo',
          ),
        ).toHaveLength(2)

        expect(
          screen.getByText(
            'FLT-001',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'FLT-002',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getAllByText(
            'Stock baixo',
          ),
        ).toHaveLength(1)

        expect(
          screen.getByText(
            'Sem stock',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mostra o estado vazio sem variantes em ruptura',
      () => {
        render(
          <InventoryAlerts
            threshold={
              5
            }
            variants={[]}
          />,
        )

        expect(
          screen.getByText(
            'Sem variantes com stock baixo.',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByLabelText(
            'Novo stock de FLT-001',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'guarda o novo stock e mantém a linha quando continua com stock baixo',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            previousStock: 3,
            variant:
              createVariant({
                stock: 4,
              }),
          }),
        )

        render(
          <InventoryAlerts
            threshold={
              5
            }
            variants={[
              createVariant(),
            ]}
          />,
        )

        fireEvent.change(
          screen.getByLabelText(
            'Novo stock de FLT-001',
          ),
          {
            target: {
              value: '4',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Guardar stock de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Stock de Filtro de óleo guardado (3 → 4 unidades).',
        )

        expect(
          fetchMock.mock
            .calls[0]?.[0],
        ).toBe(
          '/api/admin/inventory',
        )

        expect(
          patchBody(0),
        ).toEqual({
          variantId:
            'variant-1',
          stock: 4,
        })

        expect(
          screen.getByLabelText(
            'Novo stock de FLT-001',
          ),
        ).toHaveValue(4)
      },
    )

    test(
      'remove a linha quando o novo stock passa o limiar',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            previousStock: 3,
            variant:
              createVariant({
                stock: 40,
              }),
          }),
        )

        render(
          <InventoryAlerts
            threshold={
              5
            }
            variants={[
              createVariant(),
            ]}
          />,
        )

        fireEvent.change(
          screen.getByLabelText(
            'Novo stock de FLT-001',
          ),
          {
            target: {
              value: '40',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Guardar stock de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Stock de Filtro de óleo guardado (3 → 40 unidades).',
          ),
        ).toBeInTheDocument()

        await waitFor(() => {
          expect(
            screen.queryByLabelText(
              'Novo stock de FLT-001',
            ),
          ).not.toBeInTheDocument()
        })

        expect(
          screen.getByText(
            'Sem variantes com stock baixo.',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mostra o erro do servidor quando o stock é inválido',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              error:
                'O stock deve estar entre 0 e 999999',
            },
            400,
          ),
        )

        render(
          <InventoryAlerts
            threshold={
              5
            }
            variants={[
              createVariant(),
            ]}
          />,
        )

        fireEvent.change(
          screen.getByLabelText(
            'Novo stock de FLT-001',
          ),
          {
            target: {
              value: '-2',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Guardar stock de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'O stock deve estar entre 0 e 999999',
        )

        expect(
          screen.getByLabelText(
            'Novo stock de FLT-001',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'exige o novo stock antes de guardar',
      async () => {
        render(
          <InventoryAlerts
            threshold={
              5
            }
            variants={[
              createVariant(),
            ]}
          />,
        )

        fireEvent.change(
          screen.getByLabelText(
            'Novo stock de FLT-001',
          ),
          {
            target: {
              value: '',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Guardar stock de FLT-001',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Introduz o novo stock antes de guardar.',
          ),
        ).toBeInTheDocument()

        expect(
          fetchMock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'atualiza a lista a partir da API com o limiar atual',
      async () => {
        render(
          <InventoryAlerts
            threshold={
              5
            }
            variants={[
              createVariant(),
            ]}
          />,
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            threshold: 5,
            variants: [
              createVariant(),
              createVariant(
                {
                  variantId:
                    'variant-2',
                  sku: 'FLT-002',
                  stock: 1,
                  productId:
                    'product-2',
                  productName:
                    'Pastilhas de travão',
                  productSlug:
                    'pastilhas-de-travao',
                },
              ),
            ],
          }),
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Atualizar lista',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Pastilhas de travão',
          ),
        ).toBeInTheDocument()

        expect(
          fetchMock.mock
            .calls[0]?.[0],
        ).toBe(
          '/api/admin/inventory?threshold=5',
        )

        expect(
          screen.getByText(
            'FLT-002',
          ),
        ).toBeInTheDocument()
      },
    )
  },
)
