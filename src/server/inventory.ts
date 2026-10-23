import { prisma } from './db'

/**
 * Serviço de inventário (etapa 7): consulta de variantes com stock baixo
 * e correção rápida de stock a partir do painel admin. Segue a §13:
 * cliente Prisma injetável com doubles tipados, sem estado global no
 * teste, e validação descritiva em pt-PT.
 */

export const DEFAULT_LOW_STOCK_THRESHOLD = 5

export const MAX_LOW_STOCK_THRESHOLD = 99

export const DEFAULT_LOW_STOCK_LIMIT = 20

export const MAX_LOW_STOCK_LIMIT = 100

export const MAX_STOCK_QUANTITY = 999999

export type InventoryField =
  | 'threshold'
  | 'limit'
  | 'variantId'
  | 'stock'

export class InventoryValidationError extends Error {
  constructor(
    public readonly field: InventoryField,
    message: string,
  ) {
    super(message)
    this.name =
      'InventoryValidationError'
  }
}

export class InventoryNotFoundError extends InventoryValidationError {
  constructor(message = 'Variante não encontrada') {
    super(
      'variantId',
      message,
    )

    this.name =
      'InventoryNotFoundError'
  }
}

/** Variante com stock baixo, tal como é apresentada no painel. */
export type LowStockVariant = {
  variantId: string
  sku: string
  stock: number
  productId: string
  productName: string
  productSlug: string
}

/** Registo cru devolvido pela base de dados (before/after update). */
export type VariantRecord = {
  id: string
  sku: string
  stockQuantity: number
  product: {
    id: string
    name: string
    slug: string
  }
}

export type LowStockVariantSelect = {
  id: true
  sku: true
  stockQuantity: true
  product: {
    select: {
      id: true
      name: true
      slug: true
    }
  }
}

export interface InventoryClient {
  productVariant: {
    findMany(args: {
      where: {
        stockQuantity: {
          lte: number
        }
        isActive: true
        product: {
          isActive: true
        }
      }
      orderBy: Array<
        | {
            stockQuantity: 'asc'
          }
        | {
            sku: 'asc'
          }
      >
      take: number
      select: LowStockVariantSelect
    }): Promise<
      VariantRecord[]
    >
    findUnique(args: {
      where: {
        id: string
      }
      select: LowStockVariantSelect
    }): Promise<VariantRecord | null>
    update(args: {
      where: {
        id: string
      }
      data: {
        stockQuantity: number
      }
      select: LowStockVariantSelect
    }): Promise<VariantRecord>
  }
}

/**
 * Limiar de stock baixo. Aceita `undefined|null|''` (usa o padrão de
 * 5 unidades); rejeita texto não numérico, frações e valores fora de
 * [1, 99] — entradas do dashboard/API nunca chegam à base de dados
 * sem normalização.
 */
export function normalizeLowStockThreshold(
  value: unknown,
): number {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return DEFAULT_LOW_STOCK_THRESHOLD
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new InventoryValidationError(
      'threshold',
      'O limiar de stock deve ser um número inteiro',
    )
  }

  const raw =
    typeof value === 'number'
      ? value
      : Number(
          value.trim(),
        )

  if (
    !Number.isFinite(raw) ||
    !Number.isInteger(raw)
  ) {
    throw new InventoryValidationError(
      'threshold',
      'O limiar de stock deve ser um número inteiro',
    )
  }

  if (
    raw < 1 ||
    raw > MAX_LOW_STOCK_THRESHOLD
  ) {
    throw new InventoryValidationError(
      'threshold',
      `O limiar de stock deve estar entre 1 e ${MAX_LOW_STOCK_THRESHOLD}`,
    )
  }

  return raw
}

/** Número máximo de alertas devolvidos numa consulta. */
export function normalizeLowStockLimit(
  value: unknown,
): number {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return DEFAULT_LOW_STOCK_LIMIT
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new InventoryValidationError(
      'limit',
      'O limite de resultados deve ser um número inteiro',
    )
  }

  const raw =
    typeof value === 'number'
      ? value
      : Number(
          value.trim(),
        )

  if (
    !Number.isFinite(raw) ||
    !Number.isInteger(raw)
  ) {
    throw new InventoryValidationError(
      'limit',
      'O limite de resultados deve ser um número inteiro',
    )
  }

  if (
    raw < 1 ||
    raw > MAX_LOW_STOCK_LIMIT
  ) {
    throw new InventoryValidationError(
      'limit',
      `O limite de resultados deve estar entre 1 e ${MAX_LOW_STOCK_LIMIT}`,
    )
  }

  return raw
}

function toLowStockVariant(
  record: VariantRecord,
): LowStockVariant {
  return {
    variantId:
      record.id,
    sku: record.sku,
    stock:
      record.stockQuantity,
    productId:
      record.product.id,
    productName:
      record.product.name,
    productSlug:
      record.product.slug,
  }
}

function getClient(
  client?: InventoryClient,
): InventoryClient {
  return (
    client ??
    (prisma as unknown as InventoryClient)
  )
}

/**
 * Variantes com stock igual ou inferior ao limiar — só de produtos e
 * variantes ativas (o que a loja efetivamente pode vender). Ordenado
 * pelas unidades mais críticas primeiro, com SKU como desempate.
 */
export async function listLowStockVariants(
  input?:
    | {
        threshold?: unknown
        limit?: unknown
      }
    | undefined,
  client?: InventoryClient,
): Promise<LowStockVariant[]> {
  const threshold =
    normalizeLowStockThreshold(
      input?.threshold,
    )

  const limit =
    normalizeLowStockLimit(
      input?.limit,
    )

  const lowStockClient =
    getClient(client)

  const records =
    await lowStockClient.productVariant.findMany(
      {
        where: {
          stockQuantity: {
            lte: threshold,
          },
          isActive: true,
          product: {
            isActive: true,
          },
        },
        orderBy: [
          {
            stockQuantity:
              'asc',
          },
          {
            sku: 'asc',
          },
        ],
        take: limit,
        select: {
          id: true,
          sku: true,
          stockQuantity: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    )

  return records.map(
    (record) =>
      toLowStockVariant(
        record,
      ),
  )
}

export type VariantStockUpdate = {
  previousStock: number
  variant: LowStockVariant
}

/**
 * Correção rápida de stock: define o stock da variante para um valor
 * exato (não é um delta — o admin vê o valor novo na tabela). Devolve
 * o stock anterior e a variante atualizada; erro 404-like quando a
 * variante não existe, sem fazer update.
 */
export async function updateVariantStock(
  input:
    | {
        variantId: unknown
        stock: unknown
      }
    | undefined,
  client?: InventoryClient,
): Promise<VariantStockUpdate> {
  const variantId =
    normalizeVariantId(
      input?.variantId,
    )

  const stock =
    normalizeStockQuantity(
      input?.stock,
    )

  const inventoryClient =
    getClient(client)

  const current =
    await inventoryClient.productVariant.findUnique(
      {
        where: {
          id: variantId,
        },
        select: {
          id: true,
          sku: true,
          stockQuantity: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    )

  if (!current) {
    throw new InventoryNotFoundError()
  }

  const updated =
    await inventoryClient.productVariant.update(
      {
        where: {
          id: variantId,
        },
        data: {
          stockQuantity:
            stock,
        },
        select: {
          id: true,
          sku: true,
          stockQuantity: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    )

  return {
    previousStock:
      current.stockQuantity,
    variant:
      toLowStockVariant(
        updated,
      ),
  }
}

function normalizeVariantId(
  value: unknown,
): string {
  if (typeof value !== 'string') {
    throw new InventoryValidationError(
      'variantId',
      'Variante inválida',
    )
  }

  const normalizedValue =
    value.trim()

  if (!normalizedValue) {
    throw new InventoryValidationError(
      'variantId',
      'Variante é obrigatória',
    )
  }

  return normalizedValue
}

function normalizeStockQuantity(
  value: unknown,
): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new InventoryValidationError(
      'stock',
      'O stock deve ser um número inteiro',
    )
  }

  const raw =
    typeof value === 'number'
      ? value
      : Number(
          value.trim(),
        )

  if (
    !Number.isFinite(raw) ||
    !Number.isInteger(raw)
  ) {
    throw new InventoryValidationError(
      'stock',
      'O stock deve ser um número inteiro',
    )
  }

  if (
    raw < 0 ||
    raw > MAX_STOCK_QUANTITY
  ) {
    throw new InventoryValidationError(
      'stock',
      `O stock deve estar entre 0 e ${MAX_STOCK_QUANTITY}`,
    )
  }

  return raw
}
