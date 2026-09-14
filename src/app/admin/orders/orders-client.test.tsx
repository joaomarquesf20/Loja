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

import OrdersClient from './orders-client'

const fetchMock =
  vi.fn()

function createJsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'content-type':
          'application/json',
      },
    },
  )
}

function createOrder(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    id: 'order-1',
    orderNumber:
      'PFA-ABC123',
    subtotal: '100.00',
    shippingCost: '5.00',
    tax: '23.00',
    total: '128.00',
    status: 'PENDING',
    paymentStatus:
      'PAID',
    paymentMethod:
      'CARD',
    installmentCount: null,
    paymentProvider:
      'PFA_SIMULATED',
    paymentReference:
      'pfa_sim_123',
    fulfillmentMethod:
      'DELIVERY',
    shippingName:
      'Cliente Teste',
    shippingEmail:
      'cliente@example.com',
    shippingPhone:
      '912345678',
    shippingAddressLine1:
      'Rua de Teste 1',
    shippingAddressLine2:
      null,
    shippingCity:
      'Porto',
    shippingPostalCode:
      '4000-001',
    shippingCountry:
      'Portugal',
    createdAt:
      '2026-09-14T00:00:00.000Z',
    items: [
      {
        id: 'item-1',
        productNameAtPurchase:
          'Produto Teste',
        productSkuAtPurchase:
          'SKU-1',
        priceAtPurchase:
          '100.00',
        quantity: 1,
        subtotalAtPurchase:
          '100.00',
      },
    ],
    ...overrides,
  }
}

describe(
  'Admin Orders Client',
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
      'carrega e apresenta as encomendas',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
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
            'A carregar encomendas...',
          ),
        ).toBeInTheDocument()

        expect(
          await screen.findByText(
            'PFA-ABC123',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Produto Teste',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            /Pagamento: Pago/,
          ),
        ).toBeInTheDocument()

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/admin/orders',
        )
      },
    )

    test(
      'confirma uma encomenda paga sem enviar estado arbitrário',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            createJsonResponse({
              orders: [
                createOrder(),
              ],
            }),
          )
          .mockResolvedValueOnce(
            createJsonResponse({
              id: 'order-1',
              status:
                'CONFIRMED',
              paymentStatus:
                'PAID',
              fulfillmentMethod:
                'DELIVERY',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_123',
            }),
          )

        render(
          <OrdersClient />,
        )

        const button =
          await screen.findByRole(
            'button',
            {
              name:
                'Confirmar encomenda',
            },
          )

        fireEvent.click(button)

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledTimes(
            2,
          )
        })

        const [
          url,
          init,
        ] =
          fetchMock.mock.calls[1]

        expect(url).toBe(
          '/api/admin/orders/order-1/transition',
        )

        expect(init).toEqual(
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                action:
                  'CONFIRM',
              }),
          }),
        )

        expect(
          await screen.findByText(
            /Estado: Confirmada/,
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Iniciar processamento',
            },
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'mostra ação própria para levantamento em processamento',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            orders: [
              createOrder({
                status:
                  'PROCESSING',
                fulfillmentMethod:
                  'PICKUP',
                shippingAddressLine1:
                  null,
                shippingCity:
                  null,
                shippingPostalCode:
                  null,
                shippingCountry:
                  null,
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
                'Marcar pronta para levantamento',
            },
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Levantamento em loja',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Marcar como expedida',
            },
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'não permite avançar estado enquanto o pagamento não está confirmado',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            orders: [
              createOrder({
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
          await screen.findByText(
            /A aguardar confirmação do pagamento/,
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Confirmar encomenda',
            },
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'cancela encomenda pendente enviando apenas a ação CANCEL',
      async () => {
        const confirmMock =
          vi.spyOn(
            window,
            'confirm',
          ).mockReturnValue(
            true,
          )

        fetchMock
          .mockResolvedValueOnce(
            createJsonResponse({
              orders: [
                createOrder({
                  paymentStatus:
                    'PENDING',
                }),
              ],
            }),
          )
          .mockResolvedValueOnce(
            createJsonResponse({
              id: 'order-1',
              status:
                'CANCELLED',
              paymentStatus:
                'PENDING',
              fulfillmentMethod:
                'DELIVERY',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_123',
            }),
          )

        render(
          <OrdersClient />,
        )

        const button =
          await screen.findByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          )

        fireEvent.click(
          button,
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledTimes(
            2,
          )
        })

        expect(
          confirmMock,
        ).toHaveBeenCalled()

        const [
          url,
          init,
        ] =
          fetchMock.mock.calls[1]

        expect(url).toBe(
          '/api/admin/orders/order-1/transition',
        )

        expect(init).toEqual(
          expect.objectContaining({
            method: 'POST',
            body:
              JSON.stringify({
                action:
                  'CANCEL',
              }),
          }),
        )

        expect(
          await screen.findByText(
            /Estado: Cancelada/,
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

        confirmMock.mockRestore()
      },
    )

    test(
      'não cancela quando o administrador rejeita a confirmação',
      async () => {
        const confirmMock =
          vi.spyOn(
            window,
            'confirm',
          ).mockReturnValue(
            false,
          )

        fetchMock.mockResolvedValueOnce(
          createJsonResponse({
            orders: [
              createOrder({
                paymentStatus:
                  'FAILED',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        const button =
          await screen.findByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          )

        fireEvent.click(
          button,
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        )

        confirmMock.mockRestore()
      },
    )

    test(
      'não oferece cancelamento direto quando o pagamento está pago',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            orders: [
              createOrder({
                paymentStatus:
                  'PAID',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        await screen.findByText(
          'PFA-ABC123',
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

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Reembolsar pagamento',
            },
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'reembolsa pagamento simulado enviando apenas REFUND_PAYMENT',
      async () => {
        const confirmMock =
          vi.spyOn(
            window,
            'confirm',
          ).mockReturnValue(
            true,
          )

        fetchMock
          .mockResolvedValueOnce(
            createJsonResponse({
              orders: [
                createOrder(),
              ],
            }),
          )
          .mockResolvedValueOnce(
            createJsonResponse({
              id: 'order-1',
              status:
                'PENDING',
              paymentStatus:
                'REFUNDED',
              fulfillmentMethod:
                'DELIVERY',
              paymentProvider:
                'PFA_SIMULATED',
              paymentReference:
                'pfa_sim_123',
            }),
          )

        render(
          <OrdersClient />,
        )

        const button =
          await screen.findByRole(
            'button',
            {
              name:
                'Reembolsar pagamento',
            },
          )

        fireEvent.click(
          button,
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledTimes(
            2,
          )
        })

        expect(
          confirmMock,
        ).toHaveBeenCalled()

        const [
          url,
          init,
        ] =
          fetchMock.mock.calls[1]

        expect(url).toBe(
          '/api/admin/orders/order-1/transition',
        )

        expect(init).toEqual(
          expect.objectContaining({
            method: 'POST',
            body:
              JSON.stringify({
                action:
                  'REFUND_PAYMENT',
              }),
          }),
        )

        expect(
          await screen.findByText(
            /Pagamento: Reembolsado/,
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Cancelar encomenda',
            },
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Confirmar encomenda',
            },
          ),
        ).not.toBeInTheDocument()

        confirmMock.mockRestore()
      },
    )

    test(
      'não oferece reembolso simulado para outro fornecedor',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            orders: [
              createOrder({
                paymentProvider:
                  'REAL_PROVIDER',
                paymentReference:
                  'real_123',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        await screen.findByText(
          'PFA-ABC123',
        )

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Reembolsar pagamento',
            },
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'não oferece reembolso depois da expedição',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            orders: [
              createOrder({
                status:
                  'SHIPPED',
              }),
            ],
          }),
        )

        render(
          <OrdersClient />,
        )

        await screen.findByText(
          'PFA-ABC123',
        )

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Reembolsar pagamento',
            },
          ),
        ).not.toBeInTheDocument()
      },
    )

    test(
      'apresenta erro seguro quando a listagem falha',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse(
            {
              error:
                'Sem autorização',
            },
            403,
          ),
        )

        render(
          <OrdersClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Sem autorização',
        )
      },
    )
  },
)
