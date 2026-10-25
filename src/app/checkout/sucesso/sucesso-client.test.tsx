import {
  cleanup,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import {
  GUEST_CART_STORAGE_KEY,
} from '@/lib/guest-cart'

import { CheckoutSuccessClient } from './sucesso-client'

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

function createOrder(
  overrides?: Partial<{
    orderNumber: string
    paymentStatus: string
    fulfillmentMethod:
      | 'DELIVERY'
      | 'PICKUP'
  }>,
) {
  return {
    orderNumber: 'PFA-ABC123',
    subtotal: '100.00',
    shippingCost: '5.90',
    tax: '19.80',
    total: '105.90',
    status: 'PENDING',
    paymentStatus: 'PAID',
    fulfillmentMethod: 'DELIVERY',
    shippingMethod: 'STANDARD',
    createdAt:
      '2026-10-24T10:00:00.000Z',
    items: [
      {
        id: 'item-1',
        productNameAtPurchase:
          'Óleo Motor 5W30',
        productSkuAtPurchase:
          'OIL-5W30-1L',
        priceAtPurchase:
          '12.95',
        quantity: 2,
        subtotalAtPurchase:
          '25.90',
        variantOptionsAtPurchase:
          [
            {
              code: 'capacity',
              name: 'Capacidade',
              value: '1 L',
            },
          ],
      },
    ],
    ...overrides,
  }
}

const fetchMock = vi.fn()

function setSuccessUrl(
  query: string,
) {
  window.history.replaceState(
    null,
    '',
    `/checkout/sucesso?${query}`,
  )
}

describe(
  'CheckoutSuccessClient',
  () => {
    beforeEach(() => {
      fetchMock.mockReset()
      window.localStorage.clear()
      setSuccessUrl('')

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
      'mostra confirmação inválida e não chama a API quando faltam parâmetros',
      async () => {
        render(
          <CheckoutSuccessClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Confirmação inválida',
        )

        expect(
          fetchMock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita session_id fora do formato do Stripe',
      async () => {
        setSuccessUrl(
          'order=PFA-ABC123&session_id=ref-123',
        )

        render(
          <CheckoutSuccessClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Confirmação inválida',
        )

        expect(
          fetchMock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita número de encomenda com caracteres inesperados',
      async () => {
        setSuccessUrl(
          'order=../../encomenda&session_id=cs_test_1',
        )

        render(
          <CheckoutSuccessClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Confirmação inválida',
        )

        expect(
          fetchMock,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'apresenta a confirmação da encomenda e limpa o carrinho local',
      async () => {
        setSuccessUrl(
          'order=PFA-ABC123&session_id=cs_test_1',
        )

        window.localStorage.setItem(
          GUEST_CART_STORAGE_KEY,
          JSON.stringify([
            {
              productId:
                'product-1',
              quantity: 1,
            },
          ]),
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            order: createOrder(),
          }),
        )

        render(
          <CheckoutSuccessClient />,
        )

        expect(
          await screen.findByText(
            'PFA-ABC123',
          ),
        ).toBeTruthy()

        const confirmation =
          screen.getByRole('status')

        expect(
          confirmation,
        ).toHaveTextContent(
          'Pagamento confirmado',
        )

        expect(
          confirmation,
        ).toHaveTextContent(
          '2× Óleo Motor 5W30',
        )

        expect(
          confirmation,
        ).toHaveTextContent(
          'OIL-5W30-1L',
        )

        expect(
          confirmation,
        ).toHaveTextContent(
          'Capacidade: 1 L',
        )

        expect(
          confirmation,
        ).toHaveTextContent(
          /105,90\s*€/,
        )

        expect(
          window.localStorage.getItem(
            GUEST_CART_STORAGE_KEY,
          ),
        ).toBeNull()

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/orders/PFA-ABC123',
          {
            method: 'GET',
            cache: 'no-store',
          },
        )
      },
    )

    test(
      'indica pagamento pendente quando o webhook ainda não confirmou a encomenda',
      async () => {
        setSuccessUrl(
          'order=PFA-ABC123&session_id=cs_test_1',
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            order: createOrder({
              paymentStatus:
                'PENDING',
            }),
          }),
        )

        render(
          <CheckoutSuccessClient />,
        )

        expect(
          await screen.findByText(
            'PFA-ABC123',
          ),
        ).toBeTruthy()

        expect(
          screen.getByRole(
            'status',
          ),
        ).toHaveTextContent(
          'A aguardar confirmação do Stripe',
        )

        expect(
          window.localStorage.getItem(
            GUEST_CART_STORAGE_KEY,
          ),
        ).toBeNull()
      },
    )

    test(
      'pede nova sessão quando a API devolve 401',
      async () => {
        setSuccessUrl(
          'order=PFA-ABC123&session_id=cs_test_1',
        )

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
          <CheckoutSuccessClient />,
        )

        const alert =
          await screen.findByRole(
            'alert',
          )

        expect(alert).toHaveTextContent(
          'Sessão expirada',
        )

        expect(
          screen.getByRole('link', {
            name: 'Iniciar sessão',
          }),
        ).toHaveAttribute(
          'href',
          `/login?callbackUrl=${encodeURIComponent(
            '/checkout/sucesso?order=PFA-ABC123&session_id=cs_test_1',
          )}`,
        )
      },
    )

    test(
      'mostra o erro da API e mantém o carrinho local',
      async () => {
        setSuccessUrl(
          'order=PFA-ABC123&session_id=cs_test_1',
        )

        window.localStorage.setItem(
          GUEST_CART_STORAGE_KEY,
          JSON.stringify([
            {
              productId:
                'product-1',
              quantity: 2,
            },
          ]),
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              error:
                'Encomenda não encontrada',
            },
            404,
          ),
        )

        render(
          <CheckoutSuccessClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Encomenda não encontrada',
        )

        expect(
          JSON.parse(
            window.localStorage.getItem(
              GUEST_CART_STORAGE_KEY,
            ) ?? 'null',
          ),
        ).toEqual([
          {
            productId:
              'product-1',
            quantity: 2,
          },
        ])
      },
    )

    test(
      'rejeita resposta com detalhe de encomenda inválido',
      async () => {
        setSuccessUrl(
          'order=PFA-ABC123&session_id=cs_test_1',
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            order: {
              orderNumber:
                'PFA-ABC123',
            },
          }),
        )

        render(
          <CheckoutSuccessClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Resposta inválida do servidor',
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(1)
      },
    )
  },
)
