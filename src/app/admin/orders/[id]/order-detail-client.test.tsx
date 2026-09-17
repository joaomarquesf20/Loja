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

import OrderDetailClient, {
  type AdminOrderDetailClientData,
} from './order-detail-client'

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
    Partial<AdminOrderDetailClientData> = {},
): AdminOrderDetailClientData {
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
      'INSTALLMENTS',
    installmentCount: 3,
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
      '2.º Direito',
    shippingCity:
      'Porto',
    shippingPostalCode:
      '4000-001',
    shippingCountry:
      'Portugal',
    shippingRegion:
      'PORTUGAL_MAINLAND',
    shippingClassApplied:
      'STANDARD',
    taxRatePercent:
      '23.00',
    pricesIncludeTax:
      true,
    nonVolumousSubtotal:
      '100.00',
    nonVolumousShippingCost:
      '5.00',
    bulkyShippingCost:
      null,
    freeShippingThreshold:
      '150.00',
    freeShippingApplied:
      false,
    createdAt:
      '2026-09-14T00:00:00.000Z',
    updatedAt:
      '2026-09-14T01:00:00.000Z',
    events: [],
    items: [
      {
        id: 'item-1',
        productId:
          'product-1',
        productNameAtPurchase:
          'Pastilhas de travão',
        productSkuAtPurchase:
          'BRAKE-001',
        priceAtPurchase:
          '50.00',
        quantity: 2,
        subtotalAtPurchase:
          '100.00',
        shippingClassAtPurchase:
          'STANDARD',
        shippingCostAtPurchase:
          '5.00',
      },
    ],
    ...overrides,
  }
}

describe(
  'Admin Order Detail Client',
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
      'mostra artigo, SKU, quantidade, preço e destino completos',
      () => {
        render(
          <OrderDetailClient
            initialOrder={
              createOrder()
            }
          />,
        )

        expect(
          screen.getByText(
            'PFA-ABC123',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pastilhas de travão',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'BRAKE-001',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Rua de Teste 1',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '2.º Direito',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            /Portugal Continental/,
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Prestações (3x)',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'PFA_SIMULATED',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getAllByText(
            '50.00 €',
          ).length,
        ).toBeGreaterThanOrEqual(
          1,
        )

        expect(
          screen.getAllByText(
            '128.00 €',
          ).length,
        ).toBeGreaterThanOrEqual(
          1,
        )
      },
    )

    test(
      'mostra criação e histórico persistido da encomenda',
      () => {
        render(
          <OrderDetailClient
            initialOrder={
              createOrder({
                events: [
                  {
                    id: 'event-failed',
                    type:
                      'PAYMENT_FAILED',
                    fromOrderStatus:
                      null,
                    toOrderStatus:
                      null,
                    fromPaymentStatus:
                      'PENDING',
                    toPaymentStatus:
                      'FAILED',
                    createdAt:
                      '2026-09-14T00:20:00.000Z',
                  },
                  {
                    id: 'event-retried',
                    type:
                      'PAYMENT_RETRIED',
                    fromOrderStatus:
                      null,
                    toOrderStatus:
                      null,
                    fromPaymentStatus:
                      'FAILED',
                    toPaymentStatus:
                      'PENDING',
                    createdAt:
                      '2026-09-14T00:25:00.000Z',
                  },
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
                      '2026-09-14T00:30:00.000Z',
                  },
                  {
                    id: 'event-status',
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
                      '2026-09-14T00:45:00.000Z',
                  },
                ],
              })
            }
          />,
        )

        expect(
          screen.getByRole(
            'heading',
            {
              name:
                'Histórico da encomenda',
            },
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Encomenda criada',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pagamento falhou',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pendente → Falhou',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Nova tentativa de pagamento',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Falhou → Pendente',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pagamento confirmado',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Pendente → Pago',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Estado da encomenda atualizado',
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
      'mostra levantamento em loja sem inventar morada',
      () => {
        render(
          <OrderDetailClient
            initialOrder={
              createOrder({
                fulfillmentMethod:
                  'PICKUP',
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
                shippingRegion:
                  null,
              })
            }
          />,
        )

        expect(
          screen.getByText(
            'Levantamento em loja',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Esta encomenda não tem morada de entrega.',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'avança o estado enviando apenas a ação administrativa',
      async () => {
        fetchMock.mockResolvedValue(
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
          <OrderDetailClient
            initialOrder={
              createOrder()
            }
          />,
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Confirmar encomenda',
            },
          ),
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledOnce()
        })

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/admin/orders/order-1/transition',
          expect.objectContaining({
            method: 'POST',
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
      },
    )

    test(
      'depois do reembolso apresenta cancelamento com reposição de stock',
      async () => {
        const confirmMock =
          vi.spyOn(
            window,
            'confirm',
          ).mockReturnValue(
            true,
          )

        fetchMock.mockResolvedValue(
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
          <OrderDetailClient
            initialOrder={
              createOrder()
            }
          />,
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Reembolsar pagamento',
            },
          ),
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

        confirmMock.mockRestore()
      },
    )
  },
)
