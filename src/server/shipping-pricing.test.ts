import {
  describe,
  expect,
  test,
} from 'vitest'

import type {
  CommercialSettings,
  CommercialShippingClass,
} from './commercial-settings'
import {
  calculateShippingPricing,
  ShippingPricingError,
  type ShippingPricingItem,
} from './shipping-pricing'

function createSettings(): CommercialSettings {
  return {
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
          {
            id: 'heavy-rule',
            region:
              'PORTUGAL_MAINLAND',
            shippingClass: 'HEAVY',
            checkoutEnabled: false,
            shippingCost: null,
            maximumShippingCost:
              null,
            freeShippingThreshold:
              null,
          },
          {
            id: 'quote-rule',
            region:
              'PORTUGAL_MAINLAND',
            shippingClass:
              'QUOTE_REQUIRED',
            checkoutEnabled: false,
            shippingCost: null,
            maximumShippingCost:
              null,
            freeShippingThreshold:
              null,
          },
          {
            id: 'unassigned-rule',
            region:
              'PORTUGAL_MAINLAND',
            shippingClass:
              'UNASSIGNED',
            checkoutEnabled: false,
            shippingCost: null,
            maximumShippingCost:
              null,
            freeShippingThreshold:
              null,
          },
        ],
      },
      {
        region: 'MADEIRA',
        checkoutEnabled: false,
        taxRatePercent: null,
        shippingRules: [],
      },
      {
        region: 'AZORES',
        checkoutEnabled: false,
        taxRatePercent: null,
        shippingRules: [],
      },
      {
        region:
          'INTERNATIONAL',
        checkoutEnabled: false,
        taxRatePercent: null,
        shippingRules: [],
      },
    ],
  }
}

function createItem(
  overrides: Partial<ShippingPricingItem> = {},
): ShippingPricingItem {
  return {
    productId: 'product-1',
    quantity: 1,
    unitPrice: '10.00',
    shippingClass: 'SMALL',
    mainlandShippingCost: null,
    ...overrides,
  }
}

function getMainland(
  settings: CommercialSettings,
) {
  const region =
    settings.regions.find(
      (candidate) =>
        candidate.region ===
        'PORTUGAL_MAINLAND',
    )

  if (!region) {
    throw new Error(
      'Portugal Continental não encontrado no teste',
    )
  }

  return region
}

function getRule(
  settings: CommercialSettings,
  shippingClass:
    CommercialShippingClass,
) {
  const rule =
    getMainland(
      settings,
    ).shippingRules.find(
      (candidate) =>
        candidate.shippingClass ===
        shippingClass,
    )

  if (!rule) {
    throw new Error(
      `Regra ${shippingClass} não encontrada no teste`,
    )
  }

  return rule
}

describe(
  'calculateShippingPricing',
  () => {
    test(
      'cobra 5,90 € uma única vez para um produto Pequeno',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem(),
            ],
          })

        expect(
          result.productsSubtotalCents,
        ).toBe(1000)

        expect(
          result.nonVolumousSubtotalCents,
        ).toBe(1000)

        expect(
          result.nonVolumousShippingCents,
        ).toBe(590)

        expect(
          result.bulkyShippingCents,
        ).toBe(0)

        expect(
          result.shippingTotalCents,
        ).toBe(590)

        expect(
          result.totalCents,
        ).toBe(1590)
      },
    )

    test(
      'várias unidades Pequenas continuam a pagar a tarifa Pequeno apenas uma vez',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                quantity: 4,
                unitPrice: '10.00',
              }),
            ],
          })

        expect(
          result.nonVolumousSubtotalCents,
        ).toBe(4000)

        expect(
          result.nonVolumousShippingCents,
        ).toBe(590)
      },
    )

    test(
      'vários produtos Normais pagam a tarifa Normal apenas uma vez',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId:
                  'standard-1',
                shippingClass:
                  'STANDARD',
                unitPrice: '20.00',
              }),
              createItem({
                productId:
                  'standard-2',
                shippingClass:
                  'STANDARD',
                quantity: 3,
                unitPrice: '10.00',
              }),
            ],
          })

        expect(
          result.nonVolumousSubtotalCents,
        ).toBe(5000)

        expect(
          result.nonVolumousShippingCents,
        ).toBe(890)
      },
    )

    test(
      'Pequeno e Normal usam apenas a tarifa mais alta aplicável',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId: 'small',
                shippingClass: 'SMALL',
              }),
              createItem({
                productId:
                  'standard',
                shippingClass:
                  'STANDARD',
              }),
            ],
          })

        expect(
          result.nonVolumousShippingCents,
        ).toBe(890)

        expect(
          result.shippingTotalCents,
        ).toBe(890)
      },
    )

    test(
      'usa as tarifas configuradas no Admin em vez de valores escondidos no código',
      () => {
        const settings =
          createSettings()

        getRule(
          settings,
          'SMALL',
        ).shippingCost = '6.40'

        getRule(
          settings,
          'STANDARD',
        ).shippingCost = '9.20'

        const result =
          calculateShippingPricing({
            settings,
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId: 'small',
                shippingClass: 'SMALL',
              }),
              createItem({
                productId:
                  'standard',
                shippingClass:
                  'STANDARD',
              }),
            ],
          })

        expect(
          result.nonVolumousShippingCents,
        ).toBe(920)
      },
    )

    test(
      'aplica portes grátis quando o subtotal elegível atinge exatamente 150 €',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId: 'small',
                shippingClass: 'SMALL',
                unitPrice: '60.00',
              }),
              createItem({
                productId:
                  'standard',
                shippingClass:
                  'STANDARD',
                unitPrice: '90.00',
              }),
            ],
          })

        expect(
          result.nonVolumousSubtotalCents,
        ).toBe(15000)

        expect(
          result.nonVolumousShippingCents,
        ).toBe(0)

        expect(
          result.freeShippingApplied,
        ).toBe(true)

        expect(
          result.freeShippingThresholdCents,
        ).toBe(15000)
      },
    )

    test(
      'usa o limite de portes grátis configurado no Admin',
      () => {
        const settings =
          createSettings()

        getRule(
          settings,
          'SMALL',
        ).freeShippingThreshold =
          '175.00'

        const below =
          calculateShippingPricing({
            settings,
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                unitPrice: '160.00',
              }),
            ],
          })

        expect(
          below.nonVolumousShippingCents,
        ).toBe(590)

        expect(
          below.freeShippingApplied,
        ).toBe(false)

        const atThreshold =
          calculateShippingPricing({
            settings,
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                unitPrice: '175.00',
              }),
            ],
          })

        expect(
          atThreshold.nonVolumousShippingCents,
        ).toBe(0)

        expect(
          atThreshold.freeShippingApplied,
        ).toBe(true)
      },
    )

    test(
      'não usa o subtotal do Volumoso para atingir o limite de portes grátis',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId:
                  'standard',
                shippingClass:
                  'STANDARD',
                unitPrice: '100.00',
              }),
              createItem({
                productId: 'bulky',
                shippingClass:
                  'BULKY',
                unitPrice: '200.00',
                mainlandShippingCost:
                  '24.90',
              }),
            ],
          })

        expect(
          result.productsSubtotalCents,
        ).toBe(30000)

        expect(
          result.nonVolumousSubtotalCents,
        ).toBe(10000)

        expect(
          result.freeShippingApplied,
        ).toBe(false)

        expect(
          result.nonVolumousShippingCents,
        ).toBe(890)

        expect(
          result.bulkyShippingCents,
        ).toBe(2490)

        expect(
          result.shippingTotalCents,
        ).toBe(3380)
      },
    )

    test(
      'cobra a tarifa específica por cada unidade Volumosa',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId:
                  'bulky-a',
                shippingClass:
                  'BULKY',
                quantity: 2,
                unitPrice: '200.00',
                mainlandShippingCost:
                  '24.90',
              }),
            ],
          })

        expect(
          result.bulkyShippingCents,
        ).toBe(4980)

        expect(
          result.shippingTotalCents,
        ).toBe(4980)

        expect(
          result.freeShippingApplied,
        ).toBe(false)
      },
    )

    test(
      'soma as tarifas de vários produtos Volumosos',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId:
                  'bulky-a',
                shippingClass:
                  'BULKY',
                quantity: 2,
                unitPrice: '100.00',
                mainlandShippingCost:
                  '24.90',
              }),
              createItem({
                productId:
                  'bulky-b',
                shippingClass:
                  'BULKY',
                quantity: 1,
                unitPrice: '100.00',
                mainlandShippingCost:
                  '19.90',
              }),
            ],
          })

        expect(
          result.bulkyShippingCents,
        ).toBe(6970)
      },
    )

    test(
      'calcula corretamente um carrinho misto com Pequeno, Normal e Volumoso',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId: 'small',
                shippingClass: 'SMALL',
                unitPrice: '20.00',
              }),
              createItem({
                productId:
                  'standard',
                shippingClass:
                  'STANDARD',
                unitPrice: '30.00',
              }),
              createItem({
                productId:
                  'bulky',
                shippingClass:
                  'BULKY',
                quantity: 2,
                unitPrice: '100.00',
                mainlandShippingCost:
                  '24.90',
              }),
            ],
          })

        expect(
          result.nonVolumousShippingCents,
        ).toBe(890)

        expect(
          result.bulkyShippingCents,
        ).toBe(4980)

        expect(
          result.shippingTotalCents,
        ).toBe(5870)
      },
    )

    test(
      'num carrinho misto remove apenas a componente Pequeno e Normal quando existe portes grátis',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId: 'small',
                shippingClass: 'SMALL',
                unitPrice: '80.00',
              }),
              createItem({
                productId:
                  'standard',
                shippingClass:
                  'STANDARD',
                unitPrice: '80.00',
              }),
              createItem({
                productId:
                  'bulky',
                shippingClass:
                  'BULKY',
                quantity: 2,
                unitPrice: '100.00',
                mainlandShippingCost:
                  '24.90',
              }),
            ],
          })

        expect(
          result.nonVolumousSubtotalCents,
        ).toBe(16000)

        expect(
          result.freeShippingApplied,
        ).toBe(true)

        expect(
          result.nonVolumousShippingCents,
        ).toBe(0)

        expect(
          result.bulkyShippingCents,
        ).toBe(4980)

        expect(
          result.shippingTotalCents,
        ).toBe(4980)
      },
    )

    test(
      'extrai o IVA incluído sem o adicionar novamente ao total',
      () => {
        const result =
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                unitPrice: '100.00',
              }),
            ],
          })

        expect(
          result.productsSubtotalCents,
        ).toBe(10000)

        expect(
          result.shippingTotalCents,
        ).toBe(590)

        expect(
          result.totalCents,
        ).toBe(10590)

        expect(
          result.includedTaxCents,
        ).toBe(1980)

        expect(
          result.taxRatePercent,
        ).toBe('23.00')

        expect(
          result.pricesIncludeTax,
        ).toBe(true)
      },
    )

    test.each([
      'HEAVY',
      'QUOTE_REQUIRED',
      'UNASSIGNED',
    ] as const)(
      'bloqueia checkout automático para a classe %s',
      (shippingClass) => {
        expect(() =>
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                shippingClass,
              }),
            ],
          }),
        ).toThrowError(
          ShippingPricingError,
        )
      },
    )

    test(
      'bloqueia produto Volumoso sem tarifa específica',
      () => {
        expect(() =>
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId:
                  'bulky',
                shippingClass:
                  'BULKY',
                mainlandShippingCost:
                  null,
              }),
            ],
          }),
        ).toThrowError(
          /não tem tarifa de transporte/,
        )
      },
    )

    test(
      'bloqueia tarifa específica Volumosa abaixo do mínimo atual',
      () => {
        expect(() =>
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId:
                  'bulky',
                shippingClass:
                  'BULKY',
                mainlandShippingCost:
                  '19.89',
              }),
            ],
          }),
        ).toThrowError(
          /fora do intervalo permitido/,
        )
      },
    )

    test(
      'bloqueia tarifa específica Volumosa acima do máximo atual',
      () => {
        expect(() =>
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId:
                  'bulky',
                shippingClass:
                  'BULKY',
                mainlandShippingCost:
                  '29.91',
              }),
            ],
          }),
        ).toThrowError(
          /fora do intervalo permitido/,
        )
      },
    )

    test(
      'bloqueia quando a regra necessária está desativada',
      () => {
        const settings =
          createSettings()

        getRule(
          settings,
          'STANDARD',
        ).checkoutEnabled =
          false

        expect(() =>
          calculateShippingPricing({
            settings,
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                shippingClass:
                  'STANDARD',
              }),
            ],
          }),
        ).toThrowError(
          /checkout automático está desativado/,
        )
      },
    )

    test(
      'bloqueia quando Portugal Continental está desativado',
      () => {
        const settings =
          createSettings()

        getMainland(
          settings,
        ).checkoutEnabled =
          false

        expect(() =>
          calculateShippingPricing({
            settings,
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem(),
            ],
          }),
        ).toThrowError(
          /Portugal Continental está desativado/,
        )
      },
    )

    test(
      'bloqueia regiões ainda não suportadas',
      () => {
        expect(() =>
          calculateShippingPricing({
            settings:
              createSettings(),
            region: 'MADEIRA',
            items: [
              createItem(),
            ],
          }),
        ).toThrowError(
          /apenas para Portugal Continental/,
        )
      },
    )

    test(
      'bloqueia política onde os preços não incluem IVA',
      () => {
        const settings =
          createSettings()

        settings.store
          .pricesIncludeTax =
          false

        expect(() =>
          calculateShippingPricing({
            settings,
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem(),
            ],
          }),
        ).toThrowError(
          /exige preços com IVA incluído/,
        )
      },
    )

    test(
      'bloqueia configuração com limites de portes grátis diferentes entre Pequeno e Normal',
      () => {
        const settings =
          createSettings()

        getRule(
          settings,
          'SMALL',
        ).freeShippingThreshold =
          '150.00'

        getRule(
          settings,
          'STANDARD',
        ).freeShippingThreshold =
          '175.00'

        expect(() =>
          calculateShippingPricing({
            settings,
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                productId: 'small',
                shippingClass: 'SMALL',
              }),
              createItem({
                productId:
                  'standard',
                shippingClass:
                  'STANDARD',
              }),
            ],
          }),
        ).toThrowError(
          /limites de portes grátis incompatíveis/,
        )
      },
    )

    test(
      'bloqueia quantidade inválida',
      () => {
        expect(() =>
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                quantity: 0,
              }),
            ],
          }),
        ).toThrowError(
          /quantidade inválida/,
        )
      },
    )

    test(
      'bloqueia preço de produto inválido',
      () => {
        expect(() =>
          calculateShippingPricing({
            settings:
              createSettings(),
            region:
              'PORTUGAL_MAINLAND',
            items: [
              createItem({
                unitPrice:
                  '10.999',
              }),
            ],
          }),
        ).toThrowError(
          /Preço do produto .* inválido/,
        )
      },
    )
  },
)
