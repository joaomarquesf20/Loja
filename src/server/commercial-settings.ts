import { prisma } from './db'

const STORE_SETTINGS_ID = 'store'

export const CHECKOUT_REGIONS = [
  'PORTUGAL_MAINLAND',
  'MADEIRA',
  'AZORES',
  'INTERNATIONAL',
] as const

export type CommercialCheckoutRegion =
  (typeof CHECKOUT_REGIONS)[number]

export const SHIPPING_CLASSES = [
  'SMALL',
  'STANDARD',
  'BULKY',
  'HEAVY',
  'QUOTE_REQUIRED',
  'UNASSIGNED',
] as const

export type CommercialShippingClass =
  (typeof SHIPPING_CLASSES)[number]

type DecimalValue =
  | string
  | number
  | {
      toString(): string
    }

type StoreSettingsRecord = {
  id: string
  pricesIncludeTax: boolean
}

type RegionRuleRecord = {
  region: CommercialCheckoutRegion
  checkoutEnabled: boolean
  taxRatePercent: DecimalValue | null
}

type ShippingRuleRecord = {
  id: string
  region: CommercialCheckoutRegion
  shippingClass: CommercialShippingClass
  checkoutEnabled: boolean
  shippingCost: DecimalValue | null
  maximumShippingCost: DecimalValue | null
  freeShippingThreshold: DecimalValue | null
}

type RegionRuleWriteData = {
  region: CommercialCheckoutRegion
  checkoutEnabled: boolean
  taxRatePercent: string | null
}

type ShippingRuleWriteData = {
  region: CommercialCheckoutRegion
  shippingClass: CommercialShippingClass
  checkoutEnabled: boolean
  shippingCost: string | null
  maximumShippingCost: string | null
  freeShippingThreshold: string | null
}

const storeSettingsSelect = {
  id: true,
  pricesIncludeTax: true,
} as const

const regionRuleSelect = {
  region: true,
  checkoutEnabled: true,
  taxRatePercent: true,
} as const

const shippingRuleSelect = {
  id: true,
  region: true,
  shippingClass: true,
  checkoutEnabled: true,
  shippingCost: true,
  maximumShippingCost: true,
  freeShippingThreshold: true,
} as const

export interface CommercialSettingsClient {
  storeSettings: {
    findUnique(args: {
      where: {
        id: string
      }
      select: typeof storeSettingsSelect
    }): Promise<StoreSettingsRecord | null>

    upsert(args: {
      where: {
        id: string
      }
      update: {
        pricesIncludeTax?: boolean
      }
      create: {
        id: string
        pricesIncludeTax: boolean
      }
      select: typeof storeSettingsSelect
    }): Promise<StoreSettingsRecord>
  }

  checkoutRegionRule: {
    findMany(args: {
      select: typeof regionRuleSelect
    }): Promise<RegionRuleRecord[]>

    createMany(args: {
      data: RegionRuleWriteData[]
      skipDuplicates: true
    }): Promise<{
      count: number
    }>

    upsert(args: {
      where: {
        region: CommercialCheckoutRegion
      }
      update: {
        checkoutEnabled: boolean
        taxRatePercent: string | null
      }
      create: RegionRuleWriteData
      select: typeof regionRuleSelect
    }): Promise<RegionRuleRecord>
  }

  shippingRule: {
    findMany(args: {
      select: typeof shippingRuleSelect
    }): Promise<ShippingRuleRecord[]>

    createMany(args: {
      data: ShippingRuleWriteData[]
      skipDuplicates: true
    }): Promise<{
      count: number
    }>

    upsert(args: {
      where: {
        region_shippingClass: {
          region: CommercialCheckoutRegion
          shippingClass: CommercialShippingClass
        }
      }
      update: {
        checkoutEnabled: boolean
        shippingCost: string | null
        maximumShippingCost: string | null
        freeShippingThreshold: string | null
      }
      create: ShippingRuleWriteData
      select: typeof shippingRuleSelect
    }): Promise<ShippingRuleRecord>
  }
}

export type CommercialStoreSettings = {
  id: string
  pricesIncludeTax: boolean
}

export type CommercialShippingRule = {
  id: string
  region: CommercialCheckoutRegion
  shippingClass: CommercialShippingClass
  checkoutEnabled: boolean
  shippingCost: string | null
  maximumShippingCost: string | null
  freeShippingThreshold: string | null
}

export type CommercialRegionRule = {
  region: CommercialCheckoutRegion
  checkoutEnabled: boolean
  taxRatePercent: string | null
  shippingRules: CommercialShippingRule[]
}

export type CommercialSettings = {
  store: CommercialStoreSettings
  regions: CommercialRegionRule[]
}

export class CommercialSettingsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name =
      'CommercialSettingsValidationError'
  }
}

export class CommercialSettingsConfigurationError extends Error {
  constructor(
    message =
      'Configuração comercial incompleta',
  ) {
    super(message)
    this.name =
      'CommercialSettingsConfigurationError'
  }
}

const MAX_MONEY_HUNDREDTHS =
  9_999_999_999

const MAX_TAX_HUNDREDTHS =
  10_000

function getClient(
  client?: CommercialSettingsClient,
): CommercialSettingsClient {
  return (
    client ??
    (prisma as unknown as CommercialSettingsClient)
  )
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  )
}

function parseDecimalRaw(
  rawValue: string,
  fieldName: string,
  maximumHundredths: number,
) {
  const normalizedValue =
    rawValue.trim()

  const match =
    /^(\d+)(?:\.(\d{1,2}))?$/.exec(
      normalizedValue,
    )

  if (!match) {
    throw new CommercialSettingsValidationError(
      `${fieldName} é inválido`,
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
    hundredths >
      maximumHundredths
  ) {
    throw new CommercialSettingsValidationError(
      `${fieldName} é inválido`,
    )
  }

  const whole =
    Math.floor(
      hundredths / 100,
    )

  const decimal =
    String(
      hundredths % 100,
    ).padStart(2, '0')

  return {
    value: `${whole}.${decimal}`,
    hundredths,
  }
}

function normalizeDecimalInput(
  value: unknown,
  fieldName: string,
  maximumHundredths: number,
) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    throw new CommercialSettingsValidationError(
      `${fieldName} é inválido`,
    )
  }

  if (
    typeof value === 'number' &&
    !Number.isFinite(value)
  ) {
    throw new CommercialSettingsValidationError(
      `${fieldName} é inválido`,
    )
  }

  return parseDecimalRaw(
    String(value),
    fieldName,
    maximumHundredths,
  )
}

function normalizeNullableDecimalInput(
  value: unknown,
  fieldName: string,
  maximumHundredths: number,
) {
  if (value === null) {
    return null
  }

  return normalizeDecimalInput(
    value,
    fieldName,
    maximumHundredths,
  )
}

function normalizeStoredDecimal(
  value: DecimalValue | null,
  fieldName: string,
  maximumHundredths: number,
) {
  if (value === null) {
    return null
  }

  try {
    return parseDecimalRaw(
      value.toString(),
      fieldName,
      maximumHundredths,
    ).value
  } catch {
    throw new CommercialSettingsConfigurationError(
      `Valor inválido em ${fieldName}`,
    )
  }
}

function normalizeRegion(
  value: unknown,
): CommercialCheckoutRegion {
  if (typeof value !== 'string') {
    throw new CommercialSettingsValidationError(
      'Região inválida',
    )
  }

  const normalizedValue =
    value.trim()

  if (
    !CHECKOUT_REGIONS.some(
      (region) =>
        region === normalizedValue,
    )
  ) {
    throw new CommercialSettingsValidationError(
      'Região inválida',
    )
  }

  return normalizedValue as CommercialCheckoutRegion
}

function normalizeShippingClass(
  value: unknown,
): CommercialShippingClass {
  if (typeof value !== 'string') {
    throw new CommercialSettingsValidationError(
      'Classe de transporte inválida',
    )
  }

  const normalizedValue =
    value.trim()

  if (
    !SHIPPING_CLASSES.some(
      (shippingClass) =>
        shippingClass ===
        normalizedValue,
    )
  ) {
    throw new CommercialSettingsValidationError(
      'Classe de transporte inválida',
    )
  }

  return normalizedValue as CommercialShippingClass
}

function getRegionDefaults(
  region: CommercialCheckoutRegion,
): RegionRuleWriteData {
  if (
    region ===
    'PORTUGAL_MAINLAND'
  ) {
    return {
      region,
      checkoutEnabled: true,
      taxRatePercent: '23.00',
    }
  }

  return {
    region,
    checkoutEnabled: false,
    taxRatePercent: null,
  }
}

function getShippingDefaults(
  region: CommercialCheckoutRegion,
  shippingClass: CommercialShippingClass,
): ShippingRuleWriteData {
  const disabledRule: ShippingRuleWriteData =
    {
      region,
      shippingClass,
      checkoutEnabled: false,
      shippingCost: null,
      maximumShippingCost: null,
      freeShippingThreshold: null,
    }

  if (
    region !==
    'PORTUGAL_MAINLAND'
  ) {
    return disabledRule
  }

  switch (shippingClass) {
    case 'SMALL':
      return {
        region,
        shippingClass,
        checkoutEnabled: true,
        shippingCost: '5.90',
        maximumShippingCost: null,
        freeShippingThreshold:
          '150.00',
      }

    case 'STANDARD':
      return {
        region,
        shippingClass,
        checkoutEnabled: true,
        shippingCost: '8.90',
        maximumShippingCost: null,
        freeShippingThreshold:
          '150.00',
      }

    case 'BULKY':
      return {
        region,
        shippingClass,
        checkoutEnabled: true,
        shippingCost: '19.90',
        maximumShippingCost:
          '29.90',
        freeShippingThreshold: null,
      }

    default:
      return disabledRule
  }
}

function getDefaultRegionRows() {
  return CHECKOUT_REGIONS.map(
    getRegionDefaults,
  )
}

function getDefaultShippingRows() {
  return CHECKOUT_REGIONS.flatMap(
    (region) =>
      SHIPPING_CLASSES.map(
        (shippingClass) =>
          getShippingDefaults(
            region,
            shippingClass,
          ),
      ),
  )
}

function mapStoreSettings(
  record: StoreSettingsRecord,
): CommercialStoreSettings {
  return {
    id: record.id,
    pricesIncludeTax:
      record.pricesIncludeTax,
  }
}

function mapShippingRule(
  record: ShippingRuleRecord,
): CommercialShippingRule {
  return {
    id: record.id,
    region: record.region,
    shippingClass:
      record.shippingClass,
    checkoutEnabled:
      record.checkoutEnabled,
    shippingCost:
      normalizeStoredDecimal(
        record.shippingCost,
        'portes',
        MAX_MONEY_HUNDREDTHS,
      ),
    maximumShippingCost:
      normalizeStoredDecimal(
        record.maximumShippingCost,
        'portes máximos',
        MAX_MONEY_HUNDREDTHS,
      ),
    freeShippingThreshold:
      normalizeStoredDecimal(
        record.freeShippingThreshold,
        'limite de portes grátis',
        MAX_MONEY_HUNDREDTHS,
      ),
  }
}

function mapCommercialSettings(
  store: StoreSettingsRecord,
  regions: RegionRuleRecord[],
  shippingRules:
    ShippingRuleRecord[],
): CommercialSettings {
  const mappedRegions =
    CHECKOUT_REGIONS.map(
      (region) => {
        const regionRecord =
          regions.find(
            (record) =>
              record.region === region,
          )

        if (!regionRecord) {
          throw new CommercialSettingsConfigurationError()
        }

        const mappedShippingRules =
          SHIPPING_CLASSES.map(
            (shippingClass) => {
              const shippingRule =
                shippingRules.find(
                  (record) =>
                    record.region ===
                      region &&
                    record.shippingClass ===
                      shippingClass,
                )

              if (!shippingRule) {
                throw new CommercialSettingsConfigurationError()
              }

              return mapShippingRule(
                shippingRule,
              )
            },
          )

        return {
          region:
            regionRecord.region,
          checkoutEnabled:
            regionRecord.checkoutEnabled,
          taxRatePercent:
            normalizeStoredDecimal(
              regionRecord.taxRatePercent,
              'taxa de IVA',
              MAX_TAX_HUNDREDTHS,
            ),
          shippingRules:
            mappedShippingRules,
        }
      },
    )

  return {
    store:
      mapStoreSettings(store),
    regions: mappedRegions,
  }
}

function hasCompleteSettings(
  store: StoreSettingsRecord | null,
  regions: RegionRuleRecord[],
  shippingRules:
    ShippingRuleRecord[],
) {
  if (!store) {
    return false
  }

  const allRegionsExist =
    CHECKOUT_REGIONS.every(
      (region) =>
        regions.some(
          (record) =>
            record.region === region,
        ),
    )

  if (!allRegionsExist) {
    return false
  }

  return CHECKOUT_REGIONS.every(
    (region) =>
      SHIPPING_CLASSES.every(
        (shippingClass) =>
          shippingRules.some(
            (record) =>
              record.region ===
                region &&
              record.shippingClass ===
                shippingClass,
          ),
      ),
  )
}

async function readSettings(
  client: CommercialSettingsClient,
) {
  const [
    store,
    regions,
    shippingRules,
  ] = await Promise.all([
    client.storeSettings.findUnique({
      where: {
        id: STORE_SETTINGS_ID,
      },
      select:
        storeSettingsSelect,
    }),

    client.checkoutRegionRule.findMany(
      {
        select:
          regionRuleSelect,
      },
    ),

    client.shippingRule.findMany({
      select:
        shippingRuleSelect,
    }),
  ])

  return {
    store,
    regions,
    shippingRules,
  }
}

export async function initializeCommercialSettings(
  client?: CommercialSettingsClient,
) {
  const db = getClient(client)

  await db.storeSettings.upsert({
    where: {
      id: STORE_SETTINGS_ID,
    },
    update: {},
    create: {
      id: STORE_SETTINGS_ID,
      pricesIncludeTax: true,
    },
    select:
      storeSettingsSelect,
  })

  await db.checkoutRegionRule.createMany(
    {
      data:
        getDefaultRegionRows(),
      skipDuplicates: true,
    },
  )

  await db.shippingRule.createMany(
    {
      data:
        getDefaultShippingRows(),
      skipDuplicates: true,
    },
  )
}

export async function getCommercialSettings(
  client?: CommercialSettingsClient,
): Promise<CommercialSettings> {
  const db = getClient(client)

  let current =
    await readSettings(db)

  if (
    !hasCompleteSettings(
      current.store,
      current.regions,
      current.shippingRules,
    )
  ) {
    await initializeCommercialSettings(
      db,
    )

    current =
      await readSettings(db)
  }

  if (
    !current.store ||
    !hasCompleteSettings(
      current.store,
      current.regions,
      current.shippingRules,
    )
  ) {
    throw new CommercialSettingsConfigurationError()
  }

  return mapCommercialSettings(
    current.store,
    current.regions,
    current.shippingRules,
  )
}

function parseStoreSettingsInput(
  input: unknown,
) {
  if (
    !isRecord(input) ||
    !hasOwn(
      input,
      'pricesIncludeTax',
    ) ||
    typeof input.pricesIncludeTax !==
      'boolean'
  ) {
    throw new CommercialSettingsValidationError(
      'Configuração de IVA inválida',
    )
  }

  return {
    pricesIncludeTax:
      input.pricesIncludeTax,
  }
}

function parseRegionRuleInput(
  input: unknown,
) {
  if (!isRecord(input)) {
    throw new CommercialSettingsValidationError(
      'Configuração da região inválida',
    )
  }

  if (
    !hasOwn(
      input,
      'checkoutEnabled',
    ) ||
    typeof input.checkoutEnabled !==
      'boolean'
  ) {
    throw new CommercialSettingsValidationError(
      'Estado do checkout inválido',
    )
  }

  if (
    !hasOwn(
      input,
      'taxRatePercent',
    )
  ) {
    throw new CommercialSettingsValidationError(
      'Taxa de IVA inválida',
    )
  }

  const taxRate =
    normalizeNullableDecimalInput(
      input.taxRatePercent,
      'Taxa de IVA',
      MAX_TAX_HUNDREDTHS,
    )

  if (
    input.checkoutEnabled &&
    taxRate === null
  ) {
    throw new CommercialSettingsValidationError(
      'Taxa de IVA é obrigatória quando a região está ativa',
    )
  }

  return {
    checkoutEnabled:
      input.checkoutEnabled,
    taxRatePercent:
      taxRate?.value ?? null,
  }
}

function parseShippingRuleInput(
  shippingClass:
    CommercialShippingClass,
  input: unknown,
) {
  if (!isRecord(input)) {
    throw new CommercialSettingsValidationError(
      'Configuração de portes inválida',
    )
  }

  if (
    !hasOwn(
      input,
      'checkoutEnabled',
    ) ||
    typeof input.checkoutEnabled !==
      'boolean'
  ) {
    throw new CommercialSettingsValidationError(
      'Estado dos portes inválido',
    )
  }

  const requiredFields = [
    'shippingCost',
    'maximumShippingCost',
    'freeShippingThreshold',
  ] as const

  for (
    const field of requiredFields
  ) {
    if (!hasOwn(input, field)) {
      throw new CommercialSettingsValidationError(
        'Configuração de portes incompleta',
      )
    }
  }

  const shippingCost =
    normalizeNullableDecimalInput(
      input.shippingCost,
      'Portes',
      MAX_MONEY_HUNDREDTHS,
    )

  const maximumShippingCost =
    normalizeNullableDecimalInput(
      input.maximumShippingCost,
      'Portes máximos',
      MAX_MONEY_HUNDREDTHS,
    )

  const freeShippingThreshold =
    normalizeNullableDecimalInput(
      input.freeShippingThreshold,
      'Limite de portes grátis',
      MAX_MONEY_HUNDREDTHS,
    )

  if (
    shippingClass ===
      'UNASSIGNED' ||
    shippingClass ===
      'QUOTE_REQUIRED'
  ) {
    if (input.checkoutEnabled) {
      throw new CommercialSettingsValidationError(
        'Esta classe não pode usar checkout automático',
      )
    }

    if (
      shippingCost !== null ||
      maximumShippingCost !==
        null ||
      freeShippingThreshold !==
        null
    ) {
      throw new CommercialSettingsValidationError(
        'Esta classe não pode ter portes automáticos',
      )
    }
  }

  if (
    shippingClass === 'BULKY'
  ) {
    if (
      freeShippingThreshold !==
      null
    ) {
      throw new CommercialSettingsValidationError(
        'Artigos volumosos não podem ter portes grátis',
      )
    }

    if (
      input.checkoutEnabled &&
      (
        shippingCost === null ||
        maximumShippingCost ===
          null
      )
    ) {
      throw new CommercialSettingsValidationError(
        'Artigos volumosos ativos precisam de portes mínimos e máximos',
      )
    }

    if (
      maximumShippingCost !==
        null &&
      shippingCost === null
    ) {
      throw new CommercialSettingsValidationError(
        'Portes mínimos são obrigatórios quando existem portes máximos',
      )
    }

    if (
      shippingCost !== null &&
      maximumShippingCost !==
        null &&
      maximumShippingCost.hundredths <
        shippingCost.hundredths
    ) {
      throw new CommercialSettingsValidationError(
        'Portes máximos não podem ser inferiores aos portes mínimos',
      )
    }
  } else if (
    maximumShippingCost !== null
  ) {
    throw new CommercialSettingsValidationError(
      'Portes máximos só são permitidos para artigos volumosos',
    )
  }

  if (
    input.checkoutEnabled &&
    shippingClass !==
      'UNASSIGNED' &&
    shippingClass !==
      'QUOTE_REQUIRED' &&
    shippingCost === null
  ) {
    throw new CommercialSettingsValidationError(
      'Portes são obrigatórios quando a classe está ativa',
    )
  }

  return {
    checkoutEnabled:
      input.checkoutEnabled,
    shippingCost:
      shippingCost?.value ?? null,
    maximumShippingCost:
      maximumShippingCost?.value ??
      null,
    freeShippingThreshold:
      freeShippingThreshold?.value ??
      null,
  }
}

export async function updateStoreSettings(
  input: unknown,
  client?: CommercialSettingsClient,
) {
  const db = getClient(client)
  const data =
    parseStoreSettingsInput(input)

  const result =
    await db.storeSettings.upsert({
      where: {
        id: STORE_SETTINGS_ID,
      },
      update: data,
      create: {
        id: STORE_SETTINGS_ID,
        ...data,
      },
      select:
        storeSettingsSelect,
    })

  return mapStoreSettings(result)
}

export async function updateCheckoutRegionRule(
  regionInput: unknown,
  input: unknown,
  client?: CommercialSettingsClient,
) {
  const db = getClient(client)

  const region =
    normalizeRegion(regionInput)

  const data =
    parseRegionRuleInput(input)

  const result =
    await db.checkoutRegionRule.upsert(
      {
        where: {
          region,
        },
        update: data,
        create: {
          region,
          ...data,
        },
        select:
          regionRuleSelect,
      },
    )

  return {
    region: result.region,
    checkoutEnabled:
      result.checkoutEnabled,
    taxRatePercent:
      normalizeStoredDecimal(
        result.taxRatePercent,
        'taxa de IVA',
        MAX_TAX_HUNDREDTHS,
      ),
  }
}

export async function updateShippingRule(
  regionInput: unknown,
  shippingClassInput: unknown,
  input: unknown,
  client?: CommercialSettingsClient,
) {
  const db = getClient(client)

  const region =
    normalizeRegion(regionInput)

  const shippingClass =
    normalizeShippingClass(
      shippingClassInput,
    )

  const data =
    parseShippingRuleInput(
      shippingClass,
      input,
    )

  const result =
    await db.shippingRule.upsert({
      where: {
        region_shippingClass: {
          region,
          shippingClass,
        },
      },
      update: data,
      create: {
        region,
        shippingClass,
        ...data,
      },
      select:
        shippingRuleSelect,
    })

  return mapShippingRule(result)
}
