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
 *
 * Épico 6 (etapa 2): registo atómico de movimentos de stock
 * (RESTOCK / SALE / MANUAL_ADJUSTMENT / RETURN) em todos os caminhos de
 * escrita e histórico filtrável por tipo, SKU e intervalo de datas.
 */

export const DEFAULT_LOW_STOCK_THRESHOLD = 5

export const MAX_LOW_STOCK_THRESHOLD = 99

export const DEFAULT_LOW_STOCK_LIMIT = 20

export const MAX_LOW_STOCK_LIMIT = 100

export const MAX_STOCK_QUANTITY = 999999

/**
 * Épico 6 — registo histórico de movimentos de stock: cada alteração
 * de stock (reposição, venda, correção manual ou reposição por
 * cancelamento) é gravada DENTRO da transação que altera o stock,
 * garantindo que o histórico e o stock nunca divergem.
 */

/** Tipos de movimento de stock registados no histórico. */
export const STOCK_MOVEMENT_TYPES = [
  'RESTOCK',
  'SALE',
  'MANUAL_ADJUSTMENT',
  'RETURN',
] as const

export type StockMovementType =
  (typeof STOCK_MOVEMENT_TYPES)[number]

/**
 * Dados do movimento a registar: variante, tipo, faixa de stock
 * (anterior → novo) e referência do utilizador/admin que causou a
 * alteração (opcional — vendas do checkout atribuem o cliente,
 * alterações de serviços sem utilizador em contexto ficam a `null`).
 */
export type StockMovementRecordInput = {
  variantId: string
  type: StockMovementType
  quantityChange: number
  previousStock: number
  newStock: number
  actorUserId?: string | null
}

/** Forma do `where` combinado da listagem de movimentos. */
export type StockMovementFilterWhere = {
  type?: StockMovementType
  productVariant?: {
    sku: {
      contains: string
      mode: 'insensitive'
    }
  }
  createdAt?: {
    gte?: Date
    lte?: Date
  }
}

/** Espaço selecionado do histórico (movimento + variante + produto + ator). */
export type StockMovementSelect = {
  id: true
  type: true
  quantityChange: true
  previousStock: true
  newStock: true
  actorUserId: true
  createdAt: true
  productVariant: {
    select: {
      id: true
      sku: true
      product: {
        select: {
          id: true
          name: true
          slug: true
        }
      }
    }
  }
  actorUser: {
    select: {
      id: true
      email: true
    }
  }
}

/** Registo cru devolvido pela base de dados na listagem do histórico. */
export type RawStockMovementRecord = {
  id: string
  type: StockMovementType
  quantityChange: number
  previousStock: number
  newStock: number
  actorUserId: string | null
  createdAt: Date
  productVariant: {
    id: string
    sku: string
    product: {
      id: string
      name: string
      slug: string
    }
  }
  actorUser: {
    id: string
    email: string
  } | null
}

/** Delegates Prisma do histórico de movimentos. */
export type StockMovementDelegate = {
  create(args: {
    data: StockMovementRecordInput
  }): Promise<{ id: string }>

  count(args: {
    where: StockMovementFilterWhere
  }): Promise<number>

  findMany(args: {
    where: StockMovementFilterWhere
    orderBy: Array<
      | { createdAt: 'desc' }
      | { id: 'desc' }
    >
    skip: number
    take: number
    select: StockMovementSelect
  }): Promise<RawStockMovementRecord[]>
}

/** Linha apresentada no histórico de movimentos. */
export type StockMovementRow = {
  id: string
  variantId: string
  sku: string
  productId: string
  productName: string
  productSlug: string
  type: StockMovementType
  quantityChange: number
  previousStock: number
  newStock: number
  actorEmail: string | null
  createdAt: string
}

/**
 * Página do histórico: linhas + total filtrado + paginação já
 * normalizada (mínimo de 1 página, última página real como teto).
 */
export type StockMovementsPage = {
  movements: StockMovementRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

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
 * leituras da correção rápida, os contadores/listagem da vista completa
 * e o registo/consulta de movimentos de stock correm todos sobre o
 * mesmo cliente transacional.
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
  stockMovement: StockMovementDelegate
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
 * Épico 6 — gravação de um movimento de stock. Tem de ser chamada
 * DENTRO da transação que altera o stock: se o registo falhar, a
 * alteração de stock é revertida em conjunto nunca divergindo do
 * histórico. Não altera stock — cada caminho de escrita calcula o
 * antes/depois e chama esta função uma vez por variante alterada.
 */
export async function recordStockMovement(
  client: {
    stockMovement: {
      create(args: {
        data: StockMovementRecordInput
      }): Promise<{ id: string }>
    }
  },
  input: StockMovementRecordInput,
): Promise<void> {
  await client.stockMovement.create({
    data: {
      variantId: input.variantId,
      type: input.type,
      quantityChange:
        input.quantityChange,
      previousStock:
        input.previousStock,
      newStock: input.newStock,
      actorUserId:
        input.actorUserId ?? null,
    },
  })
}

/**
 * Correção rápida de stock: define o stock da variante para um valor
 * exato (não é um delta — o admin vê o valor novo na tabela). Devolve
 * o stock anterior e a variante atualizada; erro 404-like quando a
 * variante não existe, sem fazer update.
 *
 * Épico 6: a leitura do stock anterior e a escrita do novo valor correm
 * DENTRO da mesma transação atómica — duas correções concorrentes nunca
 * intercalam leitura/escrita de forma inconsistente. O movimento
 * `MANUAL_ADJUSTMENT` é registado na mesma transação (com a referência
 * do admin autenticado), exceto quando o stock não muda — evita
 * poluir o histórico com entradas sem efeito.
 */
export async function updateVariantStock(
  input:
    | {
        variantId: unknown
        stock: unknown
      }
    | undefined,
  client?: InventoryClient,
  actorUserId?: string | null,
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

      if (
        current.stockQuantity !==
        stock
      ) {
        await recordStockMovement(
          transaction,
          {
            variantId,
            type: 'MANUAL_ADJUSTMENT',
            quantityChange:
              stock -
              current.stockQuantity,
            previousStock:
              current.stockQuantity,
            newStock: stock,
            actorUserId:
              actorUserId ?? null,
          },
        )
      }

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

/**
 * Épico 6 — histórico de movimentos de stock.
 */

/** Página padrão do histórico de movimentos. */
export const DEFAULT_MOVEMENTS_PAGE_SIZE = 50

/** Teto de linhas por página (proteção do payload). */
export const MAX_MOVEMENTS_PAGE_SIZE = 100

const stockMovementDatePattern =
  /^\d{4}-\d{2}-\d{2}$/

const stockMovementDateMessage =
  'A data deve ter o formato AAAA-MM-DD'

const stockMovementDateSchema = z
  .string({
    message: stockMovementDateMessage,
  })
  .regex(stockMovementDatePattern, {
    message: stockMovementDateMessage,
  })
  .refine(
    (value) =>
      Number.isFinite(
        Date.parse(value),
      ),
    {
      message: stockMovementDateMessage,
    },
  )

function isEmptyQueryValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' &&
      value.trim() === '')
  )
}

/**
 * Query do histórico de movimentos — validação Zod: tipo de movimento,
 * fragmento de SKU (busca parcial, sem sensibilidade a maiúsculas) e
 * intervalo de datas em AAAA-MM-DD (limites inclusivos em UTC), com
 * paginação de 1 página em diante e `pageSize` limitado.
 */
export const stockMovementsQuerySchema =
  z
    .object({
      type: z.preprocess(
        (value) =>
          isEmptyQueryValue(value)
            ? undefined
            : value,
        z.enum(STOCK_MOVEMENT_TYPES, {
          message:
            'Tipo de movimento inválido',
        }).optional(),
      ),
      sku: z.preprocess(
        (value) =>
          isEmptyQueryValue(value)
            ? undefined
            : value,
        z
          .string({
            message:
              'O SKU deve ser texto',
          })
          .trim()
          .min(1, {
            message:
              'O SKU deve ser texto',
          })
          .max(120, {
            message:
              'O SKU não pode exceder 120 caracteres',
          })
          .optional(),
      ),
      from: z.preprocess(
        (value) =>
          isEmptyQueryValue(value)
            ? undefined
            : value,
        stockMovementDateSchema.optional(),
      ),
      to: z.preprocess(
        (value) =>
          isEmptyQueryValue(value)
            ? undefined
            : value,
        stockMovementDateSchema.optional(),
      ),
      page: z.preprocess(
        (value) =>
          isEmptyQueryValue(value)
            ? undefined
            : value,
        z.coerce
          .number({
            message:
              'A página deve ser um número inteiro',
          })
          .int({
            message:
              'A página deve ser um número inteiro',
          })
          .min(1, {
            message:
              'A página deve ser pelo menos 1',
          })
          .default(1),
      ),
      pageSize: z.preprocess(
        (value) =>
          isEmptyQueryValue(value)
            ? undefined
            : value,
        z.coerce
          .number({
            message:
              'O tamanho da página deve ser um número inteiro',
          })
          .int({
            message:
              'O tamanho da página deve ser um número inteiro',
          })
          .min(1, {
            message:
              'O tamanho da página deve estar entre 1 e ' +
              MAX_MOVEMENTS_PAGE_SIZE,
          })
          .max(MAX_MOVEMENTS_PAGE_SIZE, {
            message:
              'O tamanho da página deve estar entre 1 e ' +
              MAX_MOVEMENTS_PAGE_SIZE,
          })
          .default(DEFAULT_MOVEMENTS_PAGE_SIZE),
      ),
    })
    .refine(
      ({ from, to }) =>
        from === undefined ||
        to === undefined ||
        from <= to,
      {
        message:
          'A data inicial não pode ser posterior à data final',
        path: ['from'],
      },
    )

export type StockMovementsQueryOutput = z.infer<
  typeof stockMovementsQuerySchema
>

function startOfUtcDay(
  date: string,
): Date {
  return new Date(
    `${date}T00:00:00.000Z`,
  )
}

function endOfUtcDay(
  date: string,
): Date {
  return new Date(
    `${date}T23:59:59.999Z`,
  )
}

function toStockMovementRow(
  record: RawStockMovementRecord,
): StockMovementRow {
  return {
    id: record.id,
    variantId:
      record.productVariant.id,
    sku: record.productVariant.sku,
    productId:
      record.productVariant.product
        .id,
    productName:
      record.productVariant.product
        .name,
    productSlug:
      record.productVariant.product
        .slug,
    type: record.type,
    quantityChange:
      record.quantityChange,
    previousStock:
      record.previousStock,
    newStock: record.newStock,
    actorEmail:
      record.actorUser?.email ??
      null,
    createdAt:
      record.createdAt.toISOString(),
  }
}

/**
 * Histórico de movimentos de stock (Épico 6): paginação calculada a
 * partir do total filtrado (a última página real é o teto) e contagem
 * + listagem correndo na MESMA transação de leitura para refletirem um
 * snapshot coerente. O filtro de SKU é parcial e sem sensibilidade a
 * maiúsculas; as datas são limites inclusivos de dia em UTC.
 */
export async function listStockMovements(
  input:
    | {
        type?: unknown
        sku?: unknown
        from?: unknown
        to?: unknown
        page?: unknown
        pageSize?: unknown
      }
    | undefined,
  client?: InventoryClient,
): Promise<StockMovementsPage> {
  const query =
    stockMovementsQuerySchema.parse({
      type: input?.type,
      sku: input?.sku,
      from: input?.from,
      to: input?.to,
      page: input?.page,
      pageSize: input?.pageSize,
    })

  const where: StockMovementFilterWhere =
    {}

  if (query.type) {
    where.type = query.type
  }

  if (query.sku) {
    where.productVariant = {
      sku: {
        contains: query.sku,
        mode: 'insensitive',
      },
    }
  }

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from
        ? {
            gte:
              startOfUtcDay(
                query.from,
              ),
          }
        : {}),
      ...(query.to
        ? {
            lte: endOfUtcDay(
              query.to,
            ),
          }
        : {}),
    }
  }

  const movementClient =
    getClient(client)

  const { total, page, rows } =
    await movementClient.$transaction(
      async (transaction) => {
        const total =
          await transaction.stockMovement.count(
            {
              where,
            },
          )

        // A última página real é o teto: pedidos além do fim devolvem
        // a última página em vez de uma página vazia.
        const clampedTotalPages =
          Math.max(
            1,
            Math.ceil(
              total / query.pageSize,
            ),
          )
        const page = Math.min(
          query.page,
          clampedTotalPages,
        )

        const rows =
          await transaction.stockMovement.findMany(
            {
              where,
              orderBy: [
                {
                  createdAt:
                    'desc',
                },
                { id: 'desc' },
              ],
              skip:
                (page - 1) *
                query.pageSize,
              take: query.pageSize,
              select: {
                id: true,
                type: true,
                quantityChange: true,
                previousStock: true,
                newStock: true,
                actorUserId: true,
                createdAt: true,
                productVariant: {
                  select: {
                    id: true,
                    sku: true,
                    product: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                },
                actorUser: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
          )

        return {
          total,
          page,
          rows,
        }
      },
    )

  return {
    movements: rows.map(
      (record) =>
        toStockMovementRow(
          record,
        ),
    ),
    total,
    page,
    pageSize: query.pageSize,
    totalPages: Math.max(
      1,
      Math.ceil(total / query.pageSize),
    ),
  }
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
