import { toSlug } from '@/lib/slug'
import { prisma } from './db'
import type {
  ImportCommitResult,
  ImportField,
  ImportMode,
  ImportPreview,
  ImportProfile,
  ImportRowError,
  ImportWarning,
  ProductRowInput,
} from './catalog-import-types'
import {
  buildImportPreview,
  buildRowInputs,
  buildVariantCombinationKey,
} from './catalog-import-engine'
import {
  FIELD_TO_OPTION_CODE,
  type FailureMode,
  type SkuStrategy,
} from '@/lib/catalog-import'
import {
  normalizeFinishKey,
} from '@/lib/product-images'
import {
  appendSkuSuffix,
  collisionSuffix,
} from '@/lib/sku-generator'
import {
  findFinishValueId,
  normalizeWheelSelectionValue,
} from './admin-products'
import type {
  Prisma,
  PrismaClient,
} from '@prisma/client'

type ImportTransaction = Prisma.TransactionClient

/**
 * Erro de produção de campo obrigatório: uma linha passou a
 * validação mas o importador não conseguiu produzir um valor
 * NOT NULL exigido pelo modelo ProductVariant (SKU, preço,
 * stock, relação com o produto...). A mensagem é útil para o
 * admin; o erro técnico original fica nos logs do servidor.
 */
class ImportFieldProductionError extends Error {
  readonly rowNumber: number
  readonly sku: string

  constructor(message: string, rowNumber: number, sku: string) {
    super(message)
    this.name = 'ImportFieldProductionError'
    this.rowNumber = rowNumber
    this.sku = sku
  }
}

/** Rótulo legível da variante: "FF-ONE — variante 20x8.5 5x112 ET45 GlossyBlack". */
function formatVariantLabel(
  group: {
    productName: string
  },
  variant: Pick<ProductRowInput, 'selections' | 'rowNumber'>,
): string {
  const specOrder = [
    'diameter',
    'width',
    'pcd',
    'offset',
    'centreBore',
    'finish',
    'frontDropMm',
    'rearDropMm',
  ] as const

  const specs = specOrder
    .map((field) => variant.selections[field])
    .filter(Boolean)
    .join(' ')

  return specs
    ? `${group.productName} — variante ${specs} (linha ${variant.rowNumber})`
    : `${group.productName} (linha ${variant.rowNumber})`
}

/**
 * Barreira defensiva ANTES de qualquer escrita na base de dados:
 * valida que o importador consegue produzir TODOS os campos
 * NOT NULL do modelo ProductVariant. Nada disto depende de
 * dados externos — productId já está resolvido dentro da
 * transação; o resto vem do motor de linhas. Falhar aqui dá
 * ao admin um erro por linha em vez de um erro críptico do
 * Prisma dentro da transação.
 */
function assertVariantFieldsProduced(
  group: { productCode: string; productName: string },
  variant: ProductRowInput,
): void {
  const label = formatVariantLabel(group, variant)

  const fail = (field: string) => {
    throw new ImportFieldProductionError(
      `${label}: campo obrigatório '${field}' não foi produzido pelo importador.`,
      variant.rowNumber,
      variant.sku,
    )
  }

  // productId é resolvido na própria transação: se chegar aqui
  // vazio, o produto pai não foi criado/encontrado.
  if (!group.productCode) fail('productId (código do produto)')
  if (!variant.sku) fail('sku')
  if (typeof variant.price !== 'number' || !Number.isFinite(variant.price)) {
    fail('price')
  }
  if (!Number.isInteger(variant.stock) || variant.stock < 0) {
    fail('stockQuantity')
  }
  if (typeof variant.isActive !== 'boolean') fail('isActive')
  // optionKey é derivado de productCode + SKU final; se nenhum
  // dos dois produzir slug, a chave interna sairia vazia.
  if (!`${toSlug(group.productCode)}${toSlug(variant.sku)}`.trim()) {
    fail('optionKey')
  }
}

/**
 * Identidade de uma variante já existente, usada para decidir se
 * um SKU é A MESMA variante (update) ou uma COLISÃO (outra
 * variante): produto + especificações canónicas.
 */
async function loadVariantIdentityBySku(
  db: Pick<PrismaClient, 'productVariant'>,
  skus: string[],
) {
  if (skus.length === 0) {
    return new Map()
  }

  const variants = await db.productVariant.findMany(
    {
      where: { sku: { in: skus } },
      select: {
        id: true,
        sku: true,
        productId: true,
        product: {
          select: { sku: true },
        },
        selections: {
          select: {
            optionValue: {
              select: {
                value: true,
                option: {
                  select: { code: true },
                },
              },
            },
          },
        },
      },
    },
  )

  const identityBySku = new Map()

  for (const variant of variants) {
    const selections: Record<string, string> = {}

    for (const selection of variant.selections) {
      selections[
        selection.optionValue.option.code
      ] = selection.optionValue.value
    }

    identityBySku.set(variant.sku, {
      sku: variant.sku,
      productCode: variant.product.sku,
      combinationKey:
        buildVariantCombinationKey(selections),
      productId: variant.productId,
      id: variant.id,
    })
  }

  return identityBySku
}

/**
 * O mesmo, indexado por referência do fornecedor
 * (ProductVariant.supplierSku).
 */
async function loadVariantIdentityBySupplierSku(
  db: Pick<PrismaClient, 'productVariant'>,
  supplierSkus: string[],
) {
  if (supplierSkus.length === 0) {
    return new Map()
  }

  const variants = await db.productVariant.findMany(
    {
      where: {
        supplierSku: { in: supplierSkus },
      },
      select: {
        id: true,
        sku: true,
        productId: true,
        supplierSku: true,
        product: {
          select: { sku: true },
        },
        selections: {
          select: {
            optionValue: {
              select: {
                value: true,
                option: {
                  select: { code: true },
                },
              },
            },
          },
        },
      },
    },
  )

  const identityBySupplierSku = new Map()

  for (const variant of variants) {
    if (!variant.supplierSku) {
      continue
    }

    const selections: Record<string, string> = {}

    for (const selection of variant.selections) {
      selections[
        selection.optionValue.option.code
      ] = selection.optionValue.value
    }

    identityBySupplierSku.set(
      variant.supplierSku,
      {
        sku: variant.sku,
        productCode: variant.product.sku,
        combinationKey:
          buildVariantCombinationKey(selections),
        productId: variant.productId,
        id: variant.id,
      },
    )
  }

  return identityBySupplierSku
}

/** Limite de linhas por ficheiro: protege o servidor. */
const MAX_IMPORT_ROWS = 5000

const PROFILE_TO_SLUG_HINTS: Record<
  ImportProfile,
  string[]
> = {
  wheels: ['jante', 'jantes', 'wheel', 'wheels'],
  suspension: [
    'suspens',
    'mola',
    'coilover',
    'spring',
  ],
  exterior: ['exterior', 'body'],
  generic: [],
}

function inferProfileFromCategory(
  categoryName: string,
): ImportProfile {
  const value = categoryName
    .toLocaleLowerCase('pt-PT')

  for (const [
    profile,
    hints,
  ] of Object.entries(
    PROFILE_TO_SLUG_HINTS,
  ) as Array<[ImportProfile, string[]]>) {
    if (
      hints.some((hint) =>
        value.includes(hint),
      )
    ) {
      return profile
    }
  }

  return 'generic'
}

export type ParsedImportFile = {
  headers: string[]
  rows: Array<Record<string, string>>
}

/**
 * Etapa 2: constrói o mapeamento e a pré-visualização completa com
 * dados REAIS da base de dados (SKUs e códigos conhecidos). Não
 * escreve nada.
 */
export async function previewCatalogImport({
  fileText,
  fileName,
  mapping,
  profile,
  mode,
  skuStrategy,
  skuOverrides,
  client,
}: {
  fileText: string
  fileName: string
  mapping?: Partial<Record<ImportField, string>>
  profile?: ImportProfile
  mode: ImportMode
  skuStrategy?: SkuStrategy
  skuOverrides?: Record<number, string>
  client?: PrismaClient
}): Promise<
  | ImportPreview
  | { error: string }
> {
  const db = client ?? prisma

  const { parseCsv, detectColumnMapping } =
    await import('@/lib/catalog-import')

  const parsedCsv = parseCsv(fileText)

  if (parsedCsv.rows.length === 0) {
    return {
      error:
        'O ficheiro não contém linhas de dados.',
    }
  }

  if (
    parsedCsv.rows.length > MAX_IMPORT_ROWS
  ) {
    return {
      error: `O ficheiro tem ${parsedCsv.rows.length} linhas; o limite é ${MAX_IMPORT_ROWS}. Divide o ficheiro.`,
    }
  }

  const detected =
    mapping ??
    detectColumnMapping(
      parsedCsv.headers,
    ).mapping

  const sampleRow = parsedCsv.rows[0]
  const brandValue = mapping?.brand
    ? (sampleRow[mapping.brand] ?? '')
    : ''

  const effectiveProfile =
    profile ??
    inferProfileFromCategory(
      (mapping?.category
        ? (sampleRow[mapping.category] ?? '')
        : '') || brandValue || fileName,
    )

  const effectiveSkuStrategy =
    skuStrategy ?? 'auto'

  // Códigos de produto já conhecidos na BD para
  // classificar create vs update do PRODUTO.
  const productCodes = new Set<string>()

  for (const row of parsedCsv.rows) {
    const code = (
      detected.productCode
        ? (row[detected.productCode] ?? '')
        : ''
    ).trim()

    if (code) {
      productCodes.add(code)
    }
  }

  const existingProducts =
    productCodes.size > 0
      ? await db.product.findMany({
          where: {
            sku: {
              in: [...productCodes],
            },
          },
          select: { sku: true },
        })
      : []

  // O código de produto é guardado no SKU do produto
  // quando o admin não define outro.
  const existingProductCodes = new Set(
    existingProducts.map(
      (product) => product.sku,
    ),
  )

  // Primeiro parse (seleções cruas) para calcular os SKUs
  // que o ficheiro/generator vão usar e carregar as suas
  // identidades da BD (SKU interno e supplierSku).
  const parsed = buildRowInputs({
    rows: parsedCsv.rows,
    mapping: detected,
    categoryProfile: effectiveProfile,
    skuStrategy: effectiveSkuStrategy,
    skuOverrides,
  })

  const skus = new Set<string>()
  const supplierSkus = new Set<string>()

  for (const group of parsed.products) {
    for (const variant of group.variants) {
      if (variant.sku) {
        skus.add(variant.sku)
      }

      if (variant.supplierSku) {
        supplierSkus.add(
          variant.supplierSku,
        )
      }
    }
  }

  // Identidade por SKU interno E por supplierSku —
  // as duas chaves de matching.
  const [identityBySku, identityBySupplierSku] =
    await Promise.all([
      loadVariantIdentityBySku(
        db,
        [...skus],
      ),
      loadVariantIdentityBySupplierSku(
        db,
        [...supplierSkus],
      ),
    ])

  return buildImportPreview({
    parsed,
    profile: effectiveProfile,
    mode,
    existingProductCodes,
    dbVariantsBySku: identityBySku,
    dbVariantsBySupplierSku:
      identityBySupplierSku,
    skuStrategy: effectiveSkuStrategy,
  })
}

export type CommitCatalogImportInput = {
  fileText: string
  fileName: string
  /**
   * Mapeamento campo → coluna. Quando omitido, o mapeamento é
   * detetado automaticamente pelos cabeçalhos do ficheiro.
   */
  mapping?: Partial<Record<ImportField, string>>
  profile: ImportProfile
  mode: ImportMode
  /**
   * "abort" (por defeito): qualquer produto com erro aborta o
   * import inteiro. "partial": o admin escolheu explicitamente
   * importar os produtos válidos.
   */
  failureMode?: FailureMode
  skuStrategy?: SkuStrategy
  skuOverrides?: Record<number, string>
  createdBy?: string
  client?: PrismaClient
}

/**
 * Etapa 4: importa a sério. Cada produto é importado numa
 * transação própria — um produto a falhar não rebenta os outros
 * (import parcial documentado no histórico), e nenhum produto
 * existente é apagado por estar ausente do ficheiro.
 */
export async function commitCatalogImport({
  fileText,
  fileName,
  mapping,
  profile,
  mode,
  failureMode,
  skuStrategy,
  skuOverrides,
  createdBy,
  client,
}: CommitCatalogImportInput): Promise<
  ImportCommitResult | { error: string }
> {
  const db = client ?? prisma
  const effectiveFailureMode =
    failureMode ?? 'abort'
  const effectiveSkuStrategy =
    skuStrategy ?? 'auto'

  const { parseCsv, detectColumnMapping } =
    await import('@/lib/catalog-import')

  const parsedCsv = parseCsv(fileText)

  if (parsedCsv.rows.length === 0) {
    await recordFailedImport(db, {
      fileName,
      mode,
      failureMode: effectiveFailureMode,
      errorCount: 0,
      errors: [],
      warnings: [],
    })

    return {
      error:
        'O ficheiro não contém linhas de dados.',
    }
  }

  const effectiveMapping =
    mapping ??
    detectColumnMapping(
      parsedCsv.headers,
    ).mapping

  const parsed = buildRowInputs({
    rows: parsedCsv.rows,
    mapping: effectiveMapping,
    categoryProfile: profile,
    skuStrategy: effectiveSkuStrategy,
    skuOverrides,
  })

  // Nada é importado se houver erros de linha:
  // não se escrevem dados inválidos em silêncio.
  if (parsed.errors.length > 0) {
    await recordFailedImport(db, {
      fileName,
      mode,
      failureMode: effectiveFailureMode,
      errorCount: parsed.errors.length,
      errors: parsed.errors,
      warnings: parsed.warnings,
    })

    return {
      error: `O ficheiro tem ${parsed.errors.length} linha(s) inválida(s). Corrige e volta a importar.`,
    }
  }

  const importRecord =
    await db.productImport.create({
      data: {
        fileName,
        mode,
        failureMode: effectiveFailureMode,
        status: 'started',
        createdBy: createdBy ?? null,
      },
      select: { id: true },
    })

  let createdProducts = 0
  let updatedProducts = 0
  let createdVariants = 0
  let updatedVariants = 0
  let generatedSkus = 0
  let resolvedCollisions = 0
  let createdImages = 0
  let matchedImages = 0
  const errors: Array<{
    product: string
    message: string
    /** Presentes quando se sabe a linha exata (erro de produção). */
    row?: number
    sku?: string
  }> = []

  /**
   * Erros técnicos (Prisma, restrições, etc.) vão para os logs
   * do servidor com contexto; o admin recebe apenas a mensagem
   * útil por produto.
   */
  const logProductError = (
    group: { productCode: string; productName: string },
    error: unknown,
  ) => {
    console.error(
      `[catalog-import] falha ao importar produto "${group.productCode}" (${group.productName}):`,
      error,
    )
  }

  /** Auditoria: o que este import alterou, por produto. */
  const changes: Array<{
    productCode: string
    productName: string
    createdProduct: boolean
    createdVariants: Array<{
      sku: string
      supplierSku: string | null
    }>
    updatedVariants: Array<{ sku: string }>
  }> = []

  for (const group of parsed.products) {
    try {
      const result = await db.$transaction(
        async (transaction) =>
          upsertImportedProduct({
            transaction,
            group,
            profile,
            mode,
            skuStrategy: effectiveSkuStrategy,
          }),
      )

      createdProducts +=
        result.createdProduct
      updatedProducts +=
        result.updatedProduct
      createdVariants +=
        result.createdVariants
      updatedVariants +=
        result.updatedVariants
      generatedSkus += result.generatedSkus
      resolvedCollisions +=
        result.resolvedCollisions
      createdImages += result.createdImages
      matchedImages += result.matchedImages

      changes.push({
        productCode: group.productCode,
        productName: group.productName,
        createdProduct:
          result.createdProduct === 1,
        createdVariants:
          result.createdVariantSkus,
        updatedVariants:
          result.updatedVariantSkus,
      })
    } catch (error) {
      if (!(error instanceof ImportFieldProductionError)) {
        logProductError(group, error)
      }

      errors.push({
        product: group.productName,
        message:
          error instanceof Error
            ? error.message
            : 'Erro desconhecido.',

        // Referência útil da linha para a UI: erros de
        // produção trazem rowNumber e SKU da variante exata
        // que falhou (nunca desalinhados por serem do MESMO
        // objeto de erro).
        ...(error instanceof ImportFieldProductionError
          ? { row: error.rowNumber, sku: error.sku }
          : {}),
      })

      // Modo "abort": o primeiro produto que falha aborta o
      // import INTEIRO — nada fica a meio (transações por
      // produto garantem que o que já entrou, entra limpo;
      // nada mais é escrito a partir daqui).
      if (effectiveFailureMode === 'abort') {
        break
      }
    }
  }

  const status =
    errors.length === 0
      ? 'success'
      : createdProducts +
          updatedProducts >
        0
        ? 'partial'
        : 'failed'

  const appliedChanges =
    changes as unknown as Prisma.InputJsonValue

  await db.productImport.update({
    where: { id: importRecord.id },
    data: {
      status,
      finishedAt: new Date(),
      createdProducts,
      updatedProducts,
      createdVariants,
      updatedVariants,
      createdImages,
      matchedImages,
      errorCount: errors.length,
      errors: errors as unknown as Prisma.InputJsonValue,
      warnings:
        parsed.warnings as unknown as Prisma.InputJsonValue,
      changes: appliedChanges,
    },
  })

  return {
    id: importRecord.id,
    status,
    createdProducts,
    updatedProducts,
    createdVariants,
    updatedVariants,
    generatedSkus,
    collisions: resolvedCollisions,
    errorCount: errors.length,
    createdImages,
    matchedImages,
    errors: errors.map((entry) => ({
      row: entry.row ?? 0,
      sku: entry.sku ?? entry.product,
      message: entry.message,
    })),
    warnings: parsed.warnings,
  }
}

/**
 * Registo de histórico para tentativas rejeitadas (ficheiro vazio
 * ou com linhas inválidas): nada foi escrito, mas a tentativa fica
 * documentada. Um histórico indisponível nunca bloqueia a resposta
 * de validação.
 */
async function recordFailedImport(
  db: Pick<PrismaClient, 'productImport'>,
  data: {
    fileName: string
    mode: ImportMode
    failureMode: FailureMode
    errorCount: number
    errors: ImportRowError[]
    warnings: ImportWarning[]
  },
) {
  try {
    await db.productImport.create({
      data: {
        fileName: data.fileName,
        mode: data.mode,
        failureMode: data.failureMode,
        status: 'failed',
        finishedAt: new Date(),
        errorCount: data.errorCount,
        errors:
          data.errors as unknown as Prisma.InputJsonValue,
        warnings:
          data.warnings as unknown as Prisma.InputJsonValue,
      },
    })
  } catch {
    // O histórico não pode impedir a resposta de validação.
  }
}

async function upsertImportedProduct({
  transaction,
  group,
  profile,
  mode,
  skuStrategy,
}: {
  transaction: ImportTransaction
  group: Awaited<
    ReturnType<typeof buildRowInputs>
  >['products'][number]
  profile: ImportProfile
  mode: ImportMode
  skuStrategy: SkuStrategy
}): Promise<{
  createdProduct: number
  updatedProduct: number
  createdVariants: number
  updatedVariants: number
  generatedSkus: number
  resolvedCollisions: number
  createdVariantSkus: Array<{
    sku: string
    supplierSku: string | null
  }>
  updatedVariantSkus: Array<{ sku: string }>
  createdImages: number
  matchedImages: number
}> {
  // O produto é identificado pelo productCode, guardado no SKU do
  // produto (o identificador estável do modelo).
  const productSku = group.productCode

  const existing =
    await transaction.product.findUnique({
      where: { sku: productSku },
      select: { id: true },
    })

  const category = await findOrCreateCategory(
    transaction,
    group.category,
  )

  const brand = group.brand
    ? await findOrCreateBrand(
        transaction,
        group.brand,
      )
    : null

  const product = existing
    ? await transaction.product.update({
        where: { id: existing.id },
        data: {
          name: group.productName,
          categoryId: category.id,
          productBrandId: brand?.id ?? null,
          // Descrição só é criada; nunca substituída
          // por valor vazio de um reimport.
          ...(group.description
            ? { description: group.description }
            : {}),
        },
        select: { id: true },
      })
    : await transaction.product.create({
        data: {
          name: group.productName,
          sku: productSku,
          slug: await createAvailableSlug(
            transaction,
            group.productName,
          ),
          images: [],
          categoryId: category.id,
          productBrandId: brand?.id ?? null,
          description:
            group.description || null,
          isActive: true,
          shippingClass: 'STANDARD',
        },
        select: { id: true },
      })

  const finishValueIds =
    await upsertImportedOptions(
      transaction,
      product.id,
      profile,
      group,
    )

  const variantResult =
    await upsertImportedVariants({
      transaction,
      productId: product.id,
      productCode: group.productCode,
      productName: group.productName,
      variants: group.variants,
      mode,
      skuStrategy,
    })

  // O stock de listagem é avaliado diretamente nas variantes
  // (basta uma variante ativa com stock); o Product já não
  // guarda um resumo de stock.

  const imageResult = await upsertImportedImages(
    transaction,
    product.id,
    group,
    profile,
    finishValueIds,
  )

  await upsertImportedCompatibilities(
    transaction,
    product.id,
    profile,
    group.compatibilities,
  )

  return {
    createdProduct: existing ? 0 : 1,
    updatedProduct: existing ? 1 : 0,
    ...variantResult,
    createdImages: imageResult.createdImages,
    matchedImages: imageResult.matchedImages,
  }
}

/**
 * Garante que o SKU a criar está livre na BD: se pertencer a uma
 * variante DIFERENTE (colisão de SKU gerado/do fornecedor), anexa
 * um sufixo determinístico único. SKUs manuais/override nunca são
 * reescritos — colidem com erro explícito.
 */
async function ensureUniqueSku(
  transaction: ImportTransaction,
  desiredSku: string,
  identity: {
    groupKey: string
    combinationKey: string
  },
  options: {
    allowSuffix: boolean
    reserved?: Set<string>
  },
): Promise<{
  sku: string
  collision: boolean
}> {
  const taken = async (sku: string) => {
    if (options.reserved?.has(sku)) {
      return true
    }

    const conflict =
      await transaction.productVariant.findFirst({
        where: { sku },
        select: { id: true },
      })

    return Boolean(conflict)
  }

  if (!(await taken(desiredSku))) {
    return {
      sku: desiredSku,
      collision: false,
    }
  }

  if (!options.allowSuffix) {
    throw new Error(
      `Já existe uma variante com o SKU ${desiredSku}`,
    )
  }

  const suffix = collisionSuffix(
    desiredSku,
    `${identity.groupKey}\u0000${identity.combinationKey}`,
  )

  let candidate = appendSkuSuffix(
    desiredSku,
    suffix,
  )

  let attempt = 2

  while (await taken(candidate)) {
    candidate = appendSkuSuffix(
      candidate,
      `${attempt}`,
    )
    attempt += 1
  }

  return { sku: candidate, collision: true }
}

async function findOrCreateCategory(
  transaction: ImportTransaction,
  name: string,
) {
  const existing =
    await transaction.category.findFirst({
      where: {
        OR: [
          { name },
          { slug: toSlug(name) },
        ],
      },
      select: { id: true, slug: true },
    })

  if (existing) {
    return existing
  }

  return transaction.category.create({
    data: {
      name,
      slug: await uniqueCategorySlug(
        transaction,
        toSlug(name) || 'importados',
      ),
    },
    select: { id: true, slug: true },
  })
}

async function uniqueCategorySlug(
  transaction: ImportTransaction,
  base: string,
) {
  let candidate = base
  let suffix = 2

  while (
    await transaction.category.findFirst({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

async function findOrCreateBrand(
  transaction: ImportTransaction,
  name: string,
) {
  const existing =
    await transaction.productBrand.findUnique({
      where: { name },
      select: { id: true },
    })

  if (existing) {
    return existing
  }

  const slug = toSlug(name)

  const bySlug =
    await transaction.productBrand.findUnique({
      where: { slug },
      select: { id: true },
    })

  if (bySlug) {
    return bySlug
  }

  return transaction.productBrand.create({
    data: { name, slug },
    select: { id: true },
  })
}

async function createAvailableSlug(
  transaction: ImportTransaction,
  name: string,
) {
  const base = (toSlug(name) || 'produto').slice(
    0,
    200,
  )
  let candidate = base
  let suffix = 2

  while (
    await transaction.product.findFirst({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

/**
 * Os valores chegam em formato cru do fornecedor ("19", "8,5J",
 * "ET30", "66,6"); converte-os para o formato canónico da loja
 * (19", 8.5J, ET30, 66.6 mm), igual ao editor manual de produtos.
 */
function toOptionSelections(
  selections: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {}

  for (const [field, value] of Object.entries(
    selections,
  )) {
    const code = FIELD_TO_OPTION_CODE[field] ?? field

    normalized[code] = normalizeWheelSelectionValue(
      code,
      value,
    )
  }

  return normalized
}

/**
 * Cria/atualiza os eixos de opções e devolve o mapa
 * finish → ProductOptionValue.id das variantes deste produto.
 */
async function upsertImportedOptions(
  transaction: ImportTransaction,
  productId: string,
  profile: ImportProfile,
  group: Awaited<
    ReturnType<typeof buildRowInputs>
  >['products'][number],
) {
  const finishValueIds = new Map<
    string,
    string
  >()

  const axes: Array<{
    code: string
    name: string
    field: ImportField
  }> =
    profile === 'wheels'
      ? [
          {
            code: 'diameter',
            name: 'Diâmetro',
            field: 'diameter',
          },
          {
            code: 'width',
            name: 'Largura',
            field: 'width',
          },
          {
            code: 'pcd',
            name: 'Padrão de parafusos',
            field: 'pcd',
          },
          {
            code: 'offset',
            name: 'Offset (ET)',
            field: 'offset',
          },
          {
            code: 'centre_bore',
            name: 'Furo central',
            field: 'centreBore',
          },
          {
            code: 'finish',
            name: 'Acabamento',
            field: 'finish',
          },
        ]
      : profile === 'suspension'
        ? [
            {
              code: 'front_drop_mm',
              name: 'Rebaixo dianteiro',
              field: 'frontDropMm',
            },
            {
              code: 'rear_drop_mm',
              name: 'Rebaixo traseiro',
              field: 'rearDropMm',
            },
          ]
        : profile === 'exterior'
          ? [
              {
                // "TipoProduto" do CSV (Splitter frontal,
                // Saias laterais, Spoiler Cap): eixo de
                // escolha único por produto exterior.
                code: 'productType',
                name: 'Tipo de produto',
                field: 'productType',
              },
            ]
          : []

  const optionByCode = new Map<
    string,
    string
  >()

  for (const [
    position,
    axis,
  ] of axes.entries()) {
    const values = new Set<string>()

    for (const variant of group.variants) {
      // Mesma conversão campo→código + normalização usada nas
      // variantes, para valores e seleções ficarem coerentes.
      const selections = toOptionSelections(
        variant.selections,
      )

      const value = selections[axis.code]

      if (value) {
        values.add(value)
      }
    }

    if (values.size === 0) {
      continue
    }

    // find→create/update em vez de upsert: o upsert do Prisma
    // lançou P2025 ("No record was found") em reimport de produto
    // existente mesmo com @@unique([productId, code]) correto —
    // sem depender desse caminho, o fluxo nunca falha aqui.
    const existingOption =
      await transaction.productOption.findUnique({
        where: {
          productId_code: {
            productId,
            code: axis.code,
          },
        },
        select: { id: true },
      })

    const option = existingOption
      ? await transaction.productOption.update({
          where: { id: existingOption.id },
          data: {
            name: axis.name,
            position,
          },
          select: { id: true },
        })
      : await transaction.productOption.create({
          data: {
            productId,
            code: axis.code,
            name: axis.name,
            position,
          },
          select: { id: true },
        })

    optionByCode.set(axis.code, option.id)

    let valuePosition = 0

    for (const value of values) {
      const existingValue =
        await transaction.productOptionValue.findUnique(
          {
            where: {
              optionId_value: {
                optionId: option.id,
                value,
              },
            },
            select: { id: true },
          },
        )

      const optionValue = existingValue
        ? existingValue
        : await transaction.productOptionValue.create(
            {
              data: {
                optionId: option.id,
                value,
                position: valuePosition,
              },
              select: { id: true },
            },
          )

      valuePosition += 1

      if (axis.code === 'finish') {
        finishValueIds.set(value, optionValue.id)
      }
    }
  }

  return finishValueIds
}

async function upsertImportedVariants({
  transaction,
  productId,
  productCode,
  productName,
  variants,
  mode,
  skuStrategy,
}: {
  transaction: ImportTransaction
  productId: string
  productCode: string
  productName: string
  variants: ProductRowInput[]
  mode: ImportMode
  skuStrategy: SkuStrategy
}): Promise<{
  createdVariants: number
  updatedVariants: number
  generatedSkus: number
  resolvedCollisions: number
  createdVariantSkus: Array<{
    sku: string
    supplierSku: string | null
  }>
  updatedVariantSkus: Array<{ sku: string }>
}> {
  let createdVariants = 0
  let updatedVariants = 0
  let generatedSkus = 0
  let resolvedCollisions = 0
  const createdVariantSkus: Array<{
    sku: string
    supplierSku: string | null
  }> = []
  const updatedVariantSkus: Array<{
    sku: string
  }> = []

  /**
   * SKUs gerados/atualizados NESTE import: garante que duas
   * linhas do mesmo ficheiro não escolhem o mesmo SKU.
   */
  const reserved = new Set<string>()

  const skus = variants.map(
    (variant) => variant.sku,
  )

  // Barreira de produção ANTES de qualquer escrita: todas as
  // variantes do grupo têm de ter os campos NOT NULL produzidos
  // (productId implícito, SKU, preço, stock, optionKey). Falhar
  // aqui dá um erro por linha ao admin, não um erro críptico do
  // Prisma a meio da transação.
  for (const variant of variants) {
    assertVariantFieldsProduced(
      { productCode, productName },
      variant,
    )
  }

  const existingVariants =
    await transaction.productVariant.findMany({
      where: {
        productId,
        sku: { in: skus },
      },
      select: {
        id: true,
        sku: true,
        optionKey: true,
        selections: {
          select: {
            optionValue: {
              select: {
                value: true,
                option: {
                  select: { code: true },
                },
              },
            },
          },
        },
      },
    })

  const existingBySku = new Map<
    string,
    {
      id: string
      sku: string
      optionKey: string
    }
  >(
    existingVariants.map((variant) => [
      variant.sku,
      {
        id: variant.id,
        sku: variant.sku,
        optionKey: variant.optionKey,
      },
    ]),
  )

  // Variantes geridas por import: as que este ficheiro
  // traz, por SKU.
  for (const [
    position,
    variant,
  ] of variants.entries()) {
    // Campos de seleção em código de opção canónico e valores
    // normalizados (19", 8.5J, ET30, 66.6 mm).
    const selections = toOptionSelections(
      variant.selections,
    )

    // Identidade canónica da variante: mesmo critério do
    // preview — produto + especificações. Um SKU gerado só
    // "bate certo" se as especificações coincidirem.
    const combinationKey =
      buildVariantCombinationKey(selections)

    // 1) SKU interno já é ESTA variante → reimport (update).
    // 2) Senão, referência do fornecedor identifica ESTA
    //    variante → reimport: mantém o SKU interno estável
    //    e atualiza a referência.
    // 3) Senão, cria com SKU único (sufixo se necessário).
    let existing = existingBySku.get(variant.sku)

    if (
      !existing &&
      variant.supplierSku
    ) {
      const bySupplier =
        await transaction.productVariant.findFirst(
          {
            where: {
              productId,
              supplierSku: variant.supplierSku,
            },
            select: {
              id: true,
              sku: true,
              optionKey: true,
            },
          },
        )

      if (bySupplier) {
        existing = bySupplier
      }
    }

    if (existing && mode === 'create-only') {
      continue
    }

    if (existing) {
      try {
        await transaction.productVariant.update({
          where: { id: existing.id },
          data: {
            price: variant.price,
            priceSet: variant.priceSet,
            stockQuantity: variant.stock,
            isActive: variant.isActive,
            position,
            // A referência do fornecedor fica em dia quando o
            // ficheiro a traz; nunca é apagada por omissão.
            // O SKU interno NUNCA é regenerado aqui.
            ...(variant.supplierSku
              ? { supplierSku: variant.supplierSku }
              : {}),
          },
        })
      } catch (error) {
        if (
          error instanceof ImportFieldProductionError
        ) {
          throw error
        }

        console.error(
          `[catalog-import] erro técnico ao atualizar variante "${existing.sku}" (linha ${variant.rowNumber}):`,
          error,
        )

        throw new ImportFieldProductionError(
          `${formatVariantLabel({ productName }, variant)}: erro inesperado da base de dados ao atualizar a variante (ver logs do servidor).`,
          variant.rowNumber,
          existing.sku,
        )
      }

      updatedVariants += 1
      updatedVariantSkus.push({
        sku: existing.sku,
      })

      // Especificações relevantes (suspensão).
      if (
        variant.specifications.length > 0
      ) {
        await transaction.productVariantSpecification.deleteMany(
          {
            where: { variantId: existing.id },
          },
        )

        for (const specification of
          variant.specifications) {
          await transaction.productVariantSpecification.create(
            {
              data: {
                variantId: existing.id,
                key: specification.key,
                label: specification.label,
                value: specification.value,
                unit: specification.unit,
                position:
                  specification.position,
              },
            },
          )
        }
      }

      continue
    }

    // Variante NOVA: resolve o SKU final. SKUs gerados/do
    // fornecedor podem levar sufixo único em colisão; SKUs
    // de override manual não são reescritos — falham.
    const allowSuffix =
      skuStrategy !== 'custom' ||
      variant.skuGenerated

    const { sku: finalSku, collision } =
      await ensureUniqueSku(
        transaction,
        variant.sku,
        {
          groupKey: productCode,
          combinationKey,
        },
        { allowSuffix, reserved },
      )

    reserved.add(finalSku)

    if (collision) {
      resolvedCollisions += 1
    }

    if (variant.skuGenerated) {
      generatedSkus += 1
    }

    const optionKey =
      `${toSlug(productCode)}-${toSlug(finalSku)}`.slice(
        0,
        220,
      )

    // `images` é String[] NOT NULL sem default na base de
    // dados: tem de vir SEMPRE explícito (o editor manual
    // passa [] — o importador esquecia-se e o Prisma falhava
    // com "Null constraint violation" dentro da transação).
    let created: { id: string }

    try {
      created = await transaction.productVariant.create({
        data: {
          productId,
          sku: finalSku,
          // String vazia do CSV → NULL de propósito (coluna
          // nullable de TEXTO). Nota: NUNCA usar este padrão em
          // campos numéricos — zero é valor válido.
          supplierSku: variant.supplierSku || null,
          optionKey,
          images: [],
          price: variant.price,
          priceSet: variant.priceSet,
          stockQuantity: variant.stock,
          isActive: variant.isActive,
          position,
        },
        select: { id: true },
      })
    } catch (error) {
      console.error(
        `[catalog-import] erro técnico ao criar variante (linha ${variant.rowNumber}, SKU "${finalSku}"):`,
        error,
      )

      throw new ImportFieldProductionError(
        `${formatVariantLabel({ productName }, variant)}: erro inesperado da base de dados ao criar a variante (ver logs do servidor).`,
        variant.rowNumber,
        finalSku,
      )
    }

    createdVariants += 1
    createdVariantSkus.push({
      sku: finalSku,
      supplierSku: variant.supplierSku || null,
    })

    for (const [
      code,
      value,
    ] of Object.entries(selections)) {
      const optionId = await resolveOptionId(
        transaction,
        productId,
        code,
      )

      if (!optionId) {
        continue
      }

      const optionValue =
        await transaction.productOptionValue.upsert(
          {
            where: {
              optionId_value: {
                optionId,
                value,
              },
            },
            update: {},
            create: {
              optionId,
              value,
            },
            select: { id: true },
          },
        )

      await transaction.productVariantOptionSelection.create(
        {
          data: {
            variantId: created.id,
            optionId,
            optionValueId: optionValue.id,
          },
        },
      )
    }

    for (const specification of
      variant.specifications) {
      await transaction.productVariantSpecification.create(
        {
          data: {
            variantId: created.id,
            key: specification.key,
            label: specification.label,
            value: specification.value,
            unit: specification.unit,
            position: specification.position,
          },
        },
      )
    }
  }

  return {
    createdVariants,
    updatedVariants,
    generatedSkus,
    resolvedCollisions,
    createdVariantSkus,
    updatedVariantSkus,
  }
}

async function resolveOptionId(
  transaction: ImportTransaction,
  productId: string,
  code: string,
) {
  const namesByCode: Record<string, string> = {
    diameter: 'Diâmetro',
    width: 'Largura',
    pcd: 'Padrão de parafusos',
    offset: 'Offset (ET)',
    centre_bore: 'Furo central',
    finish: 'Acabamento',
    front_drop_mm: 'Rebaixo dianteiro',
    rear_drop_mm: 'Rebaixo traseiro',
  }

  const option =
    await transaction.productOption.upsert({
      where: {
        productId_code: {
          productId,
          code,
        },
      },
      update: {},
      create: {
        productId,
        code,
        name: namesByCode[code] ?? code,
      },
      select: { id: true },
    })

  return option.id
}

/**
 * Imagens importadas: SEMPRE associadas a ESTE produto. A associação
 * de acabamento resolve-se contra os valores de acabamento DO
 * MESMO produto; imagens com acabamento desconhecido são ignoradas
 * (aviso), nunca ligadas a outro produto.
 *
 * Deduplicação por productId + finish + URL normalizado:
 * - linhas repetidas no mesmo ficheiro não criam duplicados;
 * - reimports preenchem apenas imagens EM FALTA — o mesmo CSV
 *   pode correr quantas vezes for preciso.
 */
async function upsertImportedImages(
  transaction: ImportTransaction,
  productId: string,
  group: Awaited<
    ReturnType<typeof buildRowInputs>
  >['products'][number],
  profile: ImportProfile,
  finishValueIds: Map<string, string>,
): Promise<{ createdImages: number; matchedImages: number }> {
  // 1. Estado real das imagens deste produto (reimport seguro).
  const existingImages =
    await transaction.productImage.findMany({
      where: { productId },
      select: {
        id: true,
        url: true,
        finishValueId: true,
      },
    })

  const existingKeys = new Set(
    existingImages.map((image) =>
      importImageKey(image.finishValueId, image.url),
    ),
  )

  // 2. Candidatos do ficheiro: dedupe em memória por
  //    finish + URL normalizado (linhas repetidas colapsam).
  const candidates = new Map<
    string,
    { url: string; finishValueId: string | null }
  >()

  for (const image of group.images) {
    const url = image.url.trim()

    if (!url) {
      // URL de imagem opcional em branco: ignora-se em
      // silêncio, nunca falha o import.
      continue
    }

    // Defesa extra: o motor já valida e avisa por linha;
    // aqui só http(s) passa, sem nunca falhar o import.
    if (!isValidImportImageUrl(url)) {
      continue
    }

    let finishValueId: string | null = null

    if (image.finish && profile === 'wheels') {
      const key = normalizeFinishKey(
        image.finish,
      )

      finishValueId =
        findFinishValueId(
          finishValueIds,
          image.finish,
        ) ??
        [...finishValueIds.entries()].find(
          ([value]) =>
            normalizeFinishKey(value) === key,
        )?.[1] ??
        null
    }

    const key = importImageKey(
      finishValueId,
      url,
    )

    if (!candidates.has(key)) {
      candidates.set(key, {
        url,
        finishValueId,
      })
    }
  }

  if (candidates.size === 0) {
    return {
      createdImages: 0,
      matchedImages: 0,
    }
  }

  // 3. Só cria o que AINDA NÃO EXISTE (chave
  //    productId + finish + URL). O mesmo CSV reimportado
  //    não duplica nada; imagens existentes são mantidas.
  let sortOrder = existingImages.length
  let createdImages = 0
  let matchedImages = 0

  for (const [
    key,
    candidate,
  ] of candidates) {
    if (existingKeys.has(key)) {
      matchedImages += 1
      continue
    }

    await transaction.productImage.create({
      data: {
        productId,
        url: candidate.url,
        altText: null,
        sortOrder,
        isPrimary: sortOrder === 0,
        finishValueId: candidate.finishValueId,
      },
    })

    existingKeys.add(key)
    sortOrder += 1
    createdImages += 1
  }

  return {
    createdImages,
    matchedImages,
  }
}

/** Chave de dedupe de imagens: finish + URL normalizado. */
function importImageKey(
  finishValueId: string | null,
  url: string,
) {
  // finishValueId é único por produto; a chave continua
  // isolada por produto mesmo com finishes de nome igual.
  return `${finishValueId ?? 'geral'}\u0000${url
    .trim()
    .toLowerCase()}`
}

/** URL http(s) bem formado (sem descarregar nada). */
function isValidImportImageUrl(value: string) {
  try {
    const parsed = new URL(value)

    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:'
    )
  } catch {
    return false
  }
}

/**
 * Cache por transação de entidades de veículo já resolvidas:
 * o mesmo "BMW"/"Série 4" repete-se em dezenas de linhas.
 */
type ImportVehicleEntityCache = {
  vehicleBrand: Map<string, { id: string }>
  vehicleModel: Map<string, { id: string }>
  vehicleGeneration: Map<string, { id: string }>
}

function createVehicleEntityCache(): ImportVehicleEntityCache {
  return {
    vehicleBrand: new Map(),
    vehicleModel: new Map(),
    vehicleGeneration: new Map(),
  }
}

/**
 * Marca de veículo por slug OU nome (case-insensitive), criando
 * quando não existe. O importador nunca silencia uma marca nova.
 */
async function resolveVehicleBrandId(
  transaction: ImportTransaction,
  cache: ImportVehicleEntityCache,
  name: string,
) {
  const cacheKey = name.trim().toLocaleLowerCase('pt-PT')
  const cached = cache.vehicleBrand.get(cacheKey)

  if (cached) {
    return cached
  }

  const slug = toSlug(name)

  const existing = slug
    ? await transaction.vehicleBrand.findFirst({
        where: {
          OR: [{ slug }, { name: { equals: name, mode: 'insensitive' } }],
        },
        select: { id: true },
      })
    : await transaction.vehicleBrand.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      })

  const resolved =
    existing ??
    (await transaction.vehicleBrand.create({
      data: { name, slug },
      select: { id: true },
    }))

  cache.vehicleBrand.set(cacheKey, resolved)

  return resolved
}

/**
 * Modelo de veículo dentro da marca por slug OU nome
 * (case-insensitive), criando quando não existe.
 */
async function resolveVehicleModelId(
  transaction: ImportTransaction,
  cache: ImportVehicleEntityCache,
  brandId: string,
  name: string,
) {
  const cacheKey = `${brandId}\u0000${name
    .trim()
    .toLocaleLowerCase('pt-PT')}`
  const cached = cache.vehicleModel.get(cacheKey)

  if (cached) {
    return cached
  }

  const slug = toSlug(name)

  const existing = slug
    ? await transaction.vehicleModel.findFirst({
        where: {
          brandId,
          OR: [{ slug }, { name: { equals: name, mode: 'insensitive' } }],
        },
        select: { id: true },
      })
    : await transaction.vehicleModel.findFirst({
        where: {
          brandId,
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      })

  const resolved =
    existing ??
    (await transaction.vehicleModel.create({
      data: { brandId, name, slug },
      select: { id: true },
    }))

  cache.vehicleModel.set(cacheKey, resolved)

  return resolved
}

/**
 * Geração/chassis dentro do modelo por nome (case-insensitive),
 * criando quando não existe. Devolve null para geração vazia.
 */
async function resolveVehicleGenerationId(
  transaction: ImportTransaction,
  cache: ImportVehicleEntityCache,
  modelId: string,
  name: string,
) {
  const trimmed = name.trim()

  if (!trimmed) {
    return null
  }

  const cacheKey = `${modelId}\u0000${trimmed.toLocaleLowerCase('pt-PT')}`
  const cached = cache.vehicleGeneration.get(cacheKey)

  if (cached) {
    return cached
  }

  const existing =
    await transaction.vehicleGeneration.findFirst({
      where: {
        modelId,
        name: { equals: trimmed, mode: 'insensitive' },
      },
      select: { id: true },
    })

  const resolved =
    existing ??
    (await transaction.vehicleGeneration.create({
      data: { modelId, name: trimmed },
      select: { id: true },
    }))

  cache.vehicleGeneration.set(cacheKey, resolved)

  return resolved
}

async function upsertImportedCompatibilities(
  transaction: ImportTransaction,
  productId: string,
  profile: ImportProfile,
  compatibilities: ProductRowInput['compatibilities'],
  cache: ImportVehicleEntityCache = createVehicleEntityCache(),
) {
  if (
    profile === 'wheels' ||
    compatibilities.length === 0
  ) {
    return
  }

  for (const compatibility of compatibilities) {
    const brand = await resolveVehicleBrandId(
      transaction,
      cache,
      compatibility.make,
    )

    const model = await resolveVehicleModelId(
      transaction,
      cache,
      brand.id,
      compatibility.model,
    )

    const generation =
      await resolveVehicleGenerationId(
        transaction,
        cache,
        model.id,
        compatibility.generation ?? '',
      )

    let configurationId: string | null = null

    if (generation && compatibility.engine) {
      const configuration =
        await transaction.vehicleConfiguration.findFirst(
          {
            where: {
              generationId: generation.id,
              engineCode:
                compatibility.engine,
            },
            select: { id: true },
          },
        )

      configurationId =
        configuration?.id ?? null
    }

    const existing =
      await transaction.productVehicleCompatibility.findFirst(
        {
          where: {
            productId,
            vehicleModelId: model.id,
            vehicleGenerationId:
              generation?.id ?? null,
            vehicleConfigurationId:
              configurationId,
          },
          select: { id: true },
        },
      )

    if (existing) {
      continue
    }

    await transaction.productVehicleCompatibility.create(
      {
        data: {
          productId,
          vehicleBrandId: brand.id,
          vehicleModelId: model.id,
          vehicleGenerationId:
            generation?.id ?? null,
          vehicleConfigurationId:
            configurationId,
          yearMin: compatibility.yearFrom,
          yearMax: compatibility.yearTo,
        },
      },
    )
  }
}

export async function listImportHistory(
  client?: PrismaClient,
) {
  const db = client ?? prisma

  return db.productImport.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
  })
}
