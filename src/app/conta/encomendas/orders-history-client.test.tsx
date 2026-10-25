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

const redirectMocks = vi.hoisted(
  () => ({
    redirectToExternalUrl: vi.fn(),
  }),
)

vi.mock('@/lib/redirect', () => ({
  redirectToExternalUrl:
    redirectMocks.redirectToExternalUrl,
}))

import { OrdersHistoryClient } from './orders-history-client'

const fetchMock = vi.fn()

function createOrder(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'order-1',
    orderNumber: 'PFA-ABC123',
    total: '205.90',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    createdAt:
      '2026-09-01T10:00:00.000Z',
    items: [
      {
        id: 'item-1',
        productNameAtPurchase:
          'Filtro de óleo',
        quantity: 2,
      },
    ],
    ...overrides,
  }
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

function ordersResponse(
  orders: unknown[],
) {
  return jsonResponse({
    orders,
  })
}

describe(
  'OrdersHistoryClient',
  () => {
    beforeEach(() => {
      fetchMock.mockReset()

      redirectMocks.redirectToExternalUrl.mockReset()

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
          ordersResponse([
            createOrder({
              status:
                'CONFIRMED',
              paymentStatus:
                'PAID',
            }),
          ]),
        )

        render(
          <OrdersHistoryClient />,
        )

        expect(
          await screen.findByText(
            'Encomenda PFA-ABC123',
          ),
        ).toBeTruthy()

        expect(
          screen.getByText(
            '1 artigo',
          ),
        ).toBeTruthy()

        expect(
          screen.queryByRole(
            'button',
            {
              name: 'Pagar agora',
            },
          ),
        ).toBeNull()

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
      'apresenta o botão Pagar agora apenas em encomendas pendentes',
      async () => {
        fetchMock.mockResolvedValueOnce(
          ordersResponse([
            createOrder(),
            createOrder({
              id: 'order-2',
              orderNumber:
                'PFA-DEF456',
              status:
                'CONFIRMED',
              paymentStatus:
                'PAID',
            }),
            createOrder({
              id: 'order-3',
              orderNumber:
                'PFA-GHI789',
              status:
                'CANCELLED',
            }),
          ]),
        )

        render(
          <OrdersHistoryClient />,
        )

        expect(
          await screen.findByText(
            'Encomenda PFA-ABC123',
          ),
        ).toBeTruthy()

        const payButtons =
          screen.queryAllByRole(
            'button',
            {
              name: 'Pagar agora',
            },
          )

        expect(
          payButtons.length,
        ).toBe(1)
      },
    )

    test(
      'retoma o pagamento e navega de imediato para o Stripe',
      async () => {
        let resolveRetry!: (
          response: Response,
        ) => void

        fetchMock.mockImplementationOnce(
          () =>
            ordersResponse([
              createOrder(),
            ]),
        )

        fetchMock.mockImplementationOnce(
          () =>
            new Promise<Response>(
              (resolve) => {
                resolveRetry =
                  resolve
              },
            ),
        )

        render(
          <OrdersHistoryClient />,
        )

        const payButton =
          await screen.findByRole(
            'button',
            {
              name: 'Pagar agora',
            },
          )

        fireEvent.click(
          payButton,
        )

        expect(
          await screen.findByText(
            'A redirecionar…',
          ),
        ).toBeTruthy()

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/checkout/stripe/retry',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(
              {
                orderId:
                  'order-1',
              },
            ),
          },
        )

        resolveRetry(
          jsonResponse(
            {
              orderNumber:
                'PFA-ABC123',
              checkoutSession: {
                id: 'cs_test_1',
                url: 'https://stripe.test/pagar',
              },
            },
            201,
          ),
        )

        await waitFor(() =>
          expect(
            redirectMocks.redirectToExternalUrl,
          ).toHaveBeenCalledWith(
            'https://stripe.test/pagar',
          ),
        )
      },
    )

    test(
      'mostra o erro devolvido pelo servidor na retoma',
      async () => {
        fetchMock.mockResolvedValueOnce(
          ordersResponse([
            createOrder(),
          ]),
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              error:
                'A encomenda foi alterada durante a retoma do pagamento',
            },
            409,
          ),
        )

        render(
          <OrdersHistoryClient />,
        )

        const payButton =
          await screen.findByRole(
            'button',
            {
              name: 'Pagar agora',
            },
          )

        fireEvent.click(
          payButton,
        )

        const alert =
          await screen.findByRole(
            'alert',
          )

        expect(
          alert.textContent,
        ).toContain(
          'A encomenda foi alterada durante a retoma do pagamento',
        )

        expect(
          redirectMocks.redirectToExternalUrl,
        ).not.toHaveBeenCalled()

        expect(
          await screen.findByRole(
            'button',
            {
              name: 'Pagar agora',
            },
          ),
        ).toBeTruthy()
      },
    )

    test(
      'valida o URL da sessão antes de navegar',
      async () => {
        fetchMock.mockResolvedValueOnce(
          ordersResponse([
            createOrder(),
          ]),
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              orderNumber:
                'PFA-ABC123',
              checkoutSession: {
                id: 'cs_test_1',
                url:
                  'javascript:alert(1)',
              },
            },
            201,
          ),
        )

        render(
          <OrdersHistoryClient />,
        )

        const payButton =
          await screen.findByRole(
            'button',
            {
              name: 'Pagar agora',
            },
          )

        fireEvent.click(
          payButton,
        )

        const alert =
          await screen.findByRole(
            'alert',
          )

        expect(
          alert.textContent,
        ).toContain(
          'Resposta inválida do servidor',
        )

        expect(
          redirectMocks.redirectToExternalUrl,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'mostra a mensagem de fallback quando a retoma falha sem corpo legível',
      async () => {
        fetchMock.mockResolvedValueOnce(
          ordersResponse([
            createOrder(),
          ]),
        )

        fetchMock.mockResolvedValueOnce(
          new Response(
            'não sou json',
            {
              status: 500,
            },
          ),
        )

        render(
          <OrdersHistoryClient />,
        )

        const payButton =
          await screen.findByRole(
            'button',
            {
              name: 'Pagar agora',
            },
          )

        fireEvent.click(
          payButton,
        )

        const alert =
          await screen.findByRole(
            'alert',
          )

        expect(
          alert.textContent,
        ).toContain(
          'Não foi possível retomar o pagamento',
        )

        expect(
          redirectMocks.redirectToExternalUrl,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'apresenta o estado vazio sem encomendas',
      async () => {
        fetchMock.mockResolvedValueOnce(
          ordersResponse([]),
        )

        render(
          <OrdersHistoryClient />,
        )

        expect(
          await screen.findByText(
            'Ainda não tens encomendas.',
          ),
        ).toBeTruthy()
      },
    )

    test(
      'mostra o erro de carregamento e recupera com Tentar novamente',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              error:
                'Não autenticado',
            },
            401,
          ),
        )

        render(
          <OrdersHistoryClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toBeTruthy()

        expect(
          screen.getByText(
            'Não autenticado',
          ),
        ).toBeTruthy()

        fetchMock.mockResolvedValueOnce(
          ordersResponse([
            createOrder(),
          ]),
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Tentar novamente',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Encomenda PFA-ABC123',
          ),
        ).toBeTruthy()
      },
    )
  },
)
