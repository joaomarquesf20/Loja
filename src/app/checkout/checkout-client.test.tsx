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

const navigationMocks = vi.hoisted(
  () => ({
    replace: vi.fn(),
  }),
)

vi.mock(
  'next/navigation',
  () => ({
    useRouter: () => ({
      replace:
        navigationMocks.replace,
    }),
  }),
)

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

function createPreview(
  overrides?: Partial<{
    fingerprint: string
    subtotal: number
    shippingCost: number
    tax: number
    total: number
  }>,
) {
  return {
    fingerprint: 'ab'.repeat(32),
    subtotal: 100,
    shippingCost: 5.9,
    tax: 19.8,
    total: 105.9,
    ...overrides,
  }
}

function createOrder(
  fulfillmentMethod:
    | 'DELIVERY'
    | 'PICKUP' = 'DELIVERY',
) {
  return {
    id: 'order-1',
    orderNumber:
      'PFA-ABC123',
    fulfillmentMethod,
    subtotal: 100,
    shippingCost:
      fulfillmentMethod ===
      'PICKUP'
        ? 0
        : 5.9,
    tax: 19.8,
    total:
      fulfillmentMethod ===
      'PICKUP'
        ? 100
        : 105.9,
    status: 'PENDING',
    paymentMethod: 'CARD',
    installmentCount: null,
    paymentStatus:
      'PENDING',
  }
}

function createPayment(
  overrides?: Partial<{
    paymentMethod:
      | 'CARD'
      | 'INSTALLMENTS'
    installmentCount:
      number | null
    amount: string
  }>,
) {
  return {
    payment: {
      orderId: 'order-1',
      paymentStatus:
        'PENDING',
      paymentMethod: 'CARD',
      installmentCount: null,
      paymentProvider:
        'PFA_SIMULATED',
      paymentReference:
        'pfa_sim_reference',
      amount: '105.90',
      ...overrides,
    },
  }
}

const fetchMock = vi.fn()

async function requestDeliveryPreview(
  preview: unknown = createPreview(),
  addresses = [createAddress()],
) {
  fetchMock
    .mockResolvedValueOnce(
      jsonResponse({ addresses }),
    )
    .mockResolvedValueOnce(
      jsonResponse({ preview }),
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
    screen.getByRole('button', {
      name: 'Calcular total',
    }),
  )
}

describe(
  'CheckoutClient',
  () => {
    beforeEach(() => {
      fetchMock.mockReset()
      navigationMocks.replace.mockReset()

      vi.stubGlobal(
        'fetch',
        fetchMock,
      )
    })

    afterEach(() => {
      cleanup()
      vi.unstubAllGlobals()
    })

    test.each([
      undefined,
      null,
      123,
      '',
      'a'.repeat(63),
      'a'.repeat(65),
      'A'.repeat(64),
      'g'.repeat(64),
      'a'.repeat(64) + '\n',
    ])(
      'rejeita preview com fingerprint inválido %j',
      async (fingerprint) => {
        await requestDeliveryPreview({
          ...createPreview(),
          fingerprint,
        })

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Resposta inválida do servidor',
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

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(2)
      },
    )

    test.each([
      'Morada',
      'Telefone',
    ])(
      'alterar %s exige novo preview antes de submeter',
      async (field) => {
        await requestDeliveryPreview(
          createPreview(),
          [
            createAddress(),
            {
              ...createAddress(),
              id: 'address-2',
              addressLine1:
                'Rua Nova 20',
            },
          ],
        )

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            field,
          ),
          {
            target: {
              value:
                field === 'Morada'
                  ? 'address-2'
                  : '910000001',
            },
          },
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

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Calcular total',
            },
          ),
        ).toBeEnabled()

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(2)
      },
    )

    test(
      'alterar método de receção invalida o preview',
      async () => {
        await requestDeliveryPreview()

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        fireEvent.click(
          screen.getByLabelText(
            'Levantar em loja',
          ),
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

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Calcular total',
            },
          ),
        ).toBeEnabled()
      },
    )

    test.each([
      {
        error:
          'O checkout foi alterado. Calcula novamente o total antes de criar a encomenda.',
        code:
          'CHECKOUT_PREVIEW_CHANGED',
      },
      {
        error:
          'Existe stock insuficiente para um produto do carrinho',
      },
      {
        error:
          'O carrinho está vazio',
      },
      {
        error:
          'Existe um produto indisponível no carrinho',
      },
      {
        error:
          'O carrinho ou o stock foi alterado durante o checkout',
      },
      {
        error:
          'Configuração de preços do checkout inválida',
      },
    ])(
      'invalida preview após conflito e exige ações explícitas (%j)',
      async (conflict) => {
        await requestDeliveryPreview()

        const checkoutButton =
          await screen.findByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          )

        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            conflict,
            409,
          ),
        )

        fireEvent.click(
          checkoutButton,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          conflict.error,
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

        const freshPreview = {
          ...createPreview(),
          fingerprint:
            'cd'.repeat(32),
        }

        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            preview: freshPreview,
          }),
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

        const freshCheckoutButton =
          await screen.findByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          )

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url === '/api/checkout',
          ),
        ).toHaveLength(1)

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse(
              {
                order:
                  createOrder(),
              },
              201,
            ),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              createPayment(),
            ),
          )

        fireEvent.click(
          freshCheckoutButton,
        )

        await screen.findByText(
          'pfa_sim_reference',
        )

        const finalOptions =
          fetchMock.mock.calls[4]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              finalOptions?.body,
            ),
          ),
        ).toMatchObject({
          expectedFingerprint:
            freshPreview.fingerprint,
        })

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(6)

        expect(
          fetchMock.mock.calls[5]?.[0],
        ).toBe(
          '/api/payments/initiate',
        )

        expect(
          JSON.parse(
            String(
              (
                fetchMock.mock.calls[5]?.[1] as
                  | RequestInit
                  | undefined
              )?.body,
            ),
          ),
        ).toEqual({
          orderId: 'order-1',
        })
      },
    )

    test.each([400, 500])(
      'não invalida preview por erro sem conflito (%s)',
      async (status) => {
        await requestDeliveryPreview()

        const checkoutButton =
          await screen.findByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          )

        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              error:
                'Erro no pedido',
            },
            status,
          ),
        )

        fireEvent.click(
          checkoutButton,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Erro no pedido',
        )

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          ),
        ).toBeEnabled()
      },
    )

    test(
      'carrega moradas e apresenta os dois métodos para utilizador autenticado',
      async () => {
        fetchMock.mockResolvedValueOnce(
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
            'Entrega ao domicílio',
          ),
        ).toBeChecked()

        expect(
          screen.getByLabelText(
            'Levantar em loja',
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
      'encaminha para o login com retorno ao checkout quando a API de moradas devolve 401',
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
          <CheckoutClient />,
        )

        expect(
          await screen.findByText(
            'Inicia sessão para finalizar a compra',
          ),
        ).toBeTruthy()

        await waitFor(() => {
          expect(
            navigationMocks.replace,
          ).toHaveBeenCalledWith(
            '/login?callbackUrl=%2Fcheckout',
          )
        })

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
          '/login?callbackUrl=%2Fcheckout',
        )
      },
    )

    test(
      'sem moradas permite levantamento em loja',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            addresses: [],
          }),
        )

        render(
          <CheckoutClient />,
        )

        const pickup =
          await screen.findByLabelText(
            'Levantar em loja',
          )

        expect(
          pickup,
        ).toBeChecked()

        expect(
          screen.getByLabelText(
            'Entrega ao domicílio',
          ),
        ).toBeDisabled()

        expect(
          screen.getByLabelText(
            'Nome de contacto',
          ),
        ).toBeTruthy()

        expect(
          screen.queryByText(
            'Não tens moradas guardadas',
          ),
        ).toBeNull()
      },
    )

    test(
      'calcula preview de entrega com método e morada',
      async () => {
        await requestDeliveryPreview()

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        const options =
          fetchMock.mock.calls[1]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              options?.body,
            ),
          ),
        ).toEqual({
          fulfillmentMethod:
            'DELIVERY',
          paymentMethod: 'CARD',
          installmentCount: null,
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
      'calcula preview de levantamento sem exigir morada',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview:
                createPreview({
                  shippingCost: 0,
                  total: 100,
                }),
            }),
          )

        render(
          <CheckoutClient />,
        )

        fireEvent.change(
          await screen.findByLabelText(
            'Nome de contacto',
          ),
          {
            target: {
              value:
                'Maria Silva',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
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

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        const options =
          fetchMock.mock.calls[1]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              options?.body,
            ),
          ),
        ).toEqual({
          fulfillmentMethod:
            'PICKUP',
          paymentMethod: 'CARD',
          installmentCount: null,
          shipping: {
            name: 'Maria Silva',
            phone:
              '910000000',
          },
        })
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
      'cria encomenda de entrega com fingerprint e método aceites',
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
          .mockResolvedValueOnce(
            jsonResponse(
              createPayment(),
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
          screen.getByText(
            'Entrega ao domicílio',
          ),
        ).toBeTruthy()

        expect(
          await screen.findByText(
            'pfa_sim_reference',
          ),
        ).toBeTruthy()

        expect(
          fetchMock.mock.calls[3]?.[0],
        ).toBe(
          '/api/payments/initiate',
        )

        const initiationOptions =
          fetchMock.mock.calls[3]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              initiationOptions?.body,
            ),
          ),
        ).toEqual({
          orderId: 'order-1',
        })

        const options =
          fetchMock.mock.calls[2]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              options?.body,
            ),
          ),
        ).toEqual({
          fulfillmentMethod:
            'DELIVERY',
          paymentMethod: 'CARD',
          installmentCount: null,
          expectedFingerprint:
            createPreview()
              .fingerprint,
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

    test(
      'cria encomenda de levantamento sem enviar morada',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview:
                createPreview({
                  shippingCost: 0,
                  total: 100,
                }),
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              {
                order:
                  createOrder(
                    'PICKUP',
                  ),
              },
              201,
            ),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              createPayment({
                amount: '100.00',
              }),
            ),
          )

        render(
          <CheckoutClient />,
        )

        fireEvent.change(
          await screen.findByLabelText(
            'Nome de contacto',
          ),
          {
            target: {
              value:
                'Maria Silva',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
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

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Encomenda criada',
          ),
        ).toBeTruthy()

        expect(
          screen.getByText(
            'Levantamento em loja',
          ),
        ).toBeTruthy()

        expect(
          screen.getByText(
            /pagamento ser confirmado/,
          ),
        ).toBeTruthy()

        expect(
          await screen.findByText(
            'pfa_sim_reference',
          ),
        ).toBeTruthy()

        expect(
          fetchMock.mock.calls[3]?.[0],
        ).toBe(
          '/api/payments/initiate',
        )

        const initiationOptions =
          fetchMock.mock.calls[3]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              initiationOptions?.body,
            ),
          ),
        ).toEqual({
          orderId: 'order-1',
        })

        const options =
          fetchMock.mock.calls[2]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              options?.body,
            ),
          ),
        ).toEqual({
          fulfillmentMethod:
            'PICKUP',
          paymentMethod: 'CARD',
          installmentCount: null,
          expectedFingerprint:
            createPreview()
              .fingerprint,
          shipping: {
            name: 'Maria Silva',
            phone:
              '910000000',
          },
        })
      },
    )

    test(
      'repete apenas a iniciação do pagamento quando a encomenda já foi criada',
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
          .mockResolvedValueOnce(
            jsonResponse(
              {
                error:
                  'Falha temporária no pagamento',
              },
              500,
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

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Falha temporária no pagamento',
        )

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url === '/api/checkout',
          ),
        ).toHaveLength(1)

        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            createPayment(),
          ),
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Tentar iniciar pagamento novamente',
            },
          ),
        )

        expect(
          await screen.findByText(
            'pfa_sim_reference',
          ),
        ).toBeTruthy()

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url === '/api/checkout',
          ),
        ).toHaveLength(1)

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url ===
              '/api/payments/initiate',
          ),
        ).toHaveLength(2)

        const retryOptions =
          fetchMock.mock.calls[4]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              retryOptions?.body,
            ),
          ),
        ).toEqual({
          orderId: 'order-1',
        })
      },
    )
  },
)
