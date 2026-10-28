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

const redirectMocks = vi.hoisted(
  () => ({
    redirectToExternalUrl:
      vi.fn(),
  }),
)

vi.mock(
  '@/lib/redirect',
  () => ({
    redirectToExternalUrl:
      redirectMocks.redirectToExternalUrl,
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
    expressAvailable: boolean
    /** Épico 7 — cupão aplicado ao preview. */
    discount: number
    couponCode: string
  }>,
) {
  return {
    fingerprint: 'ab'.repeat(32),
    subtotal: 100,
    shippingCost: 5.9,
    tax: 19.8,
    total: 105.9,
    expressAvailable: true,
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

function createCheckoutSession() {
  return {
    id: 'cs_test_123',
    url: 'https://stripe.test/pagar',
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
      redirectMocks.redirectToExternalUrl.mockReset()

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
              url ===
              '/api/checkout/stripe',
          ),
        ).toHaveLength(1)

        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              order:
                createOrder(),
              checkoutSession:
                createCheckoutSession(),
            },
            201,
          ),
        )

        fireEvent.click(
          freshCheckoutButton,
        )

        await waitFor(() => {
          expect(
            redirectMocks
              .redirectToExternalUrl,
          ).toHaveBeenCalledWith(
            'https://stripe.test/pagar',
          )
        })

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(5)

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
          fetchMock.mock.calls.filter(
            ([url]) =>
              url ===
              '/api/payments/initiate',
          ),
        ).toHaveLength(0)

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url === '/api/checkout',
          ),
        ).toHaveLength(0)
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
      'sem moradas mantém entrega disponível e mostra criação de morada',
      async () => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            addresses: [],
          }),
        )

        render(
          <CheckoutClient />,
        )

        const delivery =
          await screen.findByLabelText(
            'Entrega ao domicílio',
          )

        expect(
          delivery,
        ).toBeChecked()

        expect(
          delivery,
        ).toBeEnabled()

        expect(
          screen.getByLabelText(
            'Levantar em loja',
          ),
        ).toBeEnabled()

        expect(
          screen.getByText(
            /Ainda não tens moradas guardadas/,
          ),
        ).toBeTruthy()

        expect(
          screen.getByRole(
            'group',
            {
              name:
                'Adicionar nova morada',
            },
          ),
        ).toBeTruthy()

        expect(
          screen.getByLabelText(
            'País',
          ),
        ).toHaveValue('Portugal')
      },
    )

    test(
      'cria morada no checkout, guarda-a na conta e seleciona-a para entrega',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              {
                address:
                  createAddress(),
              },
              201,
            ),
          )

        render(
          <CheckoutClient />,
        )

        fireEvent.change(
          await screen.findByLabelText(
            'Nome',
          ),
          {
            target: {
              value: 'Maria Silva',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Morada nova',
          ),
          {
            target: {
              value:
                'Rua Central 10',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Localidade',
          ),
          {
            target: {
              value: 'Porto',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Código postal',
          ),
          {
            target: {
              value: '4000-001',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar e usar esta morada',
            },
          ),
        )

        expect(
          await screen.findByLabelText(
            'Morada',
          ),
        ).toHaveValue('address-1')

        expect(
          screen.getByLabelText(
            'Entrega ao domicílio',
          ),
        ).toBeChecked()

        expect(
          screen.getByText(
            'Rua Central 10',
          ),
        ).toBeTruthy()

        expect(
          fetchMock.mock.calls[1]?.[0],
        ).toBe('/api/addresses')

        const options =
          fetchMock.mock.calls[1]?.[1] as
            | RequestInit
            | undefined

        expect(options?.method).toBe(
          'POST',
        )

        expect(
          JSON.parse(
            String(options?.body),
          ),
        ).toEqual({
          name: 'Maria Silva',
          addressLine1:
            'Rua Central 10',
          addressLine2: '',
          city: 'Porto',
          postalCode: '4000-001',
          country: 'Portugal',
        })
      },
    )

    test(
      'edita a morada selecionada no checkout e exige novo preview',
      async () => {
        const updatedAddress = {
          ...createAddress(),
          addressLine1:
            'Avenida Central 25',
          city: 'Braga',
          postalCode: '4700-001',
        }

        await requestDeliveryPreview()

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Editar morada',
            },
          ),
        )

        expect(
          screen.getByRole(
            'group',
            {
              name: 'Editar morada',
            },
          ),
        ).toBeTruthy()

        expect(
          screen.getByLabelText(
            'Nome',
          ),
        ).toHaveValue('Maria Silva')

        expect(
          screen.getByLabelText(
            'Morada (linha 1)',
          ),
        ).toHaveValue(
          'Rua Central 10',
        )

        fireEvent.change(
          screen.getByLabelText(
            'Morada (linha 1)',
          ),
          {
            target: {
              value:
                'Avenida Central 25',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Localidade',
          ),
          {
            target: {
              value: 'Braga',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Código postal',
          ),
          {
            target: {
              value: '4700-001',
            },
          },
        )

        fetchMock.mockResolvedValueOnce(
          jsonResponse({
            address: updatedAddress,
          }),
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar alterações',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Avenida Central 25',
          ),
        ).toBeTruthy()

        expect(
          screen.getByLabelText(
            'Morada',
          ),
        ).toHaveValue('address-1')

        expect(
          screen.queryByRole(
            'group',
            {
              name: 'Editar morada',
            },
          ),
        ).toBeNull()

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
          fetchMock.mock.calls[2]?.[0],
        ).toBe('/api/addresses')

        const options =
          fetchMock.mock.calls[2]?.[1] as
            | RequestInit
            | undefined

        expect(options?.method).toBe(
          'PATCH',
        )

        expect(
          JSON.parse(
            String(options?.body),
          ),
        ).toEqual({
          addressId: 'address-1',
          name: 'Maria Silva',
          addressLine1:
            'Avenida Central 25',
          addressLine2: '',
          city: 'Braga',
          postalCode: '4700-001',
          country: 'Portugal',
        })
      },
    )

    test(
      'permite cancelar a edição sem alterar a morada',
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

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name: 'Editar morada',
            },
          ),
        )

        fireEvent.change(
          screen.getByLabelText(
            'Morada (linha 1)',
          ),
          {
            target: {
              value:
                'Rua que não deve ser guardada',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Cancelar edição',
            },
          ),
        )

        expect(
          screen.queryByRole(
            'group',
            {
              name: 'Editar morada',
            },
          ),
        ).toBeNull()

        expect(
          screen.getByText(
            'Rua Central 10',
          ),
        ).toBeTruthy()

        expect(
          screen.getByRole(
            'button',
            {
              name: 'Editar morada',
            },
          ),
        ).toBeEnabled()

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'apaga a morada selecionada, escolhe a seguinte e invalida o preview',
      async () => {
        const secondAddress = {
          ...createAddress(),
          id: 'address-2',
          name: 'Ana Costa',
          addressLine1:
            'Rua Nova 20',
        }

        await requestDeliveryPreview(
          createPreview(),
          [
            createAddress(),
            secondAddress,
          ],
        )

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Apagar morada',
            },
          ),
        )

        expect(
          screen.getByRole(
            'group',
            {
              name:
                'Confirmar eliminação da morada',
            },
          ),
        ).toBeTruthy()

        fetchMock.mockResolvedValueOnce(
          new Response(null, {
            status: 204,
          }),
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Confirmar eliminação',
            },
          ),
        )

        await waitFor(() => {
          expect(
            screen.getByLabelText(
              'Morada',
            ),
          ).toHaveValue('address-2')
        })

        expect(
          screen.queryByText(
            'Rua Central 10',
          ),
        ).toBeNull()

        expect(
          screen.getByText(
            'Rua Nova 20',
          ),
        ).toBeTruthy()

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
          fetchMock.mock.calls[2]?.[0],
        ).toBe('/api/addresses')

        const options =
          fetchMock.mock.calls[2]?.[1] as
            | RequestInit
            | undefined

        expect(options?.method).toBe(
          'DELETE',
        )

        expect(
          JSON.parse(
            String(options?.body),
          ),
        ).toEqual({
          addressId: 'address-1',
        })
      },
    )

    test(
      'ao apagar a última morada mantém entrega disponível e abre criação de morada',
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
            new Response(null, {
              status: 204,
            }),
          )

        render(
          <CheckoutClient />,
        )

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name: 'Apagar morada',
            },
          ),
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Confirmar eliminação',
            },
          ),
        )

        expect(
          await screen.findByText(
            /Ainda não tens moradas guardadas/,
          ),
        ).toBeTruthy()

        expect(
          screen.getByLabelText(
            'Entrega ao domicílio',
          ),
        ).toBeChecked()

        expect(
          screen.queryByLabelText(
            'Morada',
          ),
        ).toBeNull()

        expect(
          screen.getByRole(
            'group',
            {
              name:
                'Adicionar nova morada',
            },
          ),
        ).toBeTruthy()

        expect(
          fetchMock.mock.calls[1]?.[0],
        ).toBe('/api/addresses')

        const options =
          fetchMock.mock.calls[1]?.[1] as
            | RequestInit
            | undefined

        expect(options?.method).toBe(
          'DELETE',
        )

        expect(
          JSON.parse(
            String(options?.body),
          ),
        ).toEqual({
          addressId: 'address-1',
        })
      },
    )

    test(
      'permite cancelar a eliminação sem apagar a morada',
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

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name: 'Apagar morada',
            },
          ),
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Cancelar',
            },
          ),
        )

        expect(
          screen.queryByRole(
            'group',
            {
              name:
                'Confirmar eliminação da morada',
            },
          ),
        ).toBeNull()

        expect(
          screen.getByText(
            'Rua Central 10',
          ),
        ).toBeTruthy()

        expect(
          screen.getByRole(
            'button',
            {
              name: 'Apagar morada',
            },
          ),
        ).toBeEnabled()

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'mantém formulário de morada quando a criação falha',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              addresses: [],
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              {
                error:
                  'Código postal inválido',
              },
              400,
            ),
          )

        render(
          <CheckoutClient />,
        )

        fireEvent.click(
          await screen.findByRole(
            'button',
            {
              name:
                'Guardar e usar esta morada',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Código postal inválido',
        )

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar e usar esta morada',
            },
          ),
        ).toBeEnabled()

        expect(
          screen.getByRole(
            'group',
            {
              name:
                'Adicionar nova morada',
            },
          ),
        ).toBeTruthy()
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
          couponCode: null,
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
          shippingMethod:
            'STANDARD',
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

        fireEvent.click(
          await screen.findByLabelText(
            'Levantar em loja',
          ),
        )

        fireEvent.change(
          screen.getByLabelText(
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
          couponCode: null,
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
      'submete o checkout de entrega ao Stripe e navega para o pagamento',
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
                checkoutSession:
                  createCheckoutSession(),
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

        await waitFor(() => {
          expect(
            redirectMocks
              .redirectToExternalUrl,
          ).toHaveBeenCalledWith(
            'https://stripe.test/pagar',
          )
        })

        expect(
          fetchMock.mock.calls[2]?.[0],
        ).toBe(
          '/api/checkout/stripe',
        )

        expect(
          redirectMocks
            .redirectToExternalUrl,
        ).toHaveBeenCalledTimes(1)

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(3)

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url ===
              '/api/payments/initiate',
          ),
        ).toHaveLength(0)

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
          shippingMethod:
            'STANDARD',
        })
      },
    )

    test(
      'submete o checkout de levantamento ao Stripe sem morada',
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
                checkoutSession:
                  createCheckoutSession(),
              },
              201,
            ),
          )

        render(
          <CheckoutClient />,
        )

        fireEvent.click(
          await screen.findByLabelText(
            'Levantar em loja',
          ),
        )

        fireEvent.change(
          screen.getByLabelText(
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

        await waitFor(() => {
          expect(
            redirectMocks
              .redirectToExternalUrl,
          ).toHaveBeenCalledWith(
            'https://stripe.test/pagar',
          )
        })

        expect(
          fetchMock.mock.calls[2]?.[0],
        ).toBe(
          '/api/checkout/stripe',
        )

        expect(
          redirectMocks
            .redirectToExternalUrl,
        ).toHaveBeenCalledTimes(1)

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(3)

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url ===
              '/api/payments/initiate',
          ),
        ).toHaveLength(0)

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
      'permite nova tentativa depois de o Stripe devolver erro temporário',
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
                error:
                  'O pagamento por Stripe falhou temporariamente',
                code: 'STRIPE_UNAVAILABLE',
              },
              502,
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
          'O pagamento por Stripe falhou temporariamente',
        )

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url ===
              '/api/checkout/stripe',
          ),
        ).toHaveLength(1)

        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            {
              order:
                createOrder(),
              checkoutSession:
                createCheckoutSession(),
            },
            201,
          ),
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          ),
        )

        await waitFor(() => {
          expect(
            redirectMocks
              .redirectToExternalUrl,
          ).toHaveBeenCalledWith(
            'https://stripe.test/pagar',
          )
        })

        expect(
          fetchMock.mock.calls.filter(
            ([url]) =>
              url ===
              '/api/checkout/stripe',
          ),
        ).toHaveLength(2)
      },
    )

    test(
      'apresenta velocidade de entrega e recalcula com o envio expresso',
      async () => {
        await requestDeliveryPreview()

        const standardRadio =
          await screen.findByLabelText(
            'Envio standard',
          )

        expect(standardRadio).toBeChecked()

        const expressRadio =
          await screen.findByLabelText(
            'Envio expresso',
          )

        expect(expressRadio).toBeEnabled()

        fireEvent.click(
          expressRadio,
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

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              preview: createPreview({
                shippingCost: 15.8,
                tax: 20.7,
                total: 115.7,
              }),
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

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        const previewOptions =
          fetchMock.mock
            .calls[2]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              previewOptions?.body,
            ),
          ),
        ).toEqual({
          couponCode: null,
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
            addressLine2: null,
            city: 'Porto',
            postalCode:
              '4000-001',
            country:
              'Portugal',
            region:
              'PORTUGAL_MAINLAND',
          },
          shippingMethod:
            'EXPRESS',
        })
      },
    )

    test(
      'desativa o envio expresso quando o preview indica indisponibilidade',
      async () => {
        await requestDeliveryPreview(
          createPreview({
            expressAvailable: false,
          }),
        )

        expect(
          await screen.findByLabelText(
            'Envio expresso',
          ),
        ).toBeDisabled()

        expect(
          await screen.findByLabelText(
            'Envio standard',
          ),
        ).toBeEnabled()
      },
    )

    test(
      'não navega quando o URL da sessão Stripe não é http(s)',
      async () => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse(
              {
                addresses: [
                  createAddress(),
                ],
              },
            ),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              {
                preview:
                  createPreview(),
              },
            ),
          )
          .mockResolvedValueOnce(
            jsonResponse(
              {
                order:
                  createOrder(),
                checkoutSession: {
                  id: 'cs_test_123',
                  url: 'javascript:alert(1)',
                },
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
          'Resposta inválida do servidor',
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

        expect(
          redirectMocks
            .redirectToExternalUrl,
        ).not.toHaveBeenCalled()
      },
    )

    // Épico 7 — fluxos do cupão de desconto: validar no endpoint
    // (subtotal calculado no servidor), aplicar → recalcular preview,
    // remover e enviar o cupão no pedido de criação da encomenda.
    test(
      'aplica cupão válido e recalcula o preview com desconto',
      async () => {
        await requestDeliveryPreview()

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              valid: true,
              code: 'PROMO10',
              discount: 10,
              newTotal: 90,
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview: createPreview({
                total: 90,
                discount: 10,
                couponCode:
                  'PROMO10',
              }),
            }),
          )

        fireEvent.change(
          screen.getByLabelText(
            'Cupão de desconto',
          ),
          {
            target: {
              value: 'promo10',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Aplicar',
            },
          ),
        )

        await screen.findByText(
          'Cupão PROMO10 aplicado.',
        )

        const validateOptions =
          fetchMock.mock
            .calls[2]?.[1] as
            | RequestInit
            | undefined

        expect(
          validateOptions?.method,
        ).toBe('POST')
        expect(
          JSON.parse(
            String(
              validateOptions?.body,
            ),
          ),
        ).toEqual({
          code: 'PROMO10',
        })

        // o preview é recalculado com o cupão aplicado
        const previewOptions =
          fetchMock.mock
            .calls[3]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              previewOptions?.body,
            ),
          ).couponCode,
        ).toBe('PROMO10')

        expect(
          screen.getByText(
            /Desconto/,
          ),
        ).toBeTruthy()
      },
    )

    test(
      'cupão inválido mostra a mensagem do servidor e não recalcula',
      async () => {
        await requestDeliveryPreview()

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              valid: false,
              reason: 'EXPIRED',
              message:
                'Este cupão expirou.',
            }),
          )

        fireEvent.change(
          screen.getByLabelText(
            'Cupão de desconto',
          ),
          {
            target: {
              value: 'PROMO10',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Aplicar',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Este cupão expirou.',
          ),
        ).toBeTruthy()

        // validar + carregamento inicial apenas: sem recálculo
        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(3)
      },
    )

    test(
      'remove cupão e recalcula o preview sem desconto',
      async () => {
        await requestDeliveryPreview()

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              valid: true,
              code: 'PROMO10',
              discount: 10,
              newTotal: 90,
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview: createPreview({
                total: 90,
                discount: 10,
                couponCode:
                  'PROMO10',
              }),
            }),
          )

        fireEvent.change(
          screen.getByLabelText(
            'Cupão de desconto',
          ),
          {
            target: {
              value: 'PROMO10',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Aplicar',
            },
          ),
        )

        await screen.findByText(
          'Cupão PROMO10 aplicado.',
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              preview:
                createPreview(),
            }),
          )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Remover',
            },
          ),
        )

        await waitFor(() => {
          expect(
            fetchMock,
          ).toHaveBeenCalledTimes(5)
        })

        const previewOptions =
          fetchMock.mock
            .calls[4]?.[1] as
            | RequestInit
            | undefined

        expect(
          JSON.parse(
            String(
              previewOptions?.body,
            ),
          ).couponCode,
        ).toBeNull()

        expect(
          screen.getByLabelText(
            'Cupão de desconto',
          ),
        ).toHaveValue('')

        expect(
          screen.queryByText(
            'Cupão PROMO10 aplicado.',
          ),
        ).toBeNull()
      },
    )

    test(
      'envia o cupão aplicado no pedido de criação da encomenda',
      async () => {
        await requestDeliveryPreview()

        await screen.findByRole(
          'button',
          {
            name:
              'Criar encomenda',
          },
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({
              valid: true,
              code: 'PROMO10',
              discount: 10,
              newTotal: 90,
            }),
          )
          .mockResolvedValueOnce(
            jsonResponse({
              preview: createPreview({
                total: 90,
                discount: 10,
                couponCode:
                  'PROMO10',
              }),
            }),
          )

        fireEvent.change(
          screen.getByLabelText(
            'Cupão de desconto',
          ),
          {
            target: {
              value: 'PROMO10',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Aplicar',
            },
          ),
        )

        await screen.findByText(
          'Cupão PROMO10 aplicado.',
        )

        fetchMock
          .mockResolvedValueOnce(
            jsonResponse(
              {
                order:
                  createOrder(
                    'DELIVERY',
                  ),
                checkoutSession:
                  createCheckoutSession(),
              },
              201,
            ),
          )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Criar encomenda',
            },
          ),
        )

        await waitFor(() => {
          expect(
            redirectMocks
              .redirectToExternalUrl,
          ).toHaveBeenCalledWith(
            'https://stripe.test/pagar',
          )
        })

        const checkoutOptions =
          fetchMock.mock
            .calls[4]?.[1] as
            | RequestInit
            | undefined

        const checkoutBody = JSON.parse(
          String(
            checkoutOptions?.body,
          ),
        )

        expect(
          checkoutBody.couponCode,
        ).toBe('PROMO10')
        expect(
          checkoutBody.expectedFingerprint,
        ).toBe('ab'.repeat(32))
      },
    )
  },
)
