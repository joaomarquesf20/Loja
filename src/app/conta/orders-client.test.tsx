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
      'mostra pagamento para encomenda pendente elegível',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                status: 'PENDING',
                paymentStatus:
                  'PENDING',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByRole(
            'button',
            {
              name:
                'Pagar encomenda',
            },
          ),
        ).toBeInTheDocument()
      },
    )

    test.each([
      {
        status: 'PENDING',
        paymentStatus: 'PAID',
      },
      {
        status: 'SHIPPED',
        paymentStatus: 'PENDING',
      },
    ])(
      'não mostra pagamento para $status / $paymentStatus',
      async ({
        status,
        paymentStatus,
      }) => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                status,
                paymentStatus,
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        await screen.findByText(
          'Encomenda PFA-ABC123',
        )

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Pagar encomenda',
            },
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'paga encomenda e atualiza o histórico',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder({
                  status: 'PENDING',
                  paymentStatus:
                    'PENDING',
                }),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              payment: {
                orderId: 'order-1',
                paymentStatus:
                  'PAID',
              },
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder({
                  status: 'PENDING',
                  paymentStatus:
                    'PAID',
                  events: [
                    {
                      id: 'event-paid',
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
                  ],
                }),
              ],
            }),
          )

        render(
          <OrdersClient />,
        )

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Pagar encomenda',
            },
          ),
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledWith(
            '/api/payments/simulate',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                orderId: 'order-1',
              }),
            },
          )
        })

        expect(
          await screen.findByText(
            'Pagamento confirmado',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pendente → Pago',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Pagar encomenda',
            },
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'mostra erro quando o pagamento é recusado pelo servidor',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder({
                  status: 'PENDING',
                  paymentStatus:
                    'PENDING',
                }),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              {
                error:
                  'O estado atual da encomenda não permite iniciar pagamento',
              },
              409,
            ),
          )

        render(
          <OrdersClient />,
        )

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Pagar encomenda',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'O estado atual da encomenda não permite iniciar pagamento',
        )
      },
    )

    test(
      'mostra cancelamento apenas para encomenda elegível',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                status: 'PENDING',
                paymentStatus:
                  'PENDING',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        ).toBeInTheDocument()
      },
    )

    test.each([
      {
        status: 'CONFIRMED',
        paymentStatus: 'AUTHORIZED',
      },
      {
        status: 'SHIPPED',
        paymentStatus: 'PENDING',
      },
    ])(
      'não mostra cancelamento para $status / $paymentStatus',
      async ({
        status,
        paymentStatus,
      }) => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                status,
                paymentStatus,
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        await screen.findByText(
          'Encomenda PFA-ABC123',
        )

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'reembolsa e cancela encomenda paga após confirmação',
      async () => {
        const confirmMock =
          vi.fn(() => true)

        vi.stubGlobal(
          'confirm',
          confirmMock,
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder({
                  status: 'CONFIRMED',
                  paymentStatus:
                    'PAID',
                }),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              order: {
                id: 'order-1',
                status:
                  'CANCELLED',
                paymentStatus:
                  'REFUNDED',
              },
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder({
                  status:
                    'CANCELLED',
                  paymentStatus:
                    'REFUNDED',
                  events: [
                    {
                      id: 'event-refund',
                      type:
                        'PAYMENT_REFUNDED',
                      fromOrderStatus:
                        null,
                      toOrderStatus:
                        null,
                      fromPaymentStatus:
                        'PAID',
                      toPaymentStatus:
                        'REFUNDED',
                      createdAt:
                        '2026-09-01T10:09:00.000Z',
                    },
                    {
                      id: 'event-cancel',
                      type:
                        'CANCELLED',
                      fromOrderStatus:
                        'CONFIRMED',
                      toOrderStatus:
                        'CANCELLED',
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

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        )

        expect(
          confirmMock,
        ).toHaveBeenCalledWith(
          'Cancelar a encomenda PFA-ABC123? O pagamento será reembolsado e o stock dos artigos será reposto.',
        )

        expect(
          await screen.findByText(
            'Pagamento reembolsado',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pago → Reembolsado',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Encomenda cancelada',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Confirmada → Cancelada',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'cancela a encomenda após confirmação e atualiza o histórico',
      async () => {
        const confirmMock =
          vi.fn(() => true)

        vi.stubGlobal(
          'confirm',
          confirmMock,
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder({
                  status: 'PENDING',
                  paymentStatus:
                    'PENDING',
                }),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              order: {
                id: 'order-1',
                status:
                  'CANCELLED',
              },
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder({
                  status:
                    'CANCELLED',
                  paymentStatus:
                    'PENDING',
                  events: [
                    {
                      id: 'event-1',
                      type:
                        'CANCELLED',
                      fromOrderStatus:
                        'PENDING',
                      toOrderStatus:
                        'CANCELLED',
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

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        )

        expect(
          confirmMock,
        ).toHaveBeenCalledWith(
          'Cancelar a encomenda PFA-ABC123? O stock dos artigos será reposto.',
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledWith(
            '/api/orders/order-1/cancel',
            {
              method: 'POST',
            },
          )
        })

        expect(
          await screen.findByText(
            'Encomenda cancelada',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pendente → Cancelada',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'não cancela quando o utilizador recusa a confirmação',
      async () => {
        vi.stubGlobal(
          'confirm',
          vi.fn(() => false),
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            orders: [
              createOrder({
                status: 'PENDING',
                paymentStatus:
                  'PENDING',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'mostra erro quando o cancelamento é recusado pelo servidor',
      async () => {
        vi.stubGlobal(
          'confirm',
          vi.fn(() => true),
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              orders: [
                createOrder({
                  status: 'PENDING',
                  paymentStatus:
                    'PENDING',
                }),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              {
                error:
                  'O estado atual da encomenda já não permite cancelamento',
              },
              409,
            ),
          )

        render(
          <OrdersClient />,
        )

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'O estado atual da encomenda já não permite cancelamento',
        )
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
