import {
  cleanup,
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
    subtotal: 100,
    shippingCost: 5.9,
    tax: 19.8,
    total: 105.9,
  }
}

function createOrder() {
  return {
    id: 'order-1',
    orderNumber:
      'PFA-ABC123',
    subtotal: 100,
    shippingCost: 5.9,
    tax: 19.8,
    total: 105.9,
    status: 'PENDING',
    paymentStatus:
      'UNPAID',
  }
}

const fetchMock = vi.fn()

describe(
  'CheckoutClient',
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
      'carrega moradas para utilizador autenticado',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [
                createAddress(),
              ],
            }),
          )

        render(
          <CheckoutClient />,
        )

        expect(
          await screen.findByText(
            'Maria Silva',
            {
              selector: 'p',
            },
          ),
        ).toBeTruthy()

        expect(
          screen.getByLabelText(
            'Telefone',
          ),
        ).toBeTruthy()

        expect(
          screen.getByText(
            /Portugal Continental/,
          ),
        ).toBeTruthy()

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/addresses',
          {
            method: 'GET',
            cache: 'no-store',
          },
        )
      },
    )

    test(
      'pede autenticação quando a API de moradas devolve 401',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse(
              {
                error:
                  'Não autenticado',
              },
              401,
            ),
          )

        render(
          <CheckoutClient />,
        )

        expect(
          await screen.findByText(
            'Inicia sessão para finalizar a compra',
          ),
        ).toBeTruthy()

        expect(
          screen.getByRole(
            'link',
            {
              name:
                'Iniciar sessão',
            },
          ),
        ).toHaveAttribute(
          'href',
          '/login',
        )
      },
    )

    test(
      'mostra estado sem moradas',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [],
            }),
          )

        render(
          <CheckoutClient />,
        )

        expect(
          await screen.findByText(
            'Não tens moradas guardadas',
          ),
        ).toBeTruthy()

        expect(
          screen.getByRole(
            'link',
            {
              name:
                'Gerir moradas',
            },
          ),
        ).toHaveAttribute(
          'href',
          '/conta',
        )
      },
    )

    test(
      'calcula preview com morada e telefone',
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

        render(
          <CheckoutClient />,
        )

        const phone =
          await screen.findByLabelText(
            'Telefone',
          )

        fireEvent.change(
          phone,
          {
            target: {
              value:
                '910000000',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Calcular total',
            },
          ),
        )

        await waitFor(() => {
          expect(
            screen.getByRole(
              'button',
              {
                name:
                  'Criar encomenda',
              },
            ),
          ).toBeTruthy()
        })

        expect(
          fetchMock.mock
            .calls[1]?.[0],
        ).toBe(
          '/api/checkout/preview',
        )

        const options =
          fetchMock.mock
            .calls[1]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              options?.body,
            ),
          ),
        ).toEqual({
          shipping: {
            name: 'Maria Silva',
            phone:
              '910000000',
            addressLine1:
              'Rua Central 10',
            addressLine2:
              null,
            city: 'Porto',
            postalCode:
              '4000-001',
            country:
              'Portugal',
            region:
              'PORTUGAL_MAINLAND',
          },
        })

        expect(
          screen.getByText(
            'Portes',
          ),
        ).toBeTruthy()

        expect(
          screen.getByText(
            'IVA incluído',
          ),
        ).toBeTruthy()
      },
    )

    test(
      'mostra erro devolvido pelo preview',
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
            jsonResponse(
              {
                error:
                  'Existe stock insuficiente',
              },
              409,
            ),
          )

        render(
          <CheckoutClient />,
        )

        fireEvent.change(
          await screen.findByLabelText(
            'Telefone',
          ),
          {
            target: {
              value:
                '910000000',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Calcular total',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Existe stock insuficiente',
        )

        expect(
          screen.queryByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          ),
        ).toBeNull()
      },
    )

    test(
      'cria encomenda depois de preview válido',
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
            jsonResponse(
              {
                order:
                  createOrder(),
              },
              201,
            ),
          )

        render(
          <CheckoutClient />,
        )

        fireEvent.change(
          await screen.findByLabelText(
            'Telefone',
          ),
          {
            target: {
              value:
                '910000000',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Calcular total',
            },
          ),
        )

        const checkoutButton =
          await screen.findByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          )

        fireEvent.click(
          checkoutButton,
        )

        expect(
          await screen.findByText(
            'Encomenda criada',
          ),
        ).toBeTruthy()

        expect(
          screen.getByText(
            'PFA-ABC123',
          ),
        ).toBeTruthy()

        expect(
          fetchMock.mock
            .calls[2]?.[0],
        ).toBe(
          '/api/checkout',
        )

        const options =
          fetchMock.mock
            .calls[2]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              options?.body,
            ),
          ),
        ).toEqual({
          shipping: {
            name: 'Maria Silva',
            phone:
              '910000000',
            addressLine1:
              'Rua Central 10',
            addressLine2:
              null,
            city: 'Porto',
            postalCode:
              '4000-001',
            country:
              'Portugal',
            region:
              'PORTUGAL_MAINLAND',
          },
        })
      },
    )
  },
)