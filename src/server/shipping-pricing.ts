import type {
  CommercialCheckoutRegion,
  CommercialRegionRule,
  CommercialSettings,
  CommercialShippingClass,
  CommercialShippingRule,
} from './commercial-settings'

type DecimalValue =
  | number
  | string
  | {
      toString(): string
    }

export type ShippingPricingItem = {
  productId: string
  quantity: number
  unitPrice: DecimalValue
  shippingClass: CommercialShippingClass
  mainlandShippingCost?: DecimalValue | null
}

export type ShippingPricingInput = {
  settings: CommercialSettings
  region: CommercialCheckoutRegion
  items: ShippingPricingItem[]
}

export type ShippingPricingResult = {
  region: 'PORTUGAL_MAINLAND'
  pricesIncludeTax: true
  taxRatePercent: string
  productsSubtotalCents: number
  nonVolumousSubtotalCents: number
  nonVolumousShippingCents: number
  bulkyShippingCents: number
  shippingTotalCents: number
  includedTaxCents: number
  totalCents: number
  freeShippingApplied: boolean
  freeShippingThresholdCents: number | null
}

export class ShippingPricingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShippingPricingError'
  }
}

function decimalToString(
  value: DecimalValue,
) {
  return value.toString().trim()
}

function moneyToCents(
  value: DecimalValue,
  label: string,
) {
  const rawValue =
    decimalToString(value)

  const match =
    /^(\d+)(?:\.(\d{1,2}))?$/.exec(
      rawValue,
    )

  if (!match) {
    throw new ShippingPricingError(
      `${label} inválido`,
    )
  }

  const wholePart =
    Number(match[1])

  const decimalPart =
    Number(
      (match[2] ?? '')
        .padEnd(2, '0'),
    )

  const cents =
    wholePart * 100 +
    decimalPart

  if (
    !Number.isSafeInteger(cents) ||
    cents < 0
  ) {
    throw new ShippingPricingError(
      `${label} inválido`,
    )
  }

  return cents
}

function percentageToHundredths(
  value: DecimalValue,
) {
  const rawValue =
    decimalToString(value)

  const match =
    /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(
      rawValue,
    )

  if (!match) {
    throw new ShippingPricingError(
      'Taxa de IVA inválida',
    )
  }

  const wholePart =
    Number(match[1])

  const decimalPart =
    Number(
      (match[2] ?? '')
        .padEnd(2, '0'),
    )

  const hundredths =
    wholePart * 100 +
    decimalPart

  if (
    !Number.isSafeInteger(
      hundredths,
    ) ||
    hundredths < 0 ||
    hundredths > 10_000
  ) {
    throw new ShippingPricingError(
      'Taxa de IVA inválida',
    )
  }

  return hundredths
}

function formatPercentageHundredths(
  hundredths: number,
) {
  const whole =
    Math.floor(
      hundredths / 100,
    )

  const decimal =
    String(
      hundredths % 100,
    ).padStart(2, '0')

  return `${whole}.${decimal}`
}

function addCents(
  first: number,
  second: number,
) {
  const result =
    first + second

  if (
    !Number.isSafeInteger(result) ||
    result < 0
  ) {
    throw new ShippingPricingError(
      'O cálculo dos valores excedeu os limites permitidos',
    )
  }

  return result
}

function multiplyCents(
  cents: number,
  quantity: number,
) {
  const result =
    cents * quantity

  if (
    !Number.isSafeInteger(result) ||
    result < 0
  ) {
    throw new ShippingPricingError(
      'O cálculo dos valores excedeu os limites permitidos',
    )
  }

  return result
}

function extractIncludedTaxCents(
  grossCents: number,
  taxRateHundredths: number,
) {
  if (grossCents === 0) {
    return 0
  }

  if (taxRateHundredths === 0) {
    return 0
  }

  const numerator =
    grossCents *
    taxRateHundredths

  if (
    !Number.isSafeInteger(
      numerator,
    )
  ) {
    throw new ShippingPricingError(
      'O cálculo do IVA excedeu os limites permitidos',
    )
  }

  const denominator =
    10_000 +
    taxRateHundredths

  return Math.round(
    numerator / denominator,
  )
}

function getMainlandRegion(
  settings: CommercialSettings,
  region: CommercialCheckoutRegion,
) {
  if (
    region !==
    'PORTUGAL_MAINLAND'
  ) {
    throw new ShippingPricingError(
      'O checkout está disponível apenas para Portugal Continental',
    )
  }

  const regionRule =
    settings.regions.find(
      (candidate) =>
        candidate.region ===
        'PORTUGAL_MAINLAND',
    )

  if (!regionRule) {
    throw new ShippingPricingError(
      'A configuração de Portugal Continental não está disponível',
    )
  }

  if (
    !regionRule.checkoutEnabled
  ) {
    throw new ShippingPricingError(
      'O checkout para Portugal Continental está desativado',
    )
  }

  return regionRule
}

function getEnabledShippingRule(
  regionRule:
    CommercialRegionRule,
  shippingClass:
    CommercialShippingClass,
) {
  const rule =
    regionRule.shippingRules.find(
      (candidate) =>
        candidate.shippingClass ===
        shippingClass,
    )

  if (!rule) {
    throw new ShippingPricingError(
      `Não existe uma regra de transporte para ${shippingClass}`,
    )
  }

  if (!rule.checkoutEnabled) {
    throw new ShippingPricingError(
      `O checkout automático está desativado para ${shippingClass}`,
    )
  }

  return rule
}

function getNonVolumousRuleValues(
  rule: CommercialShippingRule,
) {
  if (
    rule.shippingCost === null
  ) {
    throw new ShippingPricingError(
      `A tarifa de transporte para ${rule.shippingClass} não está configurada`,
    )
  }

  if (
    rule.freeShippingThreshold ===
    null
  ) {
    throw new ShippingPricingError(
      `O limite de portes grátis para ${rule.shippingClass} não está configurado`,
    )
  }

  if (
    rule.maximumShippingCost !==
    null
  ) {
    throw new ShippingPricingError(
      `A regra de ${rule.shippingClass} tem um valor máximo de portes inválido`,
    )
  }

  return {
    shippingCostCents:
      moneyToCents(
        rule.shippingCost,
        `Tarifa de transporte para ${rule.shippingClass}`,
      ),
    freeShippingThresholdCents:
      moneyToCents(
        rule.freeShippingThreshold,
        `Limite de portes grátis para ${rule.shippingClass}`,
      ),
  }
}

function getBulkyRuleValues(
  regionRule:
    CommercialRegionRule,
) {
  const rule =
    getEnabledShippingRule(
      regionRule,
      'BULKY',
    )

  if (
    rule.shippingCost === null ||
    rule.maximumShippingCost ===
      null
  ) {
    throw new ShippingPricingError(
      'O intervalo de portes para produtos volumosos não está configurado',
    )
  }

  if (
    rule.freeShippingThreshold !==
    null
  ) {
    throw new ShippingPricingError(
      'Produtos volumosos não podem ter portes grátis',
    )
  }

  const minimumCents =
    moneyToCents(
      rule.shippingCost,
      'Portes mínimos de produtos volumosos',
    )

  const maximumCents =
    moneyToCents(
      rule.maximumShippingCost,
      'Portes máximos de produtos volumosos',
    )

  if (
    maximumCents <
    minimumCents
  ) {
    throw new ShippingPricingError(
      'Os portes máximos de produtos volumosos não podem ser inferiores aos mínimos',
    )
  }

  return {
    minimumCents,
    maximumCents,
  }
}

function validateQuantity(
  quantity: number,
) {
  if (
    !Number.isSafeInteger(
      quantity,
    ) ||
    quantity <= 0
  ) {
    throw new ShippingPricingError(
      'Existe uma quantidade inválida no carrinho',
    )
  }

  return quantity
}

function validateProductId(
  productId: string,
) {
  const normalized =
    productId.trim()

  if (!normalized) {
    throw new ShippingPricingError(
      'Existe um produto inválido no carrinho',
    )
  }

  return normalized
}

export function calculateShippingPricing(
  input: ShippingPricingInput,
): ShippingPricingResult {
  if (
    input.settings.store
      .pricesIncludeTax !== true
  ) {
    throw new ShippingPricingError(
      'Esta política comercial exige preços com IVA incluído',
    )
  }

  const regionRule =
    getMainlandRegion(
      input.settings,
      input.region,
    )

  if (
    regionRule.taxRatePercent ===
    null
  ) {
    throw new ShippingPricingError(
      'A taxa de IVA de Portugal Continental não está configurada',
    )
  }

  const taxRateHundredths =
    percentageToHundredths(
      regionRule.taxRatePercent,
    )

  let productsSubtotalCents = 0
  let nonVolumousSubtotalCents =
    0
  let bulkyShippingCents = 0

  let hasSmall = false
  let hasStandard = false

  let bulkyRuleValues:
    | {
        minimumCents: number
        maximumCents: number
      }
    | null = null

  for (const item of input.items) {
    const productId =
      validateProductId(
        item.productId,
      )

    const quantity =
      validateQuantity(
        item.quantity,
      )

    const unitPriceCents =
      moneyToCents(
        item.unitPrice,
        `Preço do produto ${productId}`,
      )

    const itemSubtotalCents =
      multiplyCents(
        unitPriceCents,
        quantity,
      )

    productsSubtotalCents =
      addCents(
        productsSubtotalCents,
        itemSubtotalCents,
      )

    switch (
      item.shippingClass
    ) {
      case 'SMALL':
        hasSmall = true

        nonVolumousSubtotalCents =
          addCents(
            nonVolumousSubtotalCents,
            itemSubtotalCents,
          )

        break

      case 'STANDARD':
        hasStandard = true

        nonVolumousSubtotalCents =
          addCents(
            nonVolumousSubtotalCents,
            itemSubtotalCents,
          )

        break

      case 'BULKY': {
        if (
          item.mainlandShippingCost ==
          null
        ) {
          throw new ShippingPricingError(
            `O produto volumoso ${productId} não tem tarifa de transporte para Portugal Continental`,
          )
        }

        if (!bulkyRuleValues) {
          bulkyRuleValues =
            getBulkyRuleValues(
              regionRule,
            )
        }

        const productShippingCents =
          moneyToCents(
            item.mainlandShippingCost,
            `Tarifa de transporte do produto ${productId}`,
          )

        if (
          productShippingCents <
            bulkyRuleValues.minimumCents ||
          productShippingCents >
            bulkyRuleValues.maximumCents
        ) {
          throw new ShippingPricingError(
            `A tarifa de transporte do produto ${productId} está fora do intervalo permitido para produtos volumosos`,
          )
        }

        const itemShippingCents =
          multiplyCents(
            productShippingCents,
            quantity,
          )

        bulkyShippingCents =
          addCents(
            bulkyShippingCents,
            itemShippingCents,
          )

        break
      }

      case 'HEAVY':
      case 'QUOTE_REQUIRED':
      case 'UNASSIGNED':
        throw new ShippingPricingError(
          `O produto ${productId} não permite checkout automático com a classe ${item.shippingClass}`,
        )

      default: {
        const unreachable:
          never =
          item.shippingClass

        throw new ShippingPricingError(
          `Classe de transporte inválida: ${String(unreachable)}`,
        )
      }
    }
  }

  const nonVolumousRules: Array<{
    shippingCostCents: number
    freeShippingThresholdCents:
      number
  }> = []

  if (hasSmall) {
    const smallRule =
      getEnabledShippingRule(
        regionRule,
        'SMALL',
      )

    nonVolumousRules.push(
      getNonVolumousRuleValues(
        smallRule,
      ),
    )
  }

  if (hasStandard) {
    const standardRule =
      getEnabledShippingRule(
        regionRule,
        'STANDARD',
      )

    nonVolumousRules.push(
      getNonVolumousRuleValues(
        standardRule,
      ),
    )
  }

  let nonVolumousShippingCents =
    0

  let freeShippingApplied =
    false

  let freeShippingThresholdCents:
    | number
    | null = null

  if (
    nonVolumousRules.length > 0
  ) {
    const firstThreshold =
      nonVolumousRules[0]
        .freeShippingThresholdCents

    const thresholdsMatch =
      nonVolumousRules.every(
        (rule) =>
          rule.freeShippingThresholdCents ===
          firstThreshold,
      )

    if (!thresholdsMatch) {
      throw new ShippingPricingError(
        'As classes Pequeno e Normal têm limites de portes grátis incompatíveis',
      )
    }

    freeShippingThresholdCents =
      firstThreshold

    if (
      nonVolumousSubtotalCents >=
      firstThreshold
    ) {
      freeShippingApplied = true
    } else {
      nonVolumousShippingCents =
        Math.max(
          ...nonVolumousRules.map(
            (rule) =>
              rule.shippingCostCents,
          ),
        )
    }
  }

  const shippingTotalCents =
    addCents(
      nonVolumousShippingCents,
      bulkyShippingCents,
    )

  const totalCents =
    addCents(
      productsSubtotalCents,
      shippingTotalCents,
    )

  const includedTaxCents =
    extractIncludedTaxCents(
      totalCents,
      taxRateHundredths,
    )

  return {
    region:
      'PORTUGAL_MAINLAND',
    pricesIncludeTax: true,
    taxRatePercent:
      formatPercentageHundredths(
        taxRateHundredths,
      ),
    productsSubtotalCents,
    nonVolumousSubtotalCents,
    nonVolumousShippingCents,
    bulkyShippingCents,
    shippingTotalCents,
    includedTaxCents,
    totalCents,
    freeShippingApplied,
    freeShippingThresholdCents,
  }
}
