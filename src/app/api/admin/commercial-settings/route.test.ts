import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock(
  '@/server/commercial-settings',
  () => {
    class CommercialSettingsValidationError
      extends Error {}

    return {
      CommercialSettingsValidationError,
      getCommercialSettings: vi.fn(),
      updateStoreSettings: vi.fn(),
      updateCheckoutRegionRule: vi.fn(),
      updateShippingRule: vi.fn(),
    }
  },
)

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  CommercialSettingsValidationError,
  getCommercialSettings,
  updateCheckoutRegionRule,
  updateShippingRule,
  updateStoreSettings,
} from '@/server/commercial-settings'
import {
  GET,
  PATCH,
} from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockGetCommercialSettings =
  vi.mocked(getCommercialSettings)

const mockUpdateStoreSettings =
  vi.mocked(updateStoreSettings)

const mockUpdateCheckoutRegionRule =
  vi.mocked(updateCheckoutRegionRule)

const mockUpdateShippingRule =
  vi.mocked(updateShippingRule)

function createPatchRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/commercial-settings',
    {
      method: 'PATCH',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

describe(
  'Admin Commercial Settings API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRequireAdmin.mockResolvedValue({
        user: {
          id: 'admin-test',
          role: 'ADMIN',
        },
      } as Awaited<
        ReturnType<typeof requireAdmin>
      >)
    })

    describe('GET', () => {
      test(
        'devolve configuração comercial com status 200',
        async () => {
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
                shippingRules: [],
              },
            ],
          } as Awaited<
            ReturnType<
              typeof getCommercialSettings
            >
          >

          mockGetCommercialSettings
            .mockResolvedValue(settings)

          const response = await GET()

          expect(
            response.status,
          ).toBe(200)

          expect(
            await response.json(),
          ).toEqual(settings)

          expect(
            mockRequireAdmin,
          ).toHaveBeenCalledTimes(1)

          expect(
            mockGetCommercialSettings,
          ).toHaveBeenCalledTimes(1)
        },
      )

      test(
        'devolve 401 sem autenticação',
        async () => {
          mockRequireAdmin
            .mockRejectedValue(
              new UnauthorizedError(),
            )

          const response = await GET()

          expect(
            response.status,
          ).toBe(401)

          expect(
            await response.json(),
          ).toEqual({
            error: 'Não autenticado',
          })

          expect(
            mockGetCommercialSettings,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 403 sem autorização ADMIN',
        async () => {
          mockRequireAdmin
            .mockRejectedValue(
              new AdminForbiddenError(),
            )

          const response = await GET()

          expect(
            response.status,
          ).toBe(403)

          expect(
            await response.json(),
          ).toEqual({
            error: 'Sem autorização',
          })

          expect(
            mockGetCommercialSettings,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 500 em erro inesperado',
        async () => {
          mockGetCommercialSettings
            .mockRejectedValue(
              new Error(
                'Erro inesperado',
              ),
            )

          const response = await GET()

          expect(
            response.status,
          ).toBe(500)

          expect(
            await response.json(),
          ).toEqual({
            error:
              'Erro interno do servidor',
          })
        },
      )
    })

    describe('PATCH', () => {
      test(
        'atualiza configuração global',
        async () => {
          const result = {
            id: 'store',
            pricesIncludeTax: true,
          } as Awaited<
            ReturnType<
              typeof updateStoreSettings
            >
          >

          mockUpdateStoreSettings
            .mockResolvedValue(result)

          const response =
            await PATCH(
              createPatchRequest({
                target: 'store',
                data: {
                  pricesIncludeTax:
                    true,
                },
              }),
            )

          expect(
            response.status,
          ).toBe(200)

          expect(
            mockUpdateStoreSettings,
          ).toHaveBeenCalledWith({
            pricesIncludeTax: true,
          })

          expect(
            await response.json(),
          ).toEqual(result)
        },
      )

      test(
        'atualiza uma região',
        async () => {
          const result = {
            region:
              'PORTUGAL_MAINLAND',
            checkoutEnabled: true,
            taxRatePercent: '23.00',
          } as Awaited<
            ReturnType<
              typeof updateCheckoutRegionRule
            >
          >

          mockUpdateCheckoutRegionRule
            .mockResolvedValue(result)

          const response =
            await PATCH(
              createPatchRequest({
                target: 'region',
                region:
                  'PORTUGAL_MAINLAND',
                data: {
                  checkoutEnabled:
                    true,
                  taxRatePercent:
                    23,
                },
              }),
            )

          expect(
            response.status,
          ).toBe(200)

          expect(
            mockUpdateCheckoutRegionRule,
          ).toHaveBeenCalledWith(
            'PORTUGAL_MAINLAND',
            {
              checkoutEnabled: true,
              taxRatePercent: 23,
            },
          )

          expect(
            await response.json(),
          ).toEqual(result)
        },
      )

      test(
        'atualiza uma regra de transporte',
        async () => {
          const result = {
            id: 'shipping-small',
            region:
              'PORTUGAL_MAINLAND',
            shippingClass:
              'SMALL',
            checkoutEnabled: true,
            shippingCost: '5.90',
            maximumShippingCost:
              null,
            freeShippingThreshold:
              '150.00',
          } as Awaited<
            ReturnType<
              typeof updateShippingRule
            >
          >

          mockUpdateShippingRule
            .mockResolvedValue(result)

          const response =
            await PATCH(
              createPatchRequest({
                target:
                  'shipping-rule',
                region:
                  'PORTUGAL_MAINLAND',
                shippingClass:
                  'SMALL',
                data: {
                  checkoutEnabled:
                    true,
                  shippingCost:
                    5.9,
                  maximumShippingCost:
                    null,
                  freeShippingThreshold:
                    150,
                },
              }),
            )

          expect(
            response.status,
          ).toBe(200)

          expect(
            mockUpdateShippingRule,
          ).toHaveBeenCalledWith(
            'PORTUGAL_MAINLAND',
            'SMALL',
            {
              checkoutEnabled: true,
              shippingCost: 5.9,
              maximumShippingCost:
                null,
              freeShippingThreshold:
                150,
            },
          )

          expect(
            await response.json(),
          ).toEqual(result)
        },
      )

      test(
        'rejeita operação desconhecida',
        async () => {
          const response =
            await PATCH(
              createPatchRequest({
                target: 'desconhecido',
              }),
            )

          expect(
            response.status,
          ).toBe(400)

          expect(
            await response.json(),
          ).toEqual({
            error:
              'Operação de configuração comercial inválida',
          })

          expect(
            mockUpdateStoreSettings,
          ).not.toHaveBeenCalled()

          expect(
            mockUpdateCheckoutRegionRule,
          ).not.toHaveBeenCalled()

          expect(
            mockUpdateShippingRule,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve erro de validação do serviço',
        async () => {
          mockUpdateShippingRule
            .mockRejectedValue(
              new CommercialSettingsValidationError(
                'Portes máximos não podem ser inferiores aos mínimos',
              ),
            )

          const response =
            await PATCH(
              createPatchRequest({
                target:
                  'shipping-rule',
                region:
                  'PORTUGAL_MAINLAND',
                shippingClass:
                  'BULKY',
                data: {
                  checkoutEnabled:
                    true,
                  shippingCost:
                    29.9,
                  maximumShippingCost:
                    19.9,
                  freeShippingThreshold:
                    null,
                },
              }),
            )

          expect(
            response.status,
          ).toBe(400)

          expect(
            await response.json(),
          ).toEqual({
            error:
              'Portes máximos não podem ser inferiores aos mínimos',
          })
        },
      )

      test(
        'rejeita JSON inválido',
        async () => {
          const request =
            new Request(
              'http://localhost/api/admin/commercial-settings',
              {
                method: 'PATCH',
                headers: {
                  'content-type':
                    'application/json',
                },
                body: '{',
              },
            )

          const response =
            await PATCH(request)

          expect(
            response.status,
          ).toBe(400)

          expect(
            await response.json(),
          ).toEqual({
            error: 'JSON inválido',
          })
        },
      )

      test(
        'devolve 401 antes de alterar configuração',
        async () => {
          mockRequireAdmin
            .mockRejectedValue(
              new UnauthorizedError(),
            )

          const response =
            await PATCH(
              createPatchRequest({
                target: 'store',
                data: {
                  pricesIncludeTax:
                    true,
                },
              }),
            )

          expect(
            response.status,
          ).toBe(401)

          expect(
            mockUpdateStoreSettings,
          ).not.toHaveBeenCalled()

          expect(
            mockUpdateCheckoutRegionRule,
          ).not.toHaveBeenCalled()

          expect(
            mockUpdateShippingRule,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 403 antes de alterar configuração',
        async () => {
          mockRequireAdmin
            .mockRejectedValue(
              new AdminForbiddenError(),
            )

          const response =
            await PATCH(
              createPatchRequest({
                target: 'store',
                data: {
                  pricesIncludeTax:
                    true,
                },
              }),
            )

          expect(
            response.status,
          ).toBe(403)

          expect(
            mockUpdateStoreSettings,
          ).not.toHaveBeenCalled()

          expect(
            mockUpdateCheckoutRegionRule,
          ).not.toHaveBeenCalled()

          expect(
            mockUpdateShippingRule,
          ).not.toHaveBeenCalled()
        },
      )

      test(
        'devolve 500 em erro inesperado',
        async () => {
          mockUpdateStoreSettings
            .mockRejectedValue(
              new Error(
                'Erro inesperado',
              ),
            )

          const response =
            await PATCH(
              createPatchRequest({
                target: 'store',
                data: {
                  pricesIncludeTax:
                    true,
                },
              }),
            )

          expect(
            response.status,
          ).toBe(500)

          expect(
            await response.json(),
          ).toEqual({
            error:
              'Erro interno do servidor',
          })
        },
      )
    })
  },
)
