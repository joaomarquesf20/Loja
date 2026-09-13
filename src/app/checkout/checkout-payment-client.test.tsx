import {
  cleanup,
  fireEvent,
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

import { CheckoutClient } from './checkout-client'

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

function createAddress() {
  return {
    id: 'address-1',
    name: 'Maria Silva',
    addressLine1:
      'Rua Central 10',
    addressLine2: null,
    city: 'Porto',
    postalCode: '4000-001',
    country: 'Portugal',
  }
}

function createPreview() {
  return {
    fingerprint: 'ab'.repeat(32),
    subtotal: 100,
    shippingCost: 5.9,
    tax: 19.8,
    total: 105.9,
  }
}

function createPayment() {
  return {
    payment: {
      orderId: 'order-1',
      paymentStatus:
        'PENDING',
      paymentMethod:
        'INSTALLMENTS',
      installmentCount: 3,
      paymentProvider:
        'PFA_SIMULATED',
      paymentReference:
        'pfa_sim_installments',
      amount: '105.90',
    },
  }
}

function requestBody(
  callIndex: number,
) {
  const init = fetchMock.mock.calls[
    callIndex
  ]?.[1] as RequestInit | undefined

  if (
    !init ||
    typeof init.body !== 'string'
  ) {
    throw new Error(
      'Pedido sem body JSON no teste',
    )
  }

  return JSON.parse(
    init.body,
  ) as Record<string, unknown>
}

const fetchMock = vi.fn()

describe(
  'CheckoutClient payment terms',
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
      'envia CARD por defeito no preview',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [
                createAddress(),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview:
                createPreview(),
            }),
          )

        render(<CheckoutClient />)

        fireEvent.change(
          await screen.findByLabelText(
            'Telefone',
          ),
          {
            target: {
              value: '910000000',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Calcular total',
            },
          ),
        )

        await screen.findByRole(
          'button',
          {
            name: 'Criar encomenda',
          },
        )

        expect(
          requestBody(1),
        ).toMatchObject({
          paymentMethod: 'CARD',
          installmentCount: null,
        })
      },
    )

    test(
      'envia prestações como número inteiro no preview',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [
                createAddress(),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview:
                createPreview(),
            }),
          )

        render(<CheckoutClient />)

        const phone =
          await screen.findByLabelText(
            'Telefone',
          )

        fireEvent.click(
          screen.getByLabelText(
            'Pagamento em prestações',
          ),
        )

        fireEvent.change(
          screen.getByLabelText(
            'Número de prestações',
          ),
          {
            target: {
              value: '4',
            },
          },
        )

        fireEvent.change(
          phone,
          {
            target: {
              value: '910000000',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Calcular total',
            },
          ),
        )

        await screen.findByRole(
          'button',
          {
            name: 'Criar encomenda',
          },
        )

        expect(
          requestBody(1),
        ).toMatchObject({
          paymentMethod:
            'INSTALLMENTS',
          installmentCount: 4,
        })
      },
    )

    test(
      'alterar método de pagamento invalida o preview',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [
                createAddress(),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview:
                createPreview(),
            }),
          )

        render(<CheckoutClient />)

        fireEvent.change(
          await screen.findByLabelText(
            'Telefone',
          ),
          {
            target: {
              value: '910000000',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Calcular total',
            },
          ),
        )

        await screen.findByRole(
          'button',
          {
            name: 'Criar encomenda',
          },
        )

        fireEvent.click(
          screen.getByLabelText(
            'Pagamento em prestações',
          ),
        )

        expect(
          screen.queryByRole(
            'button',
            {
              name: 'Criar encomenda',
            },
          ),
        ).toBeNull()

        expect(
          screen.getByLabelText(
            'Número de prestações',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            'button',
            {
              name: 'Calcular total',
            },
          ),
        ).toBeEnabled()
      },
    )

    test(
      'envia os mesmos termos de prestações ao criar a encomenda',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [
                createAddress(),
              ],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview:
                createPreview(),
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              order: {
                id: 'order-1',
                orderNumber:
                  'PFA-ABC123',
                fulfillmentMethod:
                  'DELIVERY',
                paymentMethod:
                  'INSTALLMENTS',
                installmentCount: 3,
                subtotal: 100,
                shippingCost: 5.9,
                tax: 19.8,
                total: 105.9,
                status: 'PENDING',
                paymentStatus:
                  'PENDING',
              },
            }, 201),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              createPayment(),
            ),
          )

        render(<CheckoutClient />)

        const phone =
          await screen.findByLabelText(
            'Telefone',
          )

        fireEvent.click(
          screen.getByLabelText(
            'Pagamento em prestações',
          ),
        )

        fireEvent.change(
          screen.getByLabelText(
            'Número de prestações',
          ),
          {
            target: {
              value: '3',
            },
          },
        )

        fireEvent.change(
          phone,
          {
            target: {
              value: '910000000',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Calcular total',
            },
          ),
        )

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name: 'Criar encomenda',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Pagamento em 3 prestações',
        )

        expect(
          requestBody(2),
        ).toMatchObject({
          paymentMethod:
            'INSTALLMENTS',
          installmentCount: 3,
          expectedFingerprint:
            createPreview().fingerprint,
        })

        expect(
          await screen.findByText(
            'pfa_sim_installments',
          ),
        ).toBeTruthy()

        expect(
          fetchMock.mock.calls[3]?.[0],
        ).toBe(
          '/api/payments/initiate',
        )

        expect(
          requestBody(3),
        ).toEqual({
          orderId: 'order-1',
        })
      },
    )
  },
)
