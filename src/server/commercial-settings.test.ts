import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import {
  CHECKOUT_REGIONS,
  CommercialSettings,
  CommercialSettingsClient,
  CommercialSettingsValidationError,
  SHIPPING_CLASSES,
  getCommercialSettings,
  initializeCommercialSettings,
  updateCheckoutRegionRule,
  updateShippingRule,
  updateStoreSettings,
} from './commercial-settings'

const defaultRegionRows = [
  {
    region:
      'PORTUGAL_MAINLAND' as const,
    checkoutEnabled: true,
    taxRatePercent: '23.00',
  },
  {
    region: 'MADEIRA' as const,
    checkoutEnabled: false,
    taxRatePercent: null,
  },
  {
    region: 'AZORES' as const,
    checkoutEnabled: false,
    taxRatePercent: null,
  },
  {
    region:
      'INTERNATIONAL' as const,
    checkoutEnabled: false,
    taxRatePercent: null,
  },
]

function createDefaultShippingRows() {
  return CHECKOUT_REGIONS.flatMap(
    (region) =>
      SHIPPING_CLASSES.map(
        (shippingClass) => {
          const base = {
            id:
              `rule-${region}-${shippingClass}`,
            region,
            shippingClass,
            checkoutEnabled: false,
            shippingCost: null,
            maximumShippingCost:
              null,
            freeShippingThreshold:
              null,
          }

          if (
            region !==
            'PORTUGAL_MAINLAND'
          ) {
            return base
          }

          if (
            shippingClass ===
            'SMALL'
          ) {
            return {
              ...base,
              checkoutEnabled: true,
              shippingCost: '5.90',
              freeShippingThreshold:
                '150.00',
            }
          }

          if (
            shippingClass ===
            'STANDARD'
          ) {
            return {
              ...base,
              checkoutEnabled: true,
              shippingCost: '8.90',
              freeShippingThreshold:
                '150.00',
            }
          }

          if (
            shippingClass ===
            'BULKY'
          ) {
            return {
              ...base,
              checkoutEnabled: true,
              shippingCost: '19.90',
              maximumShippingCost:
                '29.90',
            }
          }

          return base
        },
      ),
  )
}

function createClient():
  CommercialSettingsClient {
  return {
    storeSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    checkoutRegionRule: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    shippingRule: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
  }
}

function getRegion(
  settings: CommercialSettings,
  region:
    (typeof CHECKOUT_REGIONS)[number],
) {
  const result =
    settings.regions.find(
      (item) =>
        item.region === region,
    )

  if (!result) {
    throw new Error(
      `Região ausente: ${region}`,
    )
  }

  return result
}

function getShippingRule(
  settings: CommercialSettings,
  shippingClass:
    (typeof SHIPPING_CLASSES)[number],
) {
  const mainland =
    getRegion(
      settings,
      'PORTUGAL_MAINLAND',
    )

  const result =
    mainland.shippingRules.find(
      (item) =>
        item.shippingClass ===
        shippingClass,
    )

  if (!result) {
    throw new Error(
      `Classe ausente: ${shippingClass}`,
    )
  }

  return result
}

describe(
  'commercial settings service',
  () => {
    let client:
      CommercialSettingsClient

    beforeEach(() => {
      client = createClient()

      vi.mocked(
        client.storeSettings.upsert,
      ).mockImplementation(
        async (args) => ({
          id: args.create.id,
          pricesIncludeTax:
            args.update
              .pricesIncludeTax ??
            args.create
              .pricesIncludeTax,
        }),
      )

      vi.mocked(
        client.checkoutRegionRule
          .createMany,
      ).mockResolvedValue({
        count: 4,
      })

      vi.mocked(
        client.shippingRule
          .createMany,
      ).mockResolvedValue({
        count: 24,
      })

      vi.mocked(
        client.checkoutRegionRule
          .upsert,
      ).mockImplementation(
        async (args) => ({
          region:
            args.create.region,
          checkoutEnabled:
            args.update
              .checkoutEnabled,
          taxRatePercent:
            args.update
              .taxRatePercent,
        }),
      )

      vi.mocked(
        client.shippingRule.upsert,
      ).mockImplementation(
        async (args) => ({
          id:
            `rule-${args.create.region}-${args.create.shippingClass}`,
          region:
            args.create.region,
          shippingClass:
            args.create
              .shippingClass,
          checkoutEnabled:
            args.update
              .checkoutEnabled,
          shippingCost:
            args.update
              .shippingCost,
          maximumShippingCost:
            args.update
              .maximumShippingCost,
          freeShippingThreshold:
            args.update
              .freeShippingThreshold,
        }),
      )
    })

    test(
      'inicializa configuração comercial sem sobrescrever registos existentes',
      async () => {
        await initializeCommercialSettings(
          client,
        )

        expect(
          client.storeSettings.upsert,
        ).toHaveBeenCalledWith({
          where: {
            id: 'store',
          },
          update: {},
          create: {
            id: 'store',
            pricesIncludeTax: true,
          },
          select: {
            id: true,
            pricesIncludeTax: true,
          },
        })

        expect(
          client.checkoutRegionRule
            .createMany,
        ).toHaveBeenCalledWith({
          data:
            defaultRegionRows,
          skipDuplicates: true,
        })

        const shippingCall =
          vi.mocked(
            client.shippingRule
              .createMany,
          ).mock.calls[0]?.[0]

        expect(
          shippingCall?.skipDuplicates,
        ).toBe(true)

        expect(
          shippingCall?.data,
        ).toHaveLength(24)
      },
    )

    test(
      'defaults ativam apenas Portugal Continental',
      async () => {
        await initializeCommercialSettings(
          client,
        )

        const call =
          vi.mocked(
            client.checkoutRegionRule
              .createMany,
          ).mock.calls[0]?.[0]

        expect(call?.data).toEqual(
          defaultRegionRows,
        )
      },
    )

    test(
      'defaults aplicam 5,90, 8,90 e intervalo volumoso 19,90 a 29,90',
      async () => {
        await initializeCommercialSettings(
          client,
        )

        const rows =
          vi.mocked(
            client.shippingRule
              .createMany,
          ).mock.calls[0]?.[0]
            .data ?? []

        expect(
          rows.find(
            (row) =>
              row.region ===
                'PORTUGAL_MAINLAND' &&
              row.shippingClass ===
                'SMALL',
          ),
        ).toEqual({
          region:
            'PORTUGAL_MAINLAND',
          shippingClass: 'SMALL',
          checkoutEnabled: true,
          shippingCost: '5.90',
          maximumShippingCost: null,
          freeShippingThreshold:
            '150.00',
        })

        expect(
          rows.find(
            (row) =>
              row.region ===
                'PORTUGAL_MAINLAND' &&
              row.shippingClass ===
                'STANDARD',
          ),
        ).toEqual({
          region:
            'PORTUGAL_MAINLAND',
          shippingClass:
            'STANDARD',
          checkoutEnabled: true,
          shippingCost: '8.90',
          maximumShippingCost: null,
          freeShippingThreshold:
            '150.00',
        })

        expect(
          rows.find(
            (row) =>
              row.region ===
                'PORTUGAL_MAINLAND' &&
              row.shippingClass ===
                'BULKY',
          ),
        ).toEqual({
          region:
            'PORTUGAL_MAINLAND',
          shippingClass: 'BULKY',
          checkoutEnabled: true,
          shippingCost: '19.90',
          maximumShippingCost:
            '29.90',
          freeShippingThreshold: null,
        })
      },
    )

    test(
      'defaults bloqueiam classes sem tarifa automática',
      async () => {
        await initializeCommercialSettings(
          client,
        )

        const rows =
          vi.mocked(
            client.shippingRule
              .createMany,
          ).mock.calls[0]?.[0]
            .data ?? []

        for (
          const shippingClass of [
            'HEAVY',
            'QUOTE_REQUIRED',
            'UNASSIGNED',
          ] as const
        ) {
          expect(
            rows.find(
              (row) =>
                row.region ===
                  'PORTUGAL_MAINLAND' &&
                row.shippingClass ===
                  shippingClass,
            ),
          ).toEqual({
            region:
              'PORTUGAL_MAINLAND',
            shippingClass,
            checkoutEnabled: false,
            shippingCost: null,
            maximumShippingCost:
              null,
            freeShippingThreshold:
              null,
          })
        }
      },
    )

    test(
      'lê configuração completa sem reinicializar',
      async () => {
        const shippingRows =
          createDefaultShippingRows()

        vi.mocked(
          client.storeSettings
            .findUnique,
        ).mockResolvedValue({
          id: 'store',
          pricesIncludeTax: true,
        })

        vi.mocked(
          client.checkoutRegionRule
            .findMany,
        ).mockResolvedValue(
          defaultRegionRows,
        )

        vi.mocked(
          client.shippingRule
            .findMany,
        ).mockResolvedValue(
          shippingRows,
        )

        const result =
          await getCommercialSettings(
            client,
          )

        expect(
          client.storeSettings.upsert,
        ).not.toHaveBeenCalled()

        expect(
          client.checkoutRegionRule
            .createMany,
        ).not.toHaveBeenCalled()

        expect(
          client.shippingRule
            .createMany,
        ).not.toHaveBeenCalled()

        expect(
          result.store
            .pricesIncludeTax,
        ).toBe(true)

        expect(
          getRegion(
            result,
            'PORTUGAL_MAINLAND',
          ).taxRatePercent,
        ).toBe('23.00')

        expect(
          getShippingRule(
            result,
            'SMALL',
          ).shippingCost,
        ).toBe('5.90')

        expect(
          getShippingRule(
            result,
            'BULKY',
          ).maximumShippingCost,
        ).toBe('29.90')
      },
    )

    test(
      'inicializa automaticamente quando a configuração está incompleta',
      async () => {
        vi.mocked(
          client.storeSettings
            .findUnique,
        )
          .mockResolvedValueOnce(
            null,
          )
          .mockResolvedValueOnce({
            id: 'store',
            pricesIncludeTax: true,
          })

        vi.mocked(
          client.checkoutRegionRule
            .findMany,
        )
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(
            defaultRegionRows,
          )

        vi.mocked(
          client.shippingRule
            .findMany,
        )
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(
            createDefaultShippingRows(),
          )

        const result =
          await getCommercialSettings(
            client,
          )

        expect(
          client.storeSettings.upsert,
        ).toHaveBeenCalledTimes(1)

        expect(
          client.checkoutRegionRule
            .createMany,
        ).toHaveBeenCalledTimes(1)

        expect(
          client.shippingRule
            .createMany,
        ).toHaveBeenCalledTimes(1)

        expect(
          result.regions,
        ).toHaveLength(4)
      },
    )

    test(
      'permite alterar configuração global de IVA',
      async () => {
        const result =
          await updateStoreSettings(
            {
              pricesIncludeTax:
                false,
            },
            client,
          )

        expect(
          client.storeSettings.upsert,
        ).toHaveBeenCalledWith({
          where: {
            id: 'store',
          },
          update: {
            pricesIncludeTax:
              false,
          },
          create: {
            id: 'store',
            pricesIncludeTax:
              false,
          },
          select: {
            id: true,
            pricesIncludeTax: true,
          },
        })

        expect(
          result.pricesIncludeTax,
        ).toBe(false)
      },
    )

    test(
      'permite alterar região e normaliza taxa de IVA',
      async () => {
        const result =
          await updateCheckoutRegionRule(
            ' PORTUGAL_MAINLAND ',
            {
              checkoutEnabled:
                true,
              taxRatePercent: 23,
            },
            client,
          )

        expect(result).toEqual({
          region:
            'PORTUGAL_MAINLAND',
          checkoutEnabled: true,
          taxRatePercent: '23.00',
        })
      },
    )

    test(
      'não ativa região sem taxa de IVA',
      async () => {
        await expect(
          updateCheckoutRegionRule(
            'PORTUGAL_MAINLAND',
            {
              checkoutEnabled:
                true,
              taxRatePercent:
                null,
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          CommercialSettingsValidationError,
        )

        expect(
          client.checkoutRegionRule
            .upsert,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'rejeita região desconhecida',
      async () => {
        await expect(
          updateCheckoutRegionRule(
            'LUA',
            {
              checkoutEnabled:
                false,
              taxRatePercent:
                null,
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          CommercialSettingsValidationError,
        )
      },
    )

    test(
      'permite configurar portes pequenos e limite grátis',
      async () => {
        const result =
          await updateShippingRule(
            'PORTUGAL_MAINLAND',
            'SMALL',
            {
              checkoutEnabled:
                true,
              shippingCost: 5.9,
              maximumShippingCost:
                null,
              freeShippingThreshold:
                150,
            },
            client,
          )

        expect(
          result.shippingCost,
        ).toBe('5.90')

        expect(
          result.freeShippingThreshold,
        ).toBe('150.00')
      },
    )

    test(
      'permite configurar intervalo de portes volumosos sem portes grátis',
      async () => {
        const result =
          await updateShippingRule(
            'PORTUGAL_MAINLAND',
            'BULKY',
            {
              checkoutEnabled:
                true,
              shippingCost: 19.9,
              maximumShippingCost:
                29.9,
              freeShippingThreshold:
                null,
            },
            client,
          )

        expect(
          result.shippingCost,
        ).toBe('19.90')

        expect(
          result.maximumShippingCost,
        ).toBe('29.90')

        expect(
          result.freeShippingThreshold,
        ).toBeNull()
      },
    )

    test(
      'rejeita portes grátis para volumosos',
      async () => {
        await expect(
          updateShippingRule(
            'PORTUGAL_MAINLAND',
            'BULKY',
            {
              checkoutEnabled:
                true,
              shippingCost: 19.9,
              maximumShippingCost:
                29.9,
              freeShippingThreshold:
                150,
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          CommercialSettingsValidationError,
        )
      },
    )

    test(
      'rejeita máximo volumoso inferior ao mínimo',
      async () => {
        await expect(
          updateShippingRule(
            'PORTUGAL_MAINLAND',
            'BULKY',
            {
              checkoutEnabled:
                true,
              shippingCost: 29.9,
              maximumShippingCost:
                19.9,
              freeShippingThreshold:
                null,
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          CommercialSettingsValidationError,
        )
      },
    )

    test.each([
      'UNASSIGNED',
      'QUOTE_REQUIRED',
    ] as const)(
      'não permite checkout automático para %s',
      async (shippingClass) => {
        await expect(
          updateShippingRule(
            'PORTUGAL_MAINLAND',
            shippingClass,
            {
              checkoutEnabled:
                true,
              shippingCost: null,
              maximumShippingCost:
                null,
              freeShippingThreshold:
                null,
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          CommercialSettingsValidationError,
        )
      },
    )

    test(
      'rejeita valores monetários com mais de duas casas decimais',
      async () => {
        await expect(
          updateShippingRule(
            'PORTUGAL_MAINLAND',
            'STANDARD',
            {
              checkoutEnabled:
                true,
              shippingCost:
                '8.999',
              maximumShippingCost:
                null,
              freeShippingThreshold:
                '150.00',
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          CommercialSettingsValidationError,
        )
      },
    )

    test(
      'não permite portes máximos fora da classe volumosa',
      async () => {
        await expect(
          updateShippingRule(
            'PORTUGAL_MAINLAND',
            'STANDARD',
            {
              checkoutEnabled:
                true,
              shippingCost:
                '8.90',
              maximumShippingCost:
                '12.90',
              freeShippingThreshold:
                '150.00',
            },
            client,
          ),
        ).rejects.toBeInstanceOf(
          CommercialSettingsValidationError,
        )
      },
    )
  },
)
