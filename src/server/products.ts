import { prisma } from './db'
import { getCommercialSettings } from './commercial-settings'
import {
  productSchema,
  productUpdateSchema,
} from '../lib/admin-validation'

export type ProductShippingClass =
  | 'UNASSIGNED'
  | 'SMALL'
  | 'STANDARD'
  | 'BULKY'
  | 'HEAVY'
  | 'QUOTE_REQUIRED'

type AssignableProductShippingClass =
  Exclude<ProductShippingClass, 'UNASSIGNED'>

type DecimalValue =
  | string
  | number
  | {
      toString(): string
    }

type ProductShippingRateRecord = {
  region: 'PORTUGAL_MAINLAND'
  shippingCost: DecimalValue
}

type ProductRecord = {
  id: string
  categoryId: string
  productBrandId: string | null
  name: string
  slug: string
  sku: string
  description: string | null
  price: number
  stockQuantity: number
  isActive: boolean
  images?: string[]
  shippingClass?: ProductShippingClass
  shippingRates?: ProductShippingRateRecord[]
}

export type ProductResponse = Omit<
  ProductRecord,
  'shippingRates'
> & {
  mainlandShippingCost?: string | null
}

type ProductShippingRateCreateData = {
  region: 'PORTUGAL_MAINLAND'
  shippingCost: string
}

type ProductCreateData = {
  name: string
  slug: string
  sku: string
  description?: string
  price: number
  stockQuantity: number
  categoryId: string
  productBrandId?: string | null
  isActive?: boolean
  images?: string[]
  shippingClass: AssignableProductShippingClass
  shippingRates?: {
    create: ProductShippingRateCreateData
  }
}

type ProductUpdateData = {
  name?: string
  slug?: string
  sku?: string
  description?: string
  price?: number
  stockQuantity?: number
  categoryId?: string
  productBrandId?: string | null
  isActive?: boolean
  images?: string[]
  shippingClass?: AssignableProductShippingClass
  shippingRates?: {
    deleteMany: {
      region: 'PORTUGAL_MAINLAND'
    }
    create?: ProductShippingRateCreateData
  }
}

const mainlandShippingInclude = {
  shippingRates: {
    where: {
      region: 'PORTUGAL_MAINLAND' as const,
    },
    select: {
      region: true,
      shippingCost: true,
    },
  },
} as const

export interface ProductClient {
  productVariant?: {
    upsert(args: {
      where: {
        productId_optionKey: {
          productId: string
          optionKey: string
        }
      }
      update: {
        sku: string
        price: number
        stockQuantity: number
        isActive: boolean
      }
      create: {
        productId: string
        sku: string
        price: number
        stockQuantity: number
        isActive: boolean
        images: string[]
        position: number
        optionKey: string
      }
    }): Promise<{
      id: string
    }>
  }

  product: {
    findMany(args: {
      orderBy: { name: 'asc' }
      include?: typeof mainlandShippingInclude
    }): Promise<ProductRecord[]>

    findUnique(args: {
      where:
        | { id: string }
        | { slug: string }
        | { sku: string }
      include?: typeof mainlandShippingInclude
    }): Promise<ProductRecord | null>

    create(args: {
      data: ProductCreateData
    }): Promise<ProductRecord>

    update(args: {
      where: { id: string }
      data: ProductUpdateData
    }): Promise<ProductRecord>

    delete(args: {
      where: { id: string }
    }): Promise<ProductRecord>
  }

  category: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  productBrand: {
    findUnique(args: {
      where: { id: string }
    }): Promise<{ id: string } | null>
  }

  orderItem: {
    count(args: {
      where: { productId: string }
    }): Promise<number>
  }

  cartItem: {
    count(args: {
      where: { productId: string }
    }): Promise<number>
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

function getClient(
  client?: ProductClient,
): ProductClient {
  return (
    client ??
    (prisma as unknown as ProductClient)
  )
}

function validateId(id: string) {
  if (!id.trim()) {
    throw new ValidationError(
      'ID do produto é obrigatório',
    )
  }
}

function hasOwn(
  value: object,
  key: string,
) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  )
}

function parseDecimalToCents(
  value: DecimalValue,
  fieldName: string,
) {
  const rawValue =
    value.toString().trim()

  const match =
    /^(\d+)(?:\.(\d{1,2}))?$/.exec(
      rawValue,
    )

  if (!match) {
    throw new Error(
      `Configuração comercial inválida: ${fieldName}`,
    )
  }

  const wholePart = Number(match[1])

  const decimalPart = Number(
    (match[2] ?? '').padEnd(2, '0'),
  )

  const cents =
    wholePart * 100 +
    decimalPart

  if (
    !Number.isSafeInteger(cents) ||
    cents < 0
  ) {
    throw new Error(
      `Configuração comercial inválida: ${fieldName}`,
    )
  }

  return cents
}

function normalizeInputShippingCost(
  value: number,
) {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new ValidationError(
      'Valor de portes inválido',
    )
  }

  const scaled = value * 100
  const cents = Math.round(scaled)

  if (
    Math.abs(scaled - cents) >
    0.000001
  ) {
    throw new ValidationError(
      'Os portes só podem ter duas casas decimais',
    )
  }

  return cents
}

function formatCents(cents: number) {
  const whole = Math.floor(cents / 100)

  const decimal = String(
    cents % 100,
  ).padStart(2, '0')

  return `${whole}.${decimal}`
}

function getMainlandRate(
  product: ProductRecord,
) {
  return (
    product.shippingRates?.find(
      (rate) =>
        rate.region ===
        'PORTUGAL_MAINLAND',
    ) ?? null
  )
}

function mapProduct(
  product: ProductRecord,
  mainlandShippingCostOverride?:
    | string
    | null,
): ProductResponse {
  const {
    shippingRates,
    ...productData
  } = product

  const storedRate =
    shippingRates?.find(
      (rate) =>
        rate.region ===
        'PORTUGAL_MAINLAND',
    ) ?? null

  const mainlandShippingCost =
    mainlandShippingCostOverride !==
    undefined
      ? mainlandShippingCostOverride
      : storedRate
        ? formatCents(
            parseDecimalToCents(
              storedRate.shippingCost,
              'portes específicos do produto',
            ),
          )
        : null

  return {
    ...productData,
    shippingClass:
      product.shippingClass ??
      'UNASSIGNED',
    mainlandShippingCost,
  }
}

async function getBulkyShippingBounds() {
  const settings =
    await getCommercialSettings()

  const mainland =
    settings.regions.find(
      (region) =>
        region.region ===
        'PORTUGAL_MAINLAND',
    )

  const bulkyRule =
    mainland?.shippingRules.find(
      (rule) =>
        rule.shippingClass ===
        'BULKY',
    )

  if (
    !bulkyRule ||
    bulkyRule.shippingCost === null ||
    bulkyRule.maximumShippingCost ===
      null
  ) {
    throw new Error(
      'Configuração comercial de artigos volumosos incompleta',
    )
  }

  const minimumCents =
    parseDecimalToCents(
      bulkyRule.shippingCost,
      'portes mínimos de artigos volumosos',
    )

  const maximumCents =
    parseDecimalToCents(
      bulkyRule.maximumShippingCost,
      'portes máximos de artigos volumosos',
    )

  if (
    maximumCents <
    minimumCents
  ) {
    throw new Error(
      'Configuração comercial de artigos volumosos inválida',
    )
  }

  return {
    minimumCents,
    maximumCents,
  }
}

async function validateBulkyShippingCost(
  value: number,
) {
  const cents =
    normalizeInputShippingCost(value)

  const {
    minimumCents,
    maximumCents,
  } = await getBulkyShippingBounds()

  if (
    cents < minimumCents ||
    cents > maximumCents
  ) {
    throw new ValidationError(
      `Os portes específicos têm de estar entre ${formatCents(
        minimumCents,
      )} € e ${formatCents(
        maximumCents,
      )} €`,
    )
  }

  return formatCents(cents)
}

export async function listProducts(
  client?: ProductClient,
) {
  const db = getClient(client)

  const products =
    await db.product.findMany({
      orderBy: { name: 'asc' },
      include:
        mainlandShippingInclude,
    })

  return products.map((product) =>
    mapProduct(product),
  )
}

export async function getProductById(
  id: string,
  client?: ProductClient,
) {
  validateId(id)

  const db = getClient(client)

  const product =
    await db.product.findUnique({
      where: { id },
      include:
        mainlandShippingInclude,
    })

  if (!product) {
    throw new NotFoundError(
      'Produto não encontrado',
    )
  }

  return mapProduct(product)
}

export async function createProduct(
  input: unknown,
  client?: ProductClient,
) {
  const db = getClient(client)
  const data =
    productSchema.parse(input)

  const existingBySlug =
    await db.product.findUnique({
      where: { slug: data.slug },
    })

  if (existingBySlug) {
    throw new ConflictError(
      'Já existe um produto com este slug',
    )
  }

  const existingBySku =
    await db.product.findUnique({
      where: { sku: data.sku },
    })

  if (existingBySku) {
    throw new ConflictError(
      'Já existe um produto com este SKU',
    )
  }

  const categoryExists =
    await db.category.findUnique({
      where: { id: data.categoryId },
    })

  if (!categoryExists) {
    throw new ValidationError(
      'Categoria não encontrada para o ID fornecido',
    )
  }

  if (
    typeof data.productBrandId ===
    'string'
  ) {
    const brandExists =
      await db.productBrand.findUnique(
        {
          where: {
            id: data.productBrandId,
          },
        },
      )

    if (!brandExists) {
      throw new ValidationError(
        'Marca não encontrada para o ID fornecido',
      )
    }
  }

  const {
  mainlandShippingCost,
  ...productData
} = data

let normalizedShippingCost:
  | string
  | null = null

if (
  data.shippingClass === 'BULKY'
) {
  if (
    mainlandShippingCost == null
  ) {
    throw new ValidationError(
      'Artigos volumosos precisam de portes específicos',
    )
  }

  normalizedShippingCost =
    await validateBulkyShippingCost(
      mainlandShippingCost,
    )
}

  const createData: ProductCreateData =
    {
      ...productData,
      isActive:
        data.isActive ?? true,
      images: data.images ?? [],
    }

  if (
    data.shippingClass ===
      'BULKY' &&
    normalizedShippingCost !== null
  ) {
    createData.shippingRates = {
      create: {
        region:
          'PORTUGAL_MAINLAND',
        shippingCost:
          normalizedShippingCost,
      },
    }
  }

  const product =
    await db.product.create({
      data: createData,
    })

  if (db.productVariant) {
    await db.productVariant.upsert({
      where: {
        productId_optionKey: {
          productId: product.id,
          optionKey: 'default',
        },
      },
      update: {
        sku: product.sku,
        price: product.price,
        stockQuantity:
          product.stockQuantity,
        isActive:
          product.isActive,
      },
      create: {
        productId: product.id,
        sku: product.sku,
        price: product.price,
        stockQuantity:
          product.stockQuantity,
        isActive:
          product.isActive,
        images: [],
        position: 0,
        optionKey: 'default',
      },
    })
  }

  return mapProduct(
    product,
    normalizedShippingCost,
  )
}

export async function updateProduct(
  id: string,
  input: unknown,
  client?: ProductClient,
) {
  validateId(id)

  const db = getClient(client)
  const data =
    productUpdateSchema.parse(input)

  const existing =
    await db.product.findUnique({
      where: { id },
      include:
        mainlandShippingInclude,
    })

  if (!existing) {
    throw new NotFoundError(
      'Produto não encontrado',
    )
  }

  if (
    data.slug &&
    data.slug !== existing.slug
  ) {
    const slugConflict =
      await db.product.findUnique({
        where: { slug: data.slug },
      })

    if (
      slugConflict &&
      slugConflict.id !== id
    ) {
      throw new ConflictError(
        'Já existe um produto com este slug',
      )
    }
  }

  if (
    data.sku &&
    data.sku !== existing.sku
  ) {
    const skuConflict =
      await db.product.findUnique({
        where: { sku: data.sku },
      })

    if (
      skuConflict &&
      skuConflict.id !== id
    ) {
      throw new ConflictError(
        'Já existe um produto com este SKU',
      )
    }
  }

  if (
    data.categoryId !== undefined
  ) {
    const categoryExists =
      await db.category.findUnique({
        where: {
          id: data.categoryId,
        },
      })

    if (!categoryExists) {
      throw new ValidationError(
        'Categoria não encontrada para o ID fornecido',
      )
    }
  }

  if (
    typeof data.productBrandId ===
    'string'
  ) {
    const brandExists =
      await db.productBrand.findUnique(
        {
          where: {
            id: data.productBrandId,
          },
        },
      )

    if (!brandExists) {
      throw new ValidationError(
        'Marca não encontrada para o ID fornecido',
      )
    }
  }

  const hasMainlandShippingCost =
    hasOwn(
      data,
      'mainlandShippingCost',
    )

  const {
    mainlandShippingCost,
    ...productData
  } = data

  const existingShippingClass =
    existing.shippingClass ??
    'UNASSIGNED'

  const finalShippingClass =
    data.shippingClass ??
    existingShippingClass

  const existingMainlandRate =
    getMainlandRate(existing)

  let shippingRates:
    | ProductUpdateData['shippingRates']
    | undefined

  let responseShippingCost:
    | string
    | null
    | undefined

  if (
    finalShippingClass === 'BULKY'
  ) {
    const switchingToBulky =
      data.shippingClass ===
        'BULKY' &&
      existingShippingClass !==
        'BULKY'

    if (
      hasMainlandShippingCost ||
      switchingToBulky
    ) {
      if (
        mainlandShippingCost ==
        null
      ) {
        throw new ValidationError(
          'Artigos volumosos precisam de portes específicos',
        )
      }

      const normalized =
        await validateBulkyShippingCost(
          mainlandShippingCost,
        )

      shippingRates = {
        deleteMany: {
          region:
            'PORTUGAL_MAINLAND',
        },
        create: {
          region:
            'PORTUGAL_MAINLAND',
          shippingCost: normalized,
        },
      }

      responseShippingCost =
        normalized
    } else {
      if (!existingMainlandRate) {
        throw new ValidationError(
          'Artigo volumoso sem portes específicos configurados',
        )
      }

      responseShippingCost =
        formatCents(
          parseDecimalToCents(
            existingMainlandRate.shippingCost,
            'portes específicos do produto',
          ),
        )
    }
  } else {
    if (
      hasMainlandShippingCost &&
      mainlandShippingCost != null
    ) {
      throw new ValidationError(
        'Portes específicos só são permitidos em artigos volumosos',
      )
    }

    if (existingMainlandRate) {
      shippingRates = {
        deleteMany: {
          region:
            'PORTUGAL_MAINLAND',
        },
      }
    }

    responseShippingCost = null
  }

  const updateData: ProductUpdateData =
    {
      ...productData,
    }

  if (shippingRates) {
    updateData.shippingRates =
      shippingRates
  }

  const product =
    await db.product.update({
      where: { id },
      data: updateData,
    })

  if (db.productVariant) {
    await db.productVariant.upsert({
      where: {
        productId_optionKey: {
          productId: product.id,
          optionKey: 'default',
        },
      },
      update: {
        sku: product.sku,
        price: product.price,
        stockQuantity:
          product.stockQuantity,
        isActive:
          product.isActive,
      },
      create: {
        productId: product.id,
        sku: product.sku,
        price: product.price,
        stockQuantity:
          product.stockQuantity,
        isActive:
          product.isActive,
        images: [],
        position: 0,
        optionKey: 'default',
      },
    })
  }

  return mapProduct(
    product,
    responseShippingCost,
  )
}

export async function deleteProduct(
  id: string,
  client?: ProductClient,
) {
  validateId(id)

  const db = getClient(client)

  const existing =
    await db.product.findUnique({
      where: { id },
    })

  if (!existing) {
    throw new NotFoundError(
      'Produto não encontrado',
    )
  }

  const orderItemsCount =
    await db.orderItem.count({
      where: { productId: id },
    })

  if (orderItemsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar um produto com encomendas associadas',
    )
  }

  const cartItemsCount =
    await db.cartItem.count({
      where: { productId: id },
    })

  if (cartItemsCount > 0) {
    throw new ConflictError(
      'Não é possível apagar um produto com carrinhos associados',
    )
  }

  return db.product.delete({
    where: { id },
  })
}
