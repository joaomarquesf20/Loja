import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'

import CommercialSettingsClient from './commercial-settings-client'

const settings = {
  store: {
    id: 'store',
    pricesIncludeTax: true,
  },
  regions: [
    {
      region:
        'PORTUGAL_MAINLAND',
      checkoutEnabled: true,
      taxRatePercent: '23.00',
      shippingRules: [
        {
          id: 'small-rule',
          region:
            'PORTUGAL_MAINLAND',
          shippingClass: 'SMALL',
          checkoutEnabled: true,
          shippingCost: '5.90',
          maximumShippingCost:
            null,
          freeShippingThreshold:
            '150.00',
        },
        {
          id: 'standard-rule',
          region:
            'PORTUGAL_MAINLAND',
          shippingClass:
            'STANDARD',
          checkoutEnabled: true,
          shippingCost: '8.90',
          maximumShippingCost:
            null,
          freeShippingThreshold:
            '150.00',
        },
        {
          id: 'bulky-rule',
          region:
            'PORTUGAL_MAINLAND',
          shippingClass: 'BULKY',
          checkoutEnabled: true,
          shippingCost: '19.90',
          maximumShippingCost:
            '29.90',
          freeShippingThreshold:
            null,
        },
      ],
    },
  ],
}

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return {
    ok:
      status >= 200 &&
      status < 300,
    status,
    json: vi
      .fn()
      .mockResolvedValue(body),
  } as unknown as Response
}

const mockFetch = vi.fn()

function installSuccessfulFetch() {
  mockFetch.mockImplementation(
    async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      if (
        !init?.method ||
        init.method === 'GET'
      ) {
        return jsonResponse(
          settings,
        )
      }

      const body = JSON.parse(
        String(init.body),
      ) as {
        target: string
        region?: string
        shippingClass?: string
        data?: Record<
          string,
          unknown
        >
      }

      if (
        body.target === 'store'
      ) {
        return jsonResponse({
          id: 'store',
          pricesIncludeTax:
            body.data
              ?.pricesIncludeTax,
        })
      }

      if (
        body.target === 'region'
      ) {
        const taxRate =
          body.data
            ?.taxRatePercent

        return jsonResponse({
          region:
            'PORTUGAL_MAINLAND',
          checkoutEnabled:
            body.data
              ?.checkoutEnabled,
          taxRatePercent:
            taxRate === null
              ? null
              : Number(
                  taxRate,
                ).toFixed(2),
        })
      }

      if (
        body.target ===
        'shipping-rule'
      ) {
        const shippingCost =
          body.data
            ?.shippingCost

        const maximum =
          body.data
            ?.maximumShippingCost

        const threshold =
          body.data
            ?.freeShippingThreshold

        return jsonResponse({
          id: `${body.shippingClass}-rule`,
          region:
            'PORTUGAL_MAINLAND',
          shippingClass:
            body.shippingClass,
          checkoutEnabled:
            body.data
              ?.checkoutEnabled,
          shippingCost:
            shippingCost ===
            null
              ? null
              : Number(
                  shippingCost,
                ).toFixed(2),
          maximumShippingCost:
            maximum === null
              ? null
              : Number(
                  maximum,
                ).toFixed(2),
          freeShippingThreshold:
            threshold === null
              ? null
              : Number(
                  threshold,
                ).toFixed(2),
        })
      }

      return jsonResponse(
        {
          error:
            'Operação inválida',
        },
        400,
      )
    },
  )
}

function getPatchBodies() {
  return mockFetch.mock.calls
    .filter((call) => {
      const init =
        call[1] as
          | RequestInit
          | undefined

      return (
        init?.method ===
        'PATCH'
      )
    })
    .map((call) => {
      const init =
        call[1] as
          | RequestInit
          | undefined

      return JSON.parse(
        String(init?.body),
      )
    })
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.stubGlobal(
    'fetch',
    mockFetch,
  )

  installSuccessfulFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe(
  'CommercialSettingsClient',
  () => {
    test(
      'carrega a configuração comercial real da API',
      async () => {
        render(
          <CommercialSettingsClient />,
        )

        expect(
          await screen.findByRole(
            'heading',
            {
              name:
                'Configuração global',
            },
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByLabelText(
            'Os preços incluem IVA',
          ),
        ).toBeChecked()

        expect(
          screen.getByLabelText(
            'Taxa de IVA (%)',
          ),
        ).toHaveValue(
          '23.00',
        )

        const smallSection =
          screen
            .getByRole(
              'heading',
              {
                name: 'Pequeno',
              },
            )
            .closest('form')

        expect(
          smallSection,
        ).not.toBeNull()

        expect(
          within(
            smallSection!,
          ).getByLabelText(
            'Portes (€)',
          ),
        ).toHaveValue(
          '5.90',
        )

        const bulkySection =
          screen
            .getByRole(
              'heading',
              {
                name:
                  'Volumoso',
              },
            )
            .closest('form')

        expect(
          bulkySection,
        ).not.toBeNull()

        expect(
          within(
            bulkySection!,
          ).getByLabelText(
            'Portes mínimos (€)',
          ),
        ).toHaveValue(
          '19.90',
        )

        expect(
          within(
            bulkySection!,
          ).getByLabelText(
            'Portes máximos (€)',
          ),
        ).toHaveValue(
          '29.90',
        )
      },
    )

    test(
      'guarda a configuração global',
      async () => {
        render(
          <CommercialSettingsClient />,
        )

        const checkbox =
          await screen.findByLabelText(
            'Os preços incluem IVA',
          )

        fireEvent.click(
          checkbox,
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar configuração global',
            },
          ),
        )

        await waitFor(() => {
          expect(
            getPatchBodies(),
          ).toContainEqual({
            target: 'store',
            data: {
              pricesIncludeTax:
                false,
            },
          })
        })

        expect(
          await screen.findByText(
            'Configuração global guardada.',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'guarda a taxa de IVA de Portugal Continental',
      async () => {
        render(
          <CommercialSettingsClient />,
        )

        const taxInput =
          await screen.findByLabelText(
            'Taxa de IVA (%)',
          )

        fireEvent.change(
          taxInput,
          {
            target: {
              value: '22.50',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar Portugal Continental',
            },
          ),
        )

        await waitFor(() => {
          expect(
            getPatchBodies(),
          ).toContainEqual({
            target: 'region',
            region:
              'PORTUGAL_MAINLAND',
            data: {
              checkoutEnabled:
                true,
              taxRatePercent:
                22.5,
            },
          })
        })

        expect(
          await screen.findByText(
            'Região guardada.',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'guarda portes e limite grátis da classe pequena',
      async () => {
        render(
          <CommercialSettingsClient />,
        )

        const heading =
          await screen.findByRole(
            'heading',
            {
              name: 'Pequeno',
            },
          )

        const form =
          heading.closest('form')

        expect(form).not.toBeNull()

        fireEvent.change(
          within(
            form!,
          ).getByLabelText(
            'Portes (€)',
          ),
          {
            target: {
              value: '6.40',
            },
          },
        )

        fireEvent.change(
          within(
            form!,
          ).getByLabelText(
            'Portes grátis a partir de (€)',
          ),
          {
            target: {
              value: '175.00',
            },
          },
        )

        fireEvent.click(
          within(
            form!,
          ).getByRole(
            'button',
            {
              name:
                'Guardar regra Pequeno',
            },
          ),
        )

        await waitFor(() => {
          expect(
            getPatchBodies(),
          ).toContainEqual({
            target:
              'shipping-rule',
            region:
              'PORTUGAL_MAINLAND',
            shippingClass:
              'SMALL',
            data: {
              checkoutEnabled:
                true,
              shippingCost: 6.4,
              maximumShippingCost:
                null,
              freeShippingThreshold:
                175,
            },
          })
        })

        expect(
          await screen.findByText(
            'Regra “Pequeno” guardada.',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'guarda o intervalo da classe volumosa',
      async () => {
        render(
          <CommercialSettingsClient />,
        )

        const heading =
          await screen.findByRole(
            'heading',
            {
              name: 'Volumoso',
            },
          )

        const form =
          heading.closest('form')

        expect(form).not.toBeNull()

        fireEvent.change(
          within(
            form!,
          ).getByLabelText(
            'Portes mínimos (€)',
          ),
          {
            target: {
              value: '20.00',
            },
          },
        )

        fireEvent.change(
          within(
            form!,
          ).getByLabelText(
            'Portes máximos (€)',
          ),
          {
            target: {
              value: '30.00',
            },
          },
        )

        fireEvent.click(
          within(
            form!,
          ).getByRole(
            'button',
            {
              name:
                'Guardar regra Volumoso',
            },
          ),
        )

        await waitFor(() => {
          expect(
            getPatchBodies(),
          ).toContainEqual({
            target:
              'shipping-rule',
            region:
              'PORTUGAL_MAINLAND',
            shippingClass:
              'BULKY',
            data: {
              checkoutEnabled:
                true,
              shippingCost: 20,
              maximumShippingCost:
                30,
              freeShippingThreshold:
                null,
            },
          })
        })
      },
    )

    test(
      'bloqueia intervalo volumoso inválido antes da API',
      async () => {
        render(
          <CommercialSettingsClient />,
        )

        const heading =
          await screen.findByRole(
            'heading',
            {
              name: 'Volumoso',
            },
          )

        const form =
          heading.closest('form')

        expect(form).not.toBeNull()

        fireEvent.change(
          within(
            form!,
          ).getByLabelText(
            'Portes mínimos (€)',
          ),
          {
            target: {
              value: '30.00',
            },
          },
        )

        fireEvent.change(
          within(
            form!,
          ).getByLabelText(
            'Portes máximos (€)',
          ),
          {
            target: {
              value: '20.00',
            },
          },
        )

        fireEvent.click(
          within(
            form!,
          ).getByRole(
            'button',
            {
              name:
                'Guardar regra Volumoso',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Os portes máximos não podem ser inferiores aos portes mínimos',
        )

        expect(
          getPatchBodies(),
        ).toHaveLength(0)
      },
    )

    test(
      'mostra erro devolvido pela API ao guardar',
      async () => {
        mockFetch.mockImplementation(
          async (
            _input:
              | RequestInfo
              | URL,
            init?: RequestInit,
          ) => {
            if (
              !init?.method ||
              init.method ===
                'GET'
            ) {
              return jsonResponse(
                settings,
              )
            }

            return jsonResponse(
              {
                error:
                  'Configuração comercial inválida',
              },
              400,
            )
          },
        )

        render(
          <CommercialSettingsClient />,
        )

        await screen.findByRole(
          'heading',
          {
            name:
              'Configuração global',
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Guardar configuração global',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Configuração comercial inválida',
        )
      },
    )

    test(
      'mostra erro de carregamento e permite tentar novamente',
      async () => {
        mockFetch
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
            jsonResponse(
              settings,
            ),
          )

        render(
          <CommercialSettingsClient />,
        )

        expect(
          await screen.findByText(
            'Erro interno do servidor',
          ),
        ).toBeInTheDocument()

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
          await screen.findByRole(
            'heading',
            {
              name:
                'Configuração global',
            },
          ),
        ).toBeInTheDocument()
      },
    )
  },
)
