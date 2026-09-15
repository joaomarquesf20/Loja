import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { OrdersClient } from './orders-client'

const fetchMock = vi.fn()

function createOrder(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    id: 'order-1',
    orderNumber:
      'PFA-ABC123',
    subtotal: '100.00',
    shippingCost: '5.50',
    tax: '23.00',
    total: '128.50',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    fulfillmentMethod:
      'DELIVERY',
    shippingName:
      'Maria Silva',
    shippingEmail:
      'maria@example.com',
    shippingPhone:
      '910000000',
    shippingAddressLine1:
      'Rua Central 10',
    shippingAddressLine2:
      null,
    shippingCity:
      'Porto',
    shippingPostalCode:
      '4000-001',
    shippingCountry:
      'Portugal',
    createdAt:
      '2026-09-01T10:00:00.000Z',
    items: [
      {
        id: 'item-1',
        productNameAtPurchase:
          'Filtro de óleo',
        productSkuAtPurchase:
          'FLT-001',
        priceAtPurchase:
          '50.00',
        quantity: 2,
        subtotalAtPurchase:
          '100.00',
      },
    ],
    events: [],
    ...overrides,
  }
}

function createPickupOrder(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return createOrder({
    fulfillmentMethod:
      'PICKUP',
    shippingCost:
      '0.00',
    shippingAddressLine1:
      null,
    shippingAddressLine2:
      null,
    shippingCity:
      null,
    shippingPostalCode:
      null,
    shippingCountry:
      null,
    ...overrides,
  })
}

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

describe(
  'OrdersClient',
  () => {
    beforeEach(() => {
      fetchMock.mockReset()

      vi.stubGlobal(
        'fetch',
        fetchMock,
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test(
      'carrega o histórico de encomendas',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder(),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          screen.getByText(
            'A carregar encomendas…',
          ),
        ).toBeInTheDocument()

        expect(
          await screen.findByText(
            'Encomenda PFA-ABC123',
          ),
        ).toBeInTheDocument()

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/orders',
          {
            method: 'GET',
            cache: 'no-store',
          },
        )
      },
    )

    test(
      'mostra estado vazio sem inventar encomendas',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByText(
            'Ainda não tens encomendas.',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            /PFA-/,
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'apresenta snapshots históricos dos artigos e da entrega',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder(),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByText(
            'Filtro de óleo',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'SKU: FLT-001',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Entrega',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Rua Central 10',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '4000-001 Porto',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'maria@example.com',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '910000000',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mostra criação e histórico persistido da encomenda',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                events: [
                  {
                    id: 'event-1',
                    type:
                      'PAYMENT_CONFIRMED',
                    fromOrderStatus:
                      null,
                    toOrderStatus:
                      null,
                    fromPaymentStatus:
                      'PENDING',
                    toPaymentStatus:
                      'PAID',
                    createdAt:
                      '2026-09-01T10:05:00.000Z',
                  },
                  {
                    id: 'event-2',
                    type:
                      'STATUS_CHANGED',
                    fromOrderStatus:
                      'PENDING',
                    toOrderStatus:
                      'CONFIRMED',
                    fromPaymentStatus:
                      null,
                    toPaymentStatus:
                      null,
                    createdAt:
                      '2026-09-01T10:10:00.000Z',
                  },
                ],
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByText(
            'Histórico',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Encomenda criada',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pagamento confirmado',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Estado alterado',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pendente → Pago',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pendente → Confirmada',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'apresenta levantamento em loja sem inventar uma morada',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createPickupOrder(),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByText(
            'Levantamento em loja',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Maria Silva',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'maria@example.com',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '910000000',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Rua Central 10',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.queryByText(
            '4000-001 Porto',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.queryByText(
            'Portugal',
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'traduz os estados conhecidos sem alterar os valores históricos',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder(),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByText(
            'Confirmada',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pago',
          ),
        ).toBeInTheDocument()
      },
    )

    test.each([
      [
        'READY_FOR_PICKUP',
        'Pronta para levantamento',
      ],
      [
        'PICKED_UP',
        'Levantada',
      ],
    ])(
      'traduz estado de levantamento %s',
      async (
        status,
        expectedLabel,
      ) => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createPickupOrder({
                status,
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByText(
            expectedLabel,
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mostra erro da API e permite tentar novamente',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse(
              {
                error:
                  'Erro interno do servidor',
              },
              500,
            ),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [],
            }),
          )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Erro interno do servidor',
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Tentar novamente',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Ainda não tens encomendas.',
          ),
        ).toBeInTheDocument()

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          2,
        )
      },
    )

    test(
      'rejeita resposta inválida do servidor',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              {
                id: 'order-1',
              },
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Resposta inválida do servidor',
        )
      },
    )

    test(
      'rejeita evento de histórico inválido devolvido pelo servidor',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                events: [
                  {
                    id: 'event-1',
                    type:
                      'STATUS_CHANGED',
                    fromOrderStatus:
                      'PENDING',
                    toOrderStatus:
                      'CONFIRMED',
                    fromPaymentStatus:
                      null,
                    toPaymentStatus:
                      null,
                    createdAt:
                      'data-inválida',
                  },
                ],
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Resposta inválida do servidor',
        )
      },
    )

    test(
      'rejeita levantamento com campos de morada preenchidos',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createPickupOrder({
                shippingAddressLine1:
                  'Morada que não devia existir',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Resposta inválida do servidor',
        )
      },
    )

    test(
      'mostra complemento da morada quando existe',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                shippingAddressLine2:
                  '2.º esquerdo',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByText(
            '2.º esquerdo',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'preserva estados desconhecidos em vez de inventar uma tradução',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                status:
                  'NOVO_ESTADO',
                paymentStatus:
                  'NOVO_PAGAMENTO',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByText(
            'NOVO_ESTADO',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'NOVO_PAGAMENTO',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mantém a ordem devolvida pela API',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                id: 'order-2',
                orderNumber:
                  'PFA-NEW',
              }),
              createOrder({
                id: 'order-1',
                orderNumber:
                  'PFA-OLD',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        await screen.findByText(
          'Encomenda PFA-NEW',
        )

        const headings =
          screen.getAllByRole(
            'heading',
            {
              level: 3,
            },
          )

        expect(
          headings.map(
            (heading) =>
              heading.textContent,
          ),
        ).toEqual([
          'Encomenda PFA-NEW',
          'Encomenda PFA-OLD',
        ])
      },
    )

    test(
      'continua funcional depois de retry',
      async () => {
        fetchMock
          .mockRejectedValueOnce(
            new Error(
              'Falha de rede',
            ),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder(),
              ],
            }),
          )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Falha de rede',
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Tentar novamente',
            },
          ),
        )

        await waitFor(() => {
          expect(
            screen.getByText(
              'Encomenda PFA-ABC123',
            ),
          ).toBeInTheDocument()
        })
      },
    )
  },
)