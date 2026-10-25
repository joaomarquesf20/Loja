import { prisma } from './db'

import { z } from 'zod'

/**
 * Serviço de inventário (etapa 7): consulta de variantes com stock baixo
 * e correção rápida de stock a partir do painel admin. Segue a §13:
 * cliente Prisma injetável com doubles tipados, sem estado global no
 * teste, e validação descritiva em pt-PT.
 *
 * Épico 6: vista completa de inventário para a administração — listagem
 * geral das variantes com estado derivado do limiar (Disponível / Stock
 * baixo / Sem stock), KPIs de topo e correção rápida dentro de uma
 * transação. Entradas novas validadas com Zod.
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

/**
 * Forma do `where` dos contadores KPI: variantes e produtos ativos, com
 * filtro de stock opcional (valor exato para "sem stock" ou intervalo
 * para "stock baixo").
 */
export type InventoryCountWhere = {
  isActive: true
  product: {
    isActive: true
  }
  stockQuantity?:
    | number
    | {
        gte: number
        lte: number
      }
}

/**
 * Cliente visível DENTRO de uma transação de inventário: as escritas e
 * leituras da correção rápida e os contadores/listagem da vista completa
 * correm todos sobre o mesmo cliente transacional.
 */
export interface InventoryTransactionClient {
  productVariant: {
    count(args: {
      where: InventoryCountWhere
    }): Promise<number>
    findMany(args: {
      where: {
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
    }): Promise<VariantRecord[]>
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
  $transaction<T>(
    callback: (
      transaction: InventoryTransactionClient,
    ) => Promise<T>,
  ): Promise<T>
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
 *
 * Épico 6: a leitura do stock anterior e a escrita do novo valor correm
 * DENTRO da mesma transação atómica — duas correções concorrentes nunca
 * intercalam leitura/escrita de forma inconsistente.
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

  return inventoryClient.$transaction(
    async (transaction) => {
      const current =
        await transaction.productVariant.findUnique(
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
        await transaction.productVariant.update(
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
    },
  )
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

const inventoryThresholdMessage =
  `O limiar de stock deve estar entre 1 e ${MAX_LOW_STOCK_THRESHOLD}`

/**
 * Query da vista de inventário (Épico 6) — validação Zod: o limiar
 * aceita `undefined|null|''` (padrão de 5) e números inteiros em
 * [1, 99], recusando texto não numérico e frações com mensagens em
 * pt-PT para o campo.
 */
export const inventoryOverviewQuerySchema =
  z.object({
    threshold: z.preprocess(
      (value) =>
        value === undefined ||
        value === null ||
        (typeof value === 'string' &&
          value.trim() === '')
          ? undefined
          : value,
      z.coerce
        .number({
          message:
            'O limiar de stock deve ser um número inteiro',
        })
        .int({
          message:
            'O limiar de stock deve ser um número inteiro',
        })
        .min(1, {
          message:
            inventoryThresholdMessage,
        })
        .max(MAX_LOW_STOCK_THRESHOLD, {
          message:
            inventoryThresholdMessage,
        })
        .default(
          DEFAULT_LOW_STOCK_THRESHOLD,
        ),
    ),
  })

export type InventoryOverviewQueryOutput =
  z.infer<
    typeof inventoryOverviewQuerySchema
  >

/** Estado de stock derivado do limiar configurado. */
export type InventoryStatus =
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'

/** Linha da vista de inventário: variante + estado calculado. */
export type InventoryRow = {
  variantId: string
  sku: string
  stock: number
  status: InventoryStatus
  productId: string
  productName: string
  productSlug: string
}

/** KPIs de topo da vista de inventário. */
export type InventoryKpis = {
  totalSkus: number
  inStockCount: number
  lowStockCount: number
  outOfStockCount: number
}

export type InventoryOverview = {
  threshold: number
  kpis: InventoryKpis
  variants: InventoryRow[]
}

/** Teto de variantes devolvido pela vista completa (proteção do payload). */
export const MAX_INVENTORY_ROWS = 1000

function inventoryStatusFromStock(
  stock: number,
  threshold: number,
): InventoryStatus {
  if (stock <= 0) {
    return 'OUT_OF_STOCK'
  }

  if (stock <= threshold) {
    return 'LOW_STOCK'
  }

  return 'IN_STOCK'
}

/**
 * Vista completa do inventário (Épico 6): KPIs de topo (total de SKUs
 * ativos, com stock baixo e sem stock) + listagem geral das variantes
 * com o estado derivado do limiar. Contadores e listagem correm na
 * MESMA transação de leitura para refletirem um snapshot coerente; o
 * limiar é validado com Zod e rejeita entradas inválidas antes de
 * tocar na base de dados.
 */
export async function getInventoryOverview(
  input:
    | {
        threshold?: unknown
      }
    | undefined,
  client?: InventoryClient,
): Promise<InventoryOverview> {
  const query =
    inventoryOverviewQuerySchema.parse({
      threshold: input?.threshold,
    })

  const threshold =
    query.threshold

  const overviewClient =
    getClient(client)

  const {
    totalRaw,
    lowStockRaw,
    outOfStockRaw,
    rows,
  } =
    await overviewClient.$transaction(
      async (
        transaction,
      ) => {
        const totalRaw =
          await transaction.productVariant.count(
            {
              where: {
                isActive: true,
                product: {
                  isActive: true,
                },
              },
            },
          )

        const lowStockRaw =
          await transaction.productVariant.count(
            {
              where: {
                isActive: true,
                product: {
                  isActive: true,
                },
                stockQuantity: {
                  gte: 1,
                  lte: threshold,
                },
              },
            },
          )

        const outOfStockRaw =
          await transaction.productVariant.count(
            {
              where: {
                isActive: true,
                product: {
                  isActive: true,
                },
                stockQuantity: 0,
              },
            },
          )

        const rows =
          await transaction.productVariant.findMany(
            {
              where: {
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
              take: MAX_INVENTORY_ROWS,
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
          totalRaw,
          lowStockRaw,
          outOfStockRaw,
          rows,
        }
      },
    )

  return {
    threshold,
    kpis: {
      totalSkus: totalRaw,
      inStockCount: Math.max(
        0,
        totalRaw -
          lowStockRaw -
          outOfStockRaw,
      ),
      lowStockCount:
        lowStockRaw,
      outOfStockCount:
        outOfStockRaw,
    },
    variants: rows.map(
      (record) => ({
        ...toLowStockVariant(
          record,
        ),
        status:
          inventoryStatusFromStock(
            record.stockQuantity,
            threshold,
          ),
      }),
    ),
  }
}
