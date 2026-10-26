import type {
  Prisma,
  PrismaClient,
} from '@prisma/client'
import {
  z,
  ZodError,
} from 'zod'

import { getCategoryFilterProfile } from '@/lib/storefront-category-profile'
import { toSlug } from '@/lib/slug'
import { prisma } from './db'
import {
  recordStockMovement,
} from './inventory'

const productShippingClasses = [
  'SMALL',
  'STANDARD',
  'BULKY',
  'HEAVY',
  'QUOTE_REQUIRED',
] as const

const adminProductImageSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => {
    if (
      value.startsWith('/') &&
      !value.startsWith('//')
    ) {
      return true
    }

    try {
      const url = new URL(value)
      return (
        url.protocol === 'http:' ||
        url.protocol === 'https:'
      )
    } catch {
      return false
    }
  }, 'Imagem tem de ser um URL ou caminho relativo válido')

const adminProductImageMetadataSchema = z.object({
  id: z.string().trim().min(1).optional(),
  url: adminProductImageSchema,
  altText: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional(),
  sortOrder: z
    .number()
    .int()
    .min(0)
    .optional(),
  isPrimary: z.boolean().optional(),
  finish: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .nullable()
    .optional(),
})

const nullableIdSchema = z
  .union([
    z.string().trim().min(1),
    z.null(),
  ])
  .optional()

const adminVariantSpecificationSchema = z.object({
  key: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(500),
  unit: z
    .string()
    .trim()
    .max(30)
    .nullable()
    .optional(),
  position: z.number().int().min(0).optional(),
})

const adminVariantSchema = z.object({
  id: z.string().trim().min(1).optional(),
  /**
   * O SKU é opcional: quando fica em branco é gerado
   * automaticamente a partir do nome do produto, mantendo
   * a garantia de unicidade na base de dados.
   */
  sku: z.string().trim().max(100).optional(),
  price: z.number({
    message:
      'Indica um preço válido (ex.: 189,90).',
  })
    .finite()
    .min(0),
  stockQuantity: z.number({
    message:
      'Indica um stock inteiro válido (ex.: 8).',
  })
    .int()
    .min(0),
  isActive: z.boolean(),
  optionKey: z.string().trim().min(1).optional(),
  selections: z
    .record(
      z.string(),
      z.string().trim().min(1),
    )
    .default({}),
  specifications: z
    .array(adminVariantSpecificationSchema)
    .optional(),
})

const adminCompatibilitySchema = z.object({
  vehicleBrandId: z.string().trim().min(1),
  vehicleModelId: z.string().trim().min(1),
  vehicleGenerationId: nullableIdSchema,
  vehicleConfigurationId: nullableIdSchema,
  yearMin: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
  yearMax: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
})

const adminProductWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(220)
      .optional(),
    productSku: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),
    categoryId: z.string().trim().min(1),
    productBrandId: nullableIdSchema,
    description: z
      .string()
      .trim()
      .max(10_000)
      .nullable()
      .optional(),
    images: z
      .array(adminProductImageSchema)
      .max(100)
      .default([]),
    imageMetadata: z
      .array(adminProductImageMetadataSchema)
      .max(100)
      .optional(),
    defaultFinish: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .nullable()
      .optional(),
    shippingClass: z.enum(productShippingClasses),
    mainlandShippingCost: z
      .number({
        message:
          'Indica um valor de portes válido (ex.: 12,50).',
      })
      .finite()
      .min(0)
      .nullable()
      .optional(),
    isActive: z.boolean().default(true),
    variants: z
      .array(adminVariantSchema)
      .min(1)
      .max(250),
    compatibilities: z
      .array(adminCompatibilitySchema)
      .max(250)
      .default([]),
  })
  .superRefine((data, context) => {
    const variantSkus = new Set<string>()
    const variantIds = new Set<string>()

    /**
     * Identidade de uma variante de jante: as especificações
     * (diâmetro, largura, PCD, ET, CB) e o acabamento. Preço, stock e
     * SKU nunca fazem parte — duas variantes com o mesmo conjunto de
     * eixos mas acabamentos diferentes são produtos distintos válidos
     * (ex.: 19"/8.5J/5x120/ET30/66.6 mm prata vs. preto acetinado).
     */
    const selectionSignature = (
      selections: Record<string, string>,
    ) =>
      JSON.stringify(
        Object.entries(selections)
          .sort(
            ([left], [right]) =>
              left.localeCompare(right),
          )
          .map(
            ([code, value]) =>
              `${code}=${value.trim().toLocaleLowerCase('pt-PT')}`,
          ),
      )

    /**
     * Para cada variante, memoriza com que outra(s) colide exatamente
     * (todas as especificações + acabamento iguais). Usado para
     * sinalizar TODAS as linhas em conflito e nomear uma na outra.
     */
    const conflictsByVariant = new Map<
      number,
      number[]
    >()

    data.variants.forEach((variant, index) => {
      const conflicts: number[] = []

      data.variants.forEach(
        (candidate, candidateIndex) => {
          if (candidateIndex === index) {
            return
          }

          if (
            selectionSignature(
              candidate.selections,
            ) === selectionSignature(variant.selections)
          ) {
            conflicts.push(candidateIndex)
          }
        },
      )

      if (conflicts.length > 0) {
        conflictsByVariant.set(
          index,
          conflicts,
        )
      }
    })

    for (const [
      index,
      conflicts,
    ] of conflictsByVariant) {
      const firstConflict = conflicts[0]

      context.addIssue({
        code: 'custom',
        path: ['variants', index, 'selections'],
        message: `A variante ${index + 1} repete a combinação da variante ${firstConflict + 1}. Duplica as especificações e o acabamento.`,
      })
    }

    data.variants.forEach((variant, index) => {
      if (variant.id) {
        if (variantIds.has(variant.id)) {
          context.addIssue({
            code: 'custom',
            path: ['variants', index, 'id'],
            message:
              'A variante não pode ser repetida no formulário',
          })
        }
        variantIds.add(variant.id)
      }

      if (
        variant.sku &&
        variantSkus.has(variant.sku)
      ) {
        context.addIssue({
          code: 'custom',
          path: [
            'variants',
            index,
            'sku',
          ],
          message:
            'O SKU da variante tem de ser único',
        })
      }
      if (variant.sku) {
        variantSkus.add(variant.sku)
      }
    })

    const compatibilitySignatures = new Set<string>()

    data.compatibilities.forEach(
      (compatibility, index) => {
        const yearMin =
          compatibility.yearMin ?? null
        const yearMax =
          compatibility.yearMax ?? null

        if (
          yearMin !== null &&
          yearMax !== null &&
          yearMax < yearMin
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'compatibilities',
              index,
              'yearMax',
            ],
            message:
              'O ano final tem de ser igual ou posterior ao inicial',
          })
        }

        const signature = [
          compatibility.vehicleBrandId,
          compatibility.vehicleModelId,
          compatibility.vehicleGenerationId ??
            '',
          compatibility.vehicleConfigurationId ??
            '',
          yearMin,
          yearMax,
        ].join(':')

        if (compatibilitySignatures.has(signature)) {
          context.addIssue({
            code: 'custom',
            path: ['compatibilities', index],
            message:
              'A aplicação de veículo não pode estar duplicada',
          })
        }

        compatibilitySignatures.add(signature)
      },
    )
  })

export type AdminProductWorkspaceInput = z.infer<
  typeof adminProductWorkspaceSchema
>

export type AdminProductShippingClass =
  (typeof productShippingClasses)[number]

export type AdminProductResponseShippingClass =
  | AdminProductShippingClass
  | 'UNASSIGNED'

export type AdminProductImage = {
  id: string
  url: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
  finish: string | null
  finishValueId: string | null
}

export type AdminProduct = {
  id: string
  name: string
  slug: string
  sku: string
  description: string | null
  isActive: boolean
  images: string[]
  imageMetadata: AdminProductImage[]
  defaultFinish: string | null
  shippingClass: AdminProductResponseShippingClass
  mainlandShippingCost: string | null
  category: {
    id: string
    name: string
    slug: string
    parentId: string | null
  }
  brand: {
    id: string
    name: string
    slug: string
  } | null
  variants: Array<{
    id: string
    sku: string
    price: string
    stockQuantity: number
    isActive: boolean
    position: number
    optionKey: string
    options: Array<{
      code: string
      name: string
      value: string
    }>
    specifications: Array<{
      key: string
      label: string
      value: string
      unit: string | null
      position: number
    }>
  }>
  compatibilities: Array<{
    id: string
    vehicleBrandId: string
    vehicleModelId: string
    vehicleGenerationId: string | null
    vehicleConfigurationId: string | null
    yearMin: number | null
    yearMax: number | null
    vehicleBrand: {
      id: string
      name: string
    }
    vehicleModel: {
      id: string
      name: string
    }
    vehicleGeneration: {
      id: string
      name: string
    } | null
    vehicleConfiguration: {
      id: string
      name: string
      engineCode: string | null
    } | null
  }>
}

export type AdminProductClient = Pick<
  PrismaClient,
  | '$transaction'
  | 'product'
  | 'productVariant'
  | 'productOption'
  | 'productOptionValue'
  | 'productVariantOptionSelection'
  | 'productVariantSpecification'
  | 'productVehicleCompatibility'
  | 'productImage'
  | 'productBrand'
  | 'category'
  | 'vehicleModel'
  | 'cartItem'
  | 'orderItem'
>

type ProductTransaction = Prisma.TransactionClient

type ProductProfile = ReturnType<
  typeof getCategoryFilterProfile
>

type ManagedAxis = {
  code: string
  name: string
}

const managedAxesByProfile: Record<
  ProductProfile,
  ManagedAxis[]
> = {
  wheels: [
    { code: 'diameter', name: 'Diâmetro' },
    { code: 'width', name: 'Largura' },
    {
      code: 'pcd',
      name: 'Padrão de parafusos',
    },
    { code: 'offset', name: 'Offset (ET)' },
    {
      code: 'centre_bore',
      name: 'Furo central',
    },
    { code: 'finish', name: 'Acabamento' },
  ],
  suspension: [
    {
      code: 'front_drop_mm',
      name: 'Rebaixo dianteiro',
    },
    {
      code: 'rear_drop_mm',
      name: 'Rebaixo traseiro',
    },
  ],
  exterior: [],
  generic: [],
}

const adminProductSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  description: true,
  isActive: true,
  images: true,
  defaultFinish: true,
  shippingClass: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  shippingRates: {
    where: {
      region: 'PORTUGAL_MAINLAND' as const,
    },
    select: {
      shippingCost: true,
    },
  },
  imageMetadata: {
    orderBy: [
      {
        sortOrder: 'asc' as const,
      },
      {
        id: 'asc' as const,
      },
    ],
    select: {
      id: true,
      url: true,
      altText: true,
      sortOrder: true,
      isPrimary: true,
      finishValueId: true,
      finishValue: {
        select: {
          value: true,
          option: {
            select: {
              code: true,
            },
          },
        },
      },
    },
  },
  variants: {
    orderBy: {
      position: 'asc' as const,
    },
    select: {
      id: true,
      sku: true,
      price: true,
      stockQuantity: true,
      isActive: true,
      position: true,
      optionKey: true,
      selections: {
        select: {
          optionValue: {
            select: {
              value: true,
              option: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      specifications: {
        orderBy: {
          position: 'asc' as const,
        },
        select: {
          key: true,
          label: true,
          value: true,
          unit: true,
          position: true,
        },
      },
    },
  },
  compatibilities: {
    orderBy: {
      id: 'asc' as const,
    },
    select: {
      id: true,
      vehicleBrandId: true,
      vehicleModelId: true,
      vehicleGenerationId: true,
      vehicleConfigurationId: true,
      yearMin: true,
      yearMax: true,
      vehicleBrand: {
        select: {
          id: true,
          name: true,
        },
      },
      vehicleModel: {
        select: {
          id: true,
          name: true,
        },
      },
      vehicleGeneration: {
        select: {
          id: true,
          name: true,
        },
      },
      vehicleConfiguration: {
        select: {
          id: true,
          name: true,
          engineCode: true,
        },
      },
    },
  },
} satisfies Prisma.ProductSelect

type AdminProductRecord =
  Prisma.ProductGetPayload<{
    select: typeof adminProductSelect
  }>

export class AdminProductValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminProductValidationError'
  }
}

export class AdminProductNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminProductNotFoundError'
  }
}

export class AdminProductConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminProductConflictError'
  }
}

/**
 * Erros de validação estruturados por campo. `fieldErrors` usa caminhos
 * legíveis (ex.: `variants.2.price`) para o formulário marcar exatamente
 * os campos inválidos e mostrar um resumo dos problemas.
 */
export class AdminProductFieldValidationError extends Error {
  fieldErrors: Record<
    string,
    string[]
  >

  constructor(
    fieldErrors: Record<
      string,
      string[]
    >,
    message = 'Alguns campos precisam de correção antes de guardar.',
  ) {
    super(message)
    this.name = 'AdminProductFieldValidationError'
    this.fieldErrors = fieldErrors
  }
}

/**
 * Converte um ZodError do schema do workspace em erros por campo com
 * caminhos serializados (ex.: `variants.1.sku`) e mensagens pt-PT.
 */
export function toFieldValidationError(
  error: ZodError,
): AdminProductFieldValidationError {
  const normalized: Record<
    string,
    string[]
  > = {}

  for (const issue of error.issues) {
    const key =
      issue.path.length > 0
        ? issue.path.join('.')
        : '_form'

    normalized[key] ??= []
    normalized[key].push(
      issue.message,
    )
  }

  return new AdminProductFieldValidationError(
    normalized,
  )
}

/**
 * Normaliza entrada pt-PT antes da validação. Aceita formatos que o
 * administrador escreve naturalmente sem enfraquecer as regras:
 * - preço: "169,90" ou "169.90" → 169.9
 * - diâmetro: "18" ou "18\"" → "18\""
 * - largura: "8.5" ou "8.5J" → "8.5J"
 * - ET: "35" ou "ET35" → "ET35"
 * - CB: "66.6" ou "66,6 mm" → "66.6 mm"
 */
export function normalizeWorkspaceInput(
  input: unknown,
): unknown {
  if (
    !input ||
    typeof input !== 'object'
  ) {
    return input
  }

  const data = {
    ...(input as Record<string, unknown>),
  }

  // O preço e os portes usam vírgula decimal em pt-PT.
  for (const key of [
    'price',
    'mainlandShippingCost',
  ]) {
    if (
      typeof data[key] === 'string'
    ) {
      const parsed = parsePortugueseDecimal(
        data[key] as string,
      )
      if (parsed !== null) {
        data[key] = parsed
      }
    }
  }

  if (
    Array.isArray(data.variants)
  ) {
    data.variants = (
      data.variants as unknown[]
    ).map((variant) =>
      normalizeVariantInput(variant),
    )
  }

  return data
}

function parsePortugueseDecimal(
  value: string,
): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed)
    ? parsed
    : null
}

type NumericSuffixUnit = 'mm' | 'J'

/**
 * Completa um valor numérico com a sua unidade quando o administrador
 * escreve só o número. O separador depende da unidade: larguras ficam
 * "8.5J" (sem espaço) e furos "66.6 mm" (com espaço).
 */
function normalizeNumericValueWithUnit(
  value: string,
  unit: NumericSuffixUnit,
): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return trimmed
  }

  const withoutUnit = trimmed
    .replace(
      new RegExp(
        `\\s*${unit}\\s*$`,
        'i',
      ),
      '',
    )
    .trim()

  const parsed = parsePortugueseDecimal(
    withoutUnit,
  )
  if (parsed === null) {
    return trimmed
  }

  return unit === 'J'
    ? `${parsed}J`
    : `${parsed} ${unit}`
}

/**
 * Garante o formato canónico usado pela loja:
 * - diâmetro termina em polegadas: "18" → '18"'
 * - largura termina em J: "8.5" → "8.5J"
 * - offset ganha prefixo ET: "35" → "ET35"
 * - furo central ganha unidade: "66,6" → "66.6 mm"
 */
export function normalizeWheelSelectionValue(
  code: string,
  value: string,
): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return trimmed
  }

  switch (code) {
    case 'diameter': {
      const withoutInches = trimmed.replace(
        /\s*["””]\s*$/,
        '',
      )
      const parsed = parsePortugueseDecimal(
        withoutInches,
      )
      return parsed === null
        ? trimmed
        : `${parsed}"`
    }
    case 'width':
      return normalizeNumericValueWithUnit(
        trimmed,
        'J',
      )
    case 'offset': {
      const withoutPrefix = trimmed
        .replace(/^ET\s*/i, '')
        .trim()
      const parsed = parsePortugueseDecimal(
        withoutPrefix,
      )
      return parsed === null
        ? trimmed
        : `ET${parsed}`
    }
    case 'centre_bore':
      return normalizeNumericValueWithUnit(
        trimmed,
        'mm',
      )
    default:
      return trimmed
  }
}

function normalizeVariantInput(
  variant: unknown,
): unknown {
  if (
    !variant ||
    typeof variant !== 'object'
  ) {
    return variant
  }

  const data = {
    ...(variant as Record<string, unknown>),
  }

  for (const key of [
    'price',
    'stockQuantity',
  ]) {
    if (
      typeof data[key] === 'string'
    ) {
      const parsed = parsePortugueseDecimal(
        data[key] as string,
      )
      if (parsed !== null) {
        data[key] =
          key === 'stockQuantity'
            ? Math.round(parsed)
            : parsed
      }
    }
  }

  if (
    data.selections &&
    typeof data.selections === 'object'
  ) {
    data.selections = Object.fromEntries(
      Object.entries(
        data.selections as Record<
          string,
          unknown
        >,
      ).map(([code, value]) => [
        code,
        typeof value === 'string'
          ? normalizeWheelSelectionValue(
              code,
              value,
            )
          : value,
      ]),
    )
  }
  return data
}

const adminProductBulkActionSchema = z.object({
  ids: z
    .array(
      z.string().trim().min(1),
    )
    .min(1)
    .max(1000),
  action: z.enum([
    'activate',
    'deactivate',
    'delete',
  ]),
})

export type AdminProductBulkAction =
  z.infer<
    typeof adminProductBulkActionSchema
  >['action']

export type AdminProductDeleteResult = {
  id: string
  name: string
  status: 'deleted' | 'archived'
  message: string
  /**
   * Present only when the product could not be deleted permanently.
   * `order_history` means real order records reference the product.
   * `cart_reference` no longer forces archival: cart rows are live
   * session data and are removed together with the product.
   */
  reason?: 'order_history'
  orderNumbers: string[]
  references: {
    orderItems: number
    cartItems: number
  }
}

export type AdminProductBulkFailure = {
  id: string
  error: string
}

export type AdminProductBulkResult = {
  action: AdminProductBulkAction
  updated: Array<{
    id: string
    name: string
    isActive: boolean
  }>
  deleted: AdminProductDeleteResult[]
  archived: AdminProductDeleteResult[]
  failed: AdminProductBulkFailure[]
  counts: {
    requested: number
    updated: number
    deleted: number
    archived: number
    failed: number
  }
}

function parseBulkActionInput(
  input: unknown,
) {
  const parsed =
    adminProductBulkActionSchema.parse(input)
  const ids = [
    ...new Set(parsed.ids),
  ]

  if (ids.length !== parsed.ids.length) {
    throw new AdminProductValidationError(
      'A seleção contém IDs repetidos',
    )
  }

  return {
    ids,
    action: parsed.action,
  }
}

function getBulkFailureMessage(
  error: unknown,
  action: AdminProductBulkAction,
) {
  if (
    error instanceof
      AdminProductValidationError ||
    error instanceof
      AdminProductNotFoundError ||
    error instanceof
      AdminProductConflictError
  ) {
    return error.message
  }

  if (action === 'delete') {
    return 'Não foi possível eliminar este produto. Tenta novamente.'
  }

  if (action === 'activate') {
    return 'Não foi possível ativar este produto. Tenta novamente.'
  }

  return 'Não foi possível desativar este produto. Tenta novamente.'
}

function getClient(
  client?: AdminProductClient,
): AdminProductClient {
  return client ?? prisma
}

function validateId(
  id: string,
  label = 'produto',
) {
  if (!id.trim()) {
    throw new AdminProductValidationError(
      `O ID do ${label} é obrigatório`,
    )
  }
}

function parseInput(
  input: unknown,
): AdminProductWorkspaceInput {
  return adminProductWorkspaceSchema.parse(
    normalizeWorkspaceInput(input),
  )
}

function getProfile(
  category: {
    name: string
    slug: string
  },
) {
  return getCategoryFilterProfile(category)
}

function validateCategoryFields(
  profile: ProductProfile,
  input: AdminProductWorkspaceInput,
) {
  if (
    profile === 'wheels' &&
    input.compatibilities.length > 0
  ) {
    throw new AdminProductValidationError(
      'Jantes não usam compatibilidade por veículo. A adequação resulta das especificações da variante.',
    )
  }

  if (
    profile === 'suspension' &&
    input.compatibilities.length === 0
  ) {
    throw new AdminProductValidationError(
      'Adicione pelo menos uma aplicação de veículo à suspensão.',
    )
  }

  if (
    profile !== 'wheels' &&
    profile !== 'suspension'
  ) {
    return
  }

  const requiredAxes = managedAxesByProfile[profile]
  const fieldErrors: Record<string, string[]> = {}

  input.variants.forEach((variant, index) => {
    requiredAxes.forEach((axis) => {
      if (!variant.selections[axis.code]) {
        const message = `A variante ${index + 1} precisa de ${axis.name.toLocaleLowerCase('pt-PT')}.`
        const key = `variants.${index}.selections.${axis.code}`

        fieldErrors[key] ??= []
        fieldErrors[key].push(message)
      }
    })
  })

  if (Object.keys(fieldErrors).length > 0) {
    throw new AdminProductFieldValidationError(
      fieldErrors,
    )
  }
}

function normalizeImages(
  images: string[],
) {
  return images
    .map((image) => image.trim())
    .filter(Boolean)
}

type NormalizedProductImage = {
  url: string
  altText: string | null
  sortOrder: number
  isPrimary: boolean
  finish: string | null
  finishValueId: string | null
}

export function findFinishValueId(
  finishValueIds: Map<string, string>,
  finish: string,
) {
  const exact = finishValueIds.get(finish)
  if (exact) {
    return exact
  }

  const normalized =
    finish.toLocaleLowerCase('pt-PT')
  for (const [value, id] of finishValueIds) {
    if (
      value.toLocaleLowerCase('pt-PT') ===
      normalized
    ) {
      return id
    }
  }

  return undefined
}

function validateDefaultFinish(
  profile: ProductProfile,
  input: AdminProductWorkspaceInput,
) {
  const defaultFinish =
    input.defaultFinish
  if (!defaultFinish) {
    return
  }

  if (profile !== 'wheels') {
    throw new AdminProductValidationError(
      'O acabamento de catálogo só pode ser definido para jantes.',
    )
  }

  if (
    !input.variants.some(
      (variant) =>
        variant.selections.finish
          ?.trim()
          .toLocaleLowerCase('pt-PT') ===
          defaultFinish.toLocaleLowerCase(
            'pt-PT',
          ),
    )
  ) {
    throw new AdminProductValidationError(
      'O acabamento de catálogo tem de existir nas variantes da jante.',
    )
  }
}

function normalizeProductImages(
  input: Pick<
    AdminProductWorkspaceInput,
    'imageMetadata' | 'images'
  >,
  profile: ProductProfile,
  finishValueIds: Map<string, string>,
): NormalizedProductImage[] {
  const requested: Array<{
    url: string
    altText?: string | null
    sortOrder?: number
    isPrimary?: boolean
    finish?: string | null
  }> = input.imageMetadata ??
    input.images.map((url) => ({
      url,
    }))

  const grouped = new Map<
    string,
    Array<{
      url: string
      altText: string | null
      sortOrder: number
      isPrimary: boolean
      finish: string | null
      finishValueId: string | null
    }>
  >()

  requested.forEach((image, index) => {
    const finish =
      'finish' in image
        ? image.finish?.trim() || null
        : null

    if (
      finish &&
      profile !== 'wheels'
    ) {
      throw new AdminProductValidationError(
        'Apenas jantes podem ter imagens atribuídas a um acabamento.',
      )
    }

    const finishValueId = finish
      ? findFinishValueId(
          finishValueIds,
          finish,
        ) ?? null
      : null

    if (
      finish &&
      !finishValueId
    ) {
      throw new AdminProductValidationError(
        `O acabamento "${finish}" não existe nas variantes desta jante.`,
      )
    }

    const key = finish ?? '__general__'
    const group = grouped.get(key) ?? []
    group.push({
      url: image.url.trim(),
      altText:
        'altText' in image
          ? image.altText?.trim() || null
          : null,
      sortOrder:
        'sortOrder' in image &&
        typeof image.sortOrder === 'number'
          ? image.sortOrder
          : index,
      isPrimary:
        'isPrimary' in image &&
        image.isPrimary === true,
      finish,
      finishValueId,
    })
    grouped.set(key, group)
  })

  const normalized: NormalizedProductImage[] = []

  for (const group of grouped.values()) {
    group.sort(
      (first, second) =>
        first.sortOrder - second.sortOrder,
    )

    const primaryIndex = group.findIndex(
      (image) => image.isPrimary,
    )
    const effectivePrimaryIndex =
      primaryIndex >= 0 ? primaryIndex : 0

    group.forEach((image, index) => {
      normalized.push({
        ...image,
        isPrimary:
          index === effectivePrimaryIndex,
        sortOrder: index,
      })
    })
  }

  return normalized
}

function getLegacyImages(
  images: NormalizedProductImage[],
) {
  const general = images
    .filter((image) => !image.finish)
    .map((image) => image.url)
  return general.length > 0
    ? general
    : images.map((image) => image.url)
}

async function replaceProductImages(
  transaction: ProductTransaction,
  productId: string,
  input: Pick<
    AdminProductWorkspaceInput,
    'imageMetadata' | 'images'
  >,
  profile: ProductProfile,
  finishValueIds: Map<string, string>,
) {
  const images = normalizeProductImages(
    input,
    profile,
    finishValueIds,
  )

  const legacyImages = getLegacyImages(images)
  if (transaction.product.update) {
    await transaction.product.update({
      where: { id: productId },
      data: {
        images: legacyImages,
      },
    })
  }

  // Some lightweight service tests and legacy adapters do not
  // expose the new delegate. The legacy array remains usable there;
  // the real Prisma client always persists metadata rows.
  if (!transaction.productImage) {
    return
  }

  await transaction.productImage.deleteMany({
    where: { productId },
  })

  for (const image of images) {
    await transaction.productImage.create({
      data: {
        productId,
        url: image.url,
        altText: image.altText,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
        finishValueId: image.finishValueId,
      },
    })
  }
}

function buildSlug(
  value: string,
) {
  return toSlug(value) || 'produto'
}

async function createAvailableSlug(
  transaction: ProductTransaction,
  requestedSlug: string,
) {
  const baseSlug =
    buildSlug(requestedSlug).slice(0, 210)

  let candidate = baseSlug
  let suffix = 2

  while (
    await transaction.product.findFirst({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }

  return candidate
}

async function assertSlugAvailable(
  transaction: ProductTransaction,
  slug: string,
  productId?: string,
) {
  const conflict =
    await transaction.product.findFirst({
      where: { slug },
      select: { id: true },
    })

  if (
    conflict &&
    conflict.id !== productId
  ) {
    throw new AdminProductConflictError(
      'Já existe um produto com este slug',
    )
  }
}

async function assertProductSkuAvailable(
  transaction: ProductTransaction,
  sku: string,
  productId?: string,
) {
  const conflict =
    await transaction.product.findFirst({
      where: { sku },
      select: { id: true },
    })

  if (
    conflict &&
    conflict.id !== productId
  ) {
    throw new AdminProductConflictError(
      'Já existe um produto com este SKU',
    )
  }
}

async function assertVariantSkuAvailable(
  transaction: ProductTransaction,
  sku: string,
  variantId?: string,
) {
  const conflict =
    await transaction.productVariant.findFirst({
      where: { sku },
      select: { id: true },
    })

  if (
    conflict &&
    conflict.id !== variantId
  ) {
    throw new AdminProductConflictError(
      `Já existe uma variante com o SKU ${sku}`,
    )
  }
}

function makeVariantOptionKey(
  productName: string,
  variant: AdminProductWorkspaceInput['variants'][number],
  axes: ManagedAxis[],
  fallback?: string,
) {
  const selectionPart = axes
    .map(
      (axis) =>
        variant.selections[axis.code] ??
        'default',
    )
    .join('-')

  if (selectionPart === '') {
    return (
      fallback ??
      `${buildSlug(productName)}-default`
    )
  }

  return `${buildSlug(
    productName,
  )}-${buildSlug(selectionPart)}`
    .replaceAll('-default-', '-')
    .slice(0, 220)
}

/**
 * Gera um SKU legível a partir do nome do produto e da combinação de
 * especificações (ex.: JR11-18-8J-5X112-ET40-66.6MM-SATIN-BLACK).
 * Serve para o administrador não ter de inventar SKUs à mão.
 */
export function generateVariantSku(
  productName: string,
  selections: Record<string, string>,
): string {
  const base = buildSlug(productName)
    .split('-')
    .slice(0, 2)
    .join('-')
    .toUpperCase()
  const selectionPart = Object.entries(
    selections,
  )
    .sort(
      ([left], [right]) =>
        left.localeCompare(right),
    )
    .map(([, value]) =>
      buildSlug(value).toUpperCase(),
    )
    .filter(Boolean)
    .join('-')
    .slice(0, 60)

  return selectionPart
    ? `${base || 'PRODUTO'}-${selectionPart}`
    : `${base || 'PRODUTO'}-VAR`
}

/**
 * Preenche SKUs em falta e garante que não colidem com variantes
 * já guardadas nem entre linhas do formulário. Só gera para
 * variantes novas (sem id); variantes existentes mantêm o SKU.
 */
async function ensureVariantSkus(
  transaction: ProductTransaction,
  productName: string,
  variants: AdminProductWorkspaceInput['variants'],
) {
  const used = new Set<string>()

  for (const variant of variants) {
    if (variant.sku) {
      used.add(variant.sku)
    }
  }

  for (const variant of variants) {
    if (!variant.sku) {
      if (variant.id) {
        // Uma variante existente nunca devia chegar sem SKU,
        // mas se acontecer mantém a identidade pelo id.
        variant.sku = `VAR-${variant.id.slice(-8).toUpperCase()}`
        used.add(variant.sku)
        continue
      }

      const base = generateVariantSku(
        productName,
        variant.selections,
      )
      let candidate = base.slice(0, 100)
      let suffix = 2

      while (used.has(candidate)) {
        const suffixText = `-${suffix}`
        candidate =
          base.slice(0, 100 - suffixText.length) +
          suffixText
        suffix += 1
      }

      variant.sku = candidate
      used.add(candidate)
    }

    const conflict =
      await transaction.productVariant.findFirst({
        where: {
          sku: variant.sku,
          ...(variant.id
            ? { id: { not: variant.id } }
            : {}),
        },
        select: { id: true },
      })

    if (conflict) {
      throw new AdminProductConflictError(
        `Já existe uma variante com o SKU ${variant.sku}`,
      )
    }
  }
}

async function getExistingVariants(
  transaction: ProductTransaction,
  productId: string,
) {
  return transaction.productVariant.findMany({
    where: { productId },
    select: {
      id: true,
      // Épico 6: stock anterior necessário para classificar o
      // movimento de stock (RESTOCK vs MANUAL_ADJUSTMENT).
      stockQuantity: true,
      optionKey: true,
      selections: {
        select: {
          optionValue: {
            select: {
              value: true,
              option: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      specifications: {
        select: {
          key: true,
          label: true,
          value: true,
          unit: true,
          position: true,
        },
      },
    },
  })
}

async function deleteRemovedVariants(
  transaction: ProductTransaction,
  productId: string,
  retainedIds: string[],
) {
  if (retainedIds.length === 0) {
    const orderReferenceCount =
      await transaction.orderItem.count({
        where: { productId },
      })

    if (orderReferenceCount > 0) {
      throw new AdminProductConflictError(
        'Não é possível substituir todas as variantes porque o produto tem histórico de encomendas.',
      )
    }

    await deleteProductCartReferences(
      transaction,
      productId,
      [],
    )
    await transaction.productVariant.deleteMany({
      where: { productId },
    })
    return
  }

  const variantsToDelete =
    await transaction.productVariant.findMany({
      where: {
        productId,
        id: { notIn: retainedIds },
      },
      select: { id: true },
    })

  if (variantsToDelete.length === 0) {
    return
  }

  const ids = variantsToDelete.map(
    (variant) => variant.id,
  )
  const orderReferenceCount =
    await transaction.orderItem.count({
      where: {
        productVariantId: {
          in: ids,
        },
      },
    })

  if (orderReferenceCount > 0) {
    throw new AdminProductConflictError(
      'Não é possível remover uma variante que está associada a uma encomenda. O histórico de compras tem de ser preservado.',
    )
  }

  await transaction.cartItem.deleteMany({
    where: {
      productVariantId: {
        in: ids,
      },
    },
  })
  await transaction.productVariant.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  })
}

async function replaceVariants(
  transaction: ProductTransaction,
  productId: string,
  productName: string,
  profile: ProductProfile,
  requestedVariants: AdminProductWorkspaceInput['variants'],
) {
  const finishValueIds = new Map<
    string,
    string
  >()
  const existingVariants =
    await getExistingVariants(
      transaction,
      productId,
    )
  const existingById = new Map(
    existingVariants.map((variant) => [
      variant.id,
      variant,
    ]),
  )
  const retainedIds = requestedVariants
    .map((variant) => variant.id)
    .filter(
      (id): id is string =>
        typeof id === 'string',
    )

  for (const variant of requestedVariants) {
    if (
      variant.id &&
      !existingById.has(variant.id)
    ) {
      throw new AdminProductValidationError(
        'Uma variante editada já não existe. Recarrega o produto e tenta novamente.',
      )
    }
  }

  await deleteRemovedVariants(
    transaction,
    productId,
    retainedIds,
  )

  const managedAxes =
    managedAxesByProfile[profile]
  const managedCodes = new Set(
    managedAxes.map((axis) => axis.code),
  )
  const existingOptions =
    await transaction.productOption.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
      select: {
        code: true,
        name: true,
      },
    })
  const selectionCodes = new Set<string>()

  existingVariants.forEach((variant) => {
    variant.selections.forEach((selection) => {
      selectionCodes.add(
        selection.optionValue.option.code,
      )
    })
  })
  requestedVariants.forEach((variant) => {
    Object.keys(variant.selections).forEach(
      (code) => {
        selectionCodes.add(code)
      },
    )
  })

  const extraAxes = Array.from(
    selectionCodes,
  )
    .filter(
      (code) => !managedCodes.has(code),
    )
    .map((code) => {
      const existingOption =
        existingOptions.find(
          (option) => option.code === code,
        )

      return {
        code,
        name:
          existingOption?.name ?? code,
      }
    })
  const axes = [...managedAxes, ...extraAxes]
  const optionByCode = new Map<
    string,
    { id: string }
  >()

  for (const [
    position,
    axis,
  ] of axes.entries()) {
    const option =
      await transaction.productOption.upsert({
        where: {
          productId_code: {
            productId,
            code: axis.code,
          },
        },
        update: {
          name: axis.name,
          position,
        },
        create: {
          productId,
          code: axis.code,
          name: axis.name,
          position,
        },
        select: { id: true },
      })

    optionByCode.set(axis.code, option)
  }

  const existingIds = existingVariants.map(
    (variant) => variant.id,
  )

  for (const [
    index,
    variantId,
  ] of existingIds.entries()) {
    await transaction.productVariant.update({
      where: { id: variantId },
      data: {
        optionKey: `__admin-temp-${index}-${variantId}`,
      },
    })
  }

  for (const [
    position,
    requestedVariant,
  ] of requestedVariants.entries()) {
    const existingVariant = requestedVariant.id
      ? existingById.get(requestedVariant.id)
      : null
    const selections = {
      ...Object.fromEntries(
        existingVariant?.selections
          .filter(
            ({ optionValue }) =>
              !managedCodes.has(
                optionValue.option.code,
              ),
          )
          .map(
            ({ optionValue }) => [
              optionValue.option.code,
              optionValue.value,
            ],
          ) ?? [],
      ),
      ...requestedVariant.selections,
    }
    const optionKey =
      requestedVariant.optionKey?.trim() ||
      makeVariantOptionKey(
        productName,
        {
          ...requestedVariant,
          selections,
        },
        axes,
        existingVariant?.optionKey,
      )

    await assertVariantSkuAvailable(
      transaction,
      requestedVariant.sku!,
      existingVariant?.id,
    )

    const variant = existingVariant
      ? await transaction.productVariant.update({
          where: {
            id: existingVariant.id,
          },
          data: {
            sku: requestedVariant.sku!,
            price: requestedVariant.price,
            stockQuantity:
              requestedVariant.stockQuantity,
            isActive: requestedVariant.isActive,
            position,
            optionKey,
          },
          select: { id: true },
        })
      : await transaction.productVariant.create({
          data: {
            productId,
            sku: requestedVariant.sku!,
            price: requestedVariant.price,
            stockQuantity:
              requestedVariant.stockQuantity,
            isActive: requestedVariant.isActive,
            images: [],
            position,
            optionKey,
          },
          select: { id: true },
        })

    // Épico 6 — histórico de movimentos de stock: o stock é definido
    // pela administração na mesma transação do movimento. Aumento de
    // stock é reposição (RESTOCK); redução é correção manual
    // (MANUAL_ADJUSTMENT); variantes novas só registam movimento quando
    // arrancam com stock. Sem alteração de valor não há movimento.
    if (existingVariant) {
      const previousStock =
        existingVariant.stockQuantity
      const newStock =
        requestedVariant.stockQuantity

      if (previousStock !== newStock) {
        await recordStockMovement(
          transaction,
          {
            variantId: variant.id,
            type:
              newStock > previousStock
                ? 'RESTOCK'
                : 'MANUAL_ADJUSTMENT',
            quantityChange:
              newStock -
              previousStock,
            previousStock,
            newStock,
            actorUserId: null,
          },
        )
      }
    } else if (
      requestedVariant.stockQuantity > 0
    ) {
      await recordStockMovement(
        transaction,
        {
          variantId: variant.id,
          type: 'RESTOCK',
          quantityChange:
            requestedVariant.stockQuantity,
          previousStock: 0,
          newStock:
            requestedVariant.stockQuantity,
          actorUserId: null,
        },
      )
    }

    if (axes.length > 0) {
      await transaction.productVariantOptionSelection.deleteMany(
        {
          where: {
            variantId: variant.id,
            optionId: {
              in: axes
                .map(
                  (axis) =>
                    optionByCode.get(
                      axis.code,
                    )?.id,
                )
                .filter(
                  (id): id is string =>
                    typeof id === 'string',
                ),
            },
          },
        },
      )
    }

    for (const axis of axes) {
      const value = selections[axis.code]

      if (!value) {
        continue
      }

      const option = optionByCode.get(
        axis.code,
      )

      if (!option) {
        continue
      }

      const optionValue =
        await transaction.productOptionValue.upsert({
          where: {
            optionId_value: {
              optionId: option.id,
              value,
            },
          },
          update: {},
          create: {
            optionId: option.id,
            value,
          },
          select: { id: true },
        })

      if (axis.code === 'finish') {
        finishValueIds.set(
          value,
          optionValue.id,
        )
      }

      await transaction.productVariantOptionSelection.create(
        {
          data: {
            variantId: variant.id,
            optionId: option.id,
            optionValueId: optionValue.id,
          },
        },
      )
    }

    if (
      requestedVariant.specifications !==
      undefined
    ) {
      await transaction.productVariantSpecification.deleteMany(
        {
          where: { variantId: variant.id },
        },
      )

      for (const [
        specificationPosition,
        specification,
      ] of requestedVariant.specifications.entries()) {
        await transaction.productVariantSpecification.create(
          {
            data: {
              variantId: variant.id,
              key: specification.key,
              label: specification.label,
              value: specification.value,
              unit:
                specification.unit ?? null,
              position:
                specification.position ??
                specificationPosition,
            },
          },
        )
      }
    }
  }

  for (const axis of axes) {
    const option = optionByCode.get(
      axis.code,
    )

    if (!option) {
      continue
    }

    await transaction.productOptionValue.deleteMany({
      where: {
        optionId: option.id,
        selections: {
          none: {},
        },
      },
    })
  }

  return finishValueIds
}

async function replaceCompatibilities(
  transaction: ProductTransaction,
  productId: string,
  profile: ProductProfile,
  requestedCompatibilities: AdminProductWorkspaceInput['compatibilities'],
) {
  if (
    profile === 'wheels' &&
    requestedCompatibilities.length > 0
  ) {
    throw new AdminProductValidationError(
      'Jantes não usam compatibilidade por veículo. A adequação resulta das especificações da variante.',
    )
  }

  await transaction.productVehicleCompatibility.deleteMany(
    {
      where: { productId },
    },
  )

  for (const compatibility of requestedCompatibilities) {
    const vehicleModel =
      await transaction.vehicleModel.findUnique(
        {
          where: {
            id: compatibility.vehicleModelId,
          },
          select: {
            brandId: true,
            generations: {
              select: {
                id: true,
                configurations: {
                  select: { id: true },
                },
              },
            },
          },
        },
      )

    if (!vehicleModel) {
      throw new AdminProductValidationError(
        'Um dos modelos de veículos selecionados já não existe.',
      )
    }

    if (
      vehicleModel.brandId !==
      compatibility.vehicleBrandId
    ) {
      throw new AdminProductValidationError(
        'A marca e o modelo de veículo não pertencem à mesma hierarquia.',
      )
    }

    const generation =
      compatibility.vehicleGenerationId
        ? vehicleModel.generations.find(
            (item) =>
              item.id ===
              compatibility.vehicleGenerationId,
          )
        : null

    if (
      compatibility.vehicleGenerationId &&
      !generation
    ) {
      throw new AdminProductValidationError(
        'A geração selecionada não pertence ao modelo de veículo escolhido.',
      )
    }

    const configuration =
      compatibility.vehicleConfigurationId
        ? generation?.configurations.find(
            (item) =>
              item.id ===
              compatibility.vehicleConfigurationId,
          )
        : null

    if (
      compatibility.vehicleConfigurationId &&
      !configuration
    ) {
      throw new AdminProductValidationError(
        'O motor selecionado não pertence à geração escolhida.',
      )
    }

    await transaction.productVehicleCompatibility.create(
      {
        data: {
          productId,
          vehicleBrandId:
            compatibility.vehicleBrandId,
          vehicleModelId:
            compatibility.vehicleModelId,
          vehicleGenerationId:
            compatibility.vehicleGenerationId ??
            null,
          vehicleConfigurationId:
            compatibility.vehicleConfigurationId ??
            null,
          yearMin:
            compatibility.yearMin ?? null,
          yearMax:
            compatibility.yearMax ?? null,
        },
      },
    )
  }
}

function mapProduct(
  product: AdminProductRecord,
): AdminProduct {
  const mainlandRate =
    product.shippingRates[0]

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    isActive: product.isActive,
    images: product.images,
    defaultFinish:
      product.defaultFinish ?? null,
    imageMetadata:
      product.imageMetadata &&
      product.imageMetadata.length > 0
        ? product.imageMetadata.map(
            (image) => ({
              id: image.id,
              url: image.url,
              altText: image.altText,
              sortOrder: image.sortOrder,
              isPrimary: image.isPrimary,
              finish:
                image.finishValue?.option.code ===
                'finish'
                  ? image.finishValue.value
                  : null,
              finishValueId:
                image.finishValueId,
            }),
          )
        : product.images.map(
            (url, index) => ({
              id: `legacy-${index}`,
              url,
              altText: null,
              sortOrder: index,
              isPrimary: index === 0,
              finish: null,
              finishValueId: null,
            }),
          ),
    shippingClass: product.shippingClass,
    mainlandShippingCost:
      mainlandRate?.shippingCost.toString() ??
      null,
    category: product.category,
    brand: product.brand,
    variants: product.variants.map(
      (variant) => ({
        id: variant.id,
        sku: variant.sku,
        price: variant.price.toString(),
        stockQuantity:
          variant.stockQuantity,
        isActive: variant.isActive,
        position: variant.position,
        optionKey: variant.optionKey,
        options: variant.selections.map(
          ({ optionValue }) => ({
            code:
              optionValue.option.code,
            name:
              optionValue.option.name,
            value: optionValue.value,
          }),
        ),
        specifications:
          variant.specifications,
      }),
    ),
    compatibilities:
      product.compatibilities.map(
        (compatibility) => ({
          ...compatibility,
        }),
      ),
  }
}

async function getCategoryRecord(
  transaction: ProductTransaction,
  categoryId: string,
) {
  const category =
    await transaction.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })

  if (!category) {
    throw new AdminProductValidationError(
      'Categoria não encontrada',
    )
  }

  return category
}

async function assertBrandExists(
  transaction: ProductTransaction,
  productBrandId: string | null | undefined,
) {
  if (!productBrandId) {
    return
  }

  const brand =
    await transaction.productBrand.findUnique({
      where: { id: productBrandId },
      select: { id: true },
    })

  if (!brand) {
    throw new AdminProductValidationError(
      'Fabricante não encontrado',
    )
  }
}

function buildShippingRateUpdate(
  input: AdminProductWorkspaceInput,
) {
  if (
    input.shippingClass !== 'BULKY'
  ) {
    return {
      deleteMany: {
        region: 'PORTUGAL_MAINLAND' as const,
      },
    }
  }

  if (
    input.mainlandShippingCost == null
  ) {
    throw new AdminProductValidationError(
      'Produtos volumosos precisam de portes específicos para Portugal Continental.',
    )
  }

  const cents = Math.round(
    input.mainlandShippingCost * 100,
  )

  if (
    Math.abs(
      input.mainlandShippingCost * 100 -
        cents,
    ) > 0.000001
  ) {
    throw new AdminProductValidationError(
      'Os portes só podem ter duas casas decimais',
    )
  }

  return {
    deleteMany: {
      region: 'PORTUGAL_MAINLAND' as const,
    },
    create: {
      region: 'PORTUGAL_MAINLAND' as const,
      shippingCost:
        (cents / 100).toFixed(2),
    },
  }
}

export async function listAdminProducts(
  client?: AdminProductClient,
): Promise<AdminProduct[]> {
  const db = getClient(client)
  const products =
    await db.product.findMany({
      orderBy: { name: 'asc' },
      select: adminProductSelect,
    })

  return products.map(mapProduct)
}

export async function getAdminProduct(
  id: string,
  client?: AdminProductClient,
): Promise<AdminProduct> {
  validateId(id)
  const db = getClient(client)
  const product =
    await db.product.findUnique({
      where: { id },
      select: adminProductSelect,
    })

  if (!product) {
    throw new AdminProductNotFoundError(
      'Produto não encontrado',
    )
  }

  return mapProduct(product)
}

export async function createAdminProduct(
  input: unknown,
  client?: AdminProductClient,
): Promise<AdminProduct> {
  const data = parseInput(input)
  const db = getClient(client)

  const productId = await db.$transaction(
    async (transaction) => {
      const category =
        await getCategoryRecord(
          transaction,
          data.categoryId,
        )
      const profile = getProfile(category)

      validateCategoryFields(profile, data)
      validateDefaultFinish(profile, data)
      await assertBrandExists(
        transaction,
        data.productBrandId,
      )

      const slug = data.slug
        ? await createAvailableSlug(
            transaction,
            data.slug,
          )
        : await createAvailableSlug(
            transaction,
            data.name,
          )
      await ensureVariantSkus(
        transaction,
        data.name,
        data.variants,
      )
      const productSku =
        data.productSku?.trim() ||
        data.variants[0].sku!

      await assertProductSkuAvailable(
        transaction,
        productSku,
      )

      const shippingRates =
        buildShippingRateUpdate(data)

      const product =
        await transaction.product.create({
          data: {
            name: data.name,
            slug,
            sku: productSku,
            description:
              data.description || null,
            categoryId: data.categoryId,
            productBrandId:
              data.productBrandId ?? null,
            isActive: data.isActive,
            images: normalizeImages(
              data.images,
            ),
            defaultFinish:
              data.defaultFinish ?? null,
            shippingClass:
              data.shippingClass,
            ...(shippingRates.create
              ? {
                  shippingRates: {
                    create:
                      shippingRates.create,
                  },
                }
              : {}),
          },
          select: { id: true },
        })

      const finishValueIds =
        await replaceVariants(
          transaction,
          product.id,
          data.name,
          profile,
          data.variants,
        )
      await replaceProductImages(
        transaction,
        product.id,
        data,
        profile,
        finishValueIds,
      )
      await replaceCompatibilities(
        transaction,
        product.id,
        profile,
        data.compatibilities,
      )

      return product.id
    },
  )

  return getAdminProduct(
    productId,
    client,
  )
}

export async function updateAdminProduct(
  id: string,
  input: unknown,
  client?: AdminProductClient,
): Promise<AdminProduct> {
  validateId(id)
  const data = parseInput(input)
  const db = getClient(client)

  await db.$transaction(
    async (transaction) => {
      const existing =
        await transaction.product.findUnique(
          {
            where: { id },
            select: {
              id: true,
              sku: true,
              defaultFinish: true,
              category: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        )

      if (!existing) {
        throw new AdminProductNotFoundError(
          'Produto não encontrado',
        )
      }

      const category = await getCategoryRecord(
        transaction,
        data.categoryId,
      )
      const profile = getProfile(category)

      validateCategoryFields(profile, data)
      validateDefaultFinish(profile, data)
      await assertBrandExists(
        transaction,
        data.productBrandId,
      )

      const slug = buildSlug(
        data.slug?.trim() || data.name,
      )

      await assertSlugAvailable(
        transaction,
        slug,
        id,
      )

      const productSku =
        data.productSku?.trim() ||
        existing.sku

      if (!productSku) {
        throw new AdminProductValidationError(
          'SKU do produto é obrigatório',
        )
      }

      await assertProductSkuAvailable(
        transaction,
        productSku,
        id,
      )

      await ensureVariantSkus(
        transaction,
        data.name,
        data.variants,
      )

      if (
        profile === 'wheels'
      ) {
        const compatibilityCount =
          await transaction.productVehicleCompatibility.count(
            {
              where: { productId: id },
            },
          )

        if (
          data.compatibilities.length === 0 &&
          compatibilityCount > 0
        ) {
          throw new AdminProductValidationError(
            'Existem compatibilidades manuais nesta jante. Move o produto para outra categoria antes de as remover.',
          )
        }
      }

      const shippingRates =
        buildShippingRateUpdate(data)

      await transaction.product.update({
        where: { id },
        data: {
          name: data.name,
          slug,
          sku: productSku,
          description:
            data.description || null,
          categoryId: data.categoryId,
          productBrandId:
            data.productBrandId ?? null,
          isActive: data.isActive,
          images: normalizeImages(
            data.images,
          ),
          defaultFinish:
            profile === 'wheels'
              ? data.defaultFinish ===
                  undefined
                ? existing.defaultFinish ?? null
                : data.defaultFinish
              : null,
          shippingClass:
            data.shippingClass,
          shippingRates,
        },
      })

      const finishValueIds =
        await replaceVariants(
          transaction,
          id,
          data.name,
          profile,
          data.variants,
        )
      await replaceProductImages(
        transaction,
        id,
        data,
        profile,
        finishValueIds,
      )
      await replaceCompatibilities(
        transaction,
        id,
        profile,
        data.compatibilities,
      )
    },
  )

  return getAdminProduct(id, client)
}

export async function setAdminProductActive(
  id: string,
  isActive: boolean,
  client?: AdminProductClient,
) {
  validateId(id)
  const db = getClient(client)
  const existing =
    await db.product.findUnique({
      where: { id },
      select: { id: true },
    })

  if (!existing) {
    throw new AdminProductNotFoundError(
      'Produto não encontrado',
    )
  }

  await db.product.update({
    where: { id },
    data: { isActive },
  })

  return getAdminProduct(id, client)
}

type ProductDeletionInspection = {
  id: string
  name: string
  variantIds: string[]
  orderItems: number
  cartItems: number
  /** Números das encomendas que referenciam o produto. */
  orderNumbers: string[]
}

/**
 * Recolhe as referências reais que condicionam a eliminação:
 * - OrderItem é histórico de negócio (snapshot de compra) e
 *   bloqueia a eliminação permanente;
 * - CartItem é estado vivo de sessão, não é histórico, e é
 *   removido junto com o produto.
 * As linhas de encomenda são mantidas para identificar as
 * encomendas exatas que protegem o produto.
 */
async function inspectProductDeletion(
  transaction: ProductTransaction,
  productId: string,
): Promise<ProductDeletionInspection> {
  const product =
    await transaction.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
      },
    })

  if (!product) {
    throw new AdminProductNotFoundError(
      'Produto não encontrado',
    )
  }

  // Orders and payments have no direct Product foreign key; their historical
  // link is OrderItem. We still inspect the live OrderItem relations instead
  // of trusting only the purchase snapshots.
  // A direct product reference is already enough to protect the product.
  // The variant pass below is only needed for legacy/inconsistent rows that
  // still point at a variant without a matching productId.
  const referencingOrderItems =
    await transaction.orderItem.findMany({
      where: { productId },
      select: {
        id: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    })
  const cartItems =
    await transaction.cartItem.count({
      where: { productId },
    })

  let variantIds: string[] = []
  let orderItemsByVariant: Array<{
    order: { orderNumber: string }
  }> = []

  if (referencingOrderItems.length === 0) {
    const variants =
      await transaction.productVariant.findMany({
        where: { productId },
        select: { id: true },
      })
    variantIds = variants.map(
      (variant) => variant.id,
    )

    if (variantIds.length > 0) {
      orderItemsByVariant =
        await transaction.orderItem.findMany({
          where: {
            productVariantId: {
              in: variantIds,
            },
          },
          select: {
            order: {
              select: {
                orderNumber: true,
              },
            },
          },
        })
    }
  }

  const allOrderReferences = [
    ...referencingOrderItems,
    ...orderItemsByVariant,
  ]

  return {
    ...product,
    variantIds,
    orderItems: allOrderReferences.length,
    cartItems,
    orderNumbers: Array.from(
      new Set(
        allOrderReferences.map(
          (reference) =>
            reference.order.orderNumber,
        ),
      ),
    ),
  }
}

/**
 * Remove as linhas de carrinho que apontam para o produto
 * ou para as suas variantes. O carrinho é um estado de
 * sessão: não é histórico de negócio e não deve impedir a
 * eliminação de um produto.
 */
async function deleteProductCartReferences(
  transaction: ProductTransaction,
  productId: string,
  variantIds: string[],
) {
  await transaction.cartItem.deleteMany({
    where: {
      OR: [
        { productId },
        ...(variantIds.length > 0
          ? [
              {
                productVariantId: {
                  in: variantIds,
                },
              },
            ]
          : []),
      ],
    },
  })
}

export async function deleteAdminProduct(
  id: string,
  client?: AdminProductClient,
): Promise<AdminProductDeleteResult> {
  validateId(id)
  const db = getClient(client)

  return db.$transaction(
    async (transaction) => {
      const inspection =
        await inspectProductDeletion(
          transaction,
          id,
        )

      // Product-owned records (variants, options, images, compatibility
      // rows and shipping rates) cascade from Product in the schema.
      // Only real order history blocks permanent deletion; cart rows are
      // removed together with the product because they are live session
      // data, never business history.
      if (inspection.orderItems > 0) {
        const orderNumbers =
          inspection.orderNumbers
        const orderList =
          orderNumbers.length > 0
            ? ` (${orderNumbers.slice(0, 5).join(', ')}${orderNumbers.length > 5 ? ` e mais ${orderNumbers.length - 5}` : ''})`
            : ''

        await transaction.product.update({
          where: { id },
          data: { isActive: false },
        })

        return {
          id,
          name: inspection.name,
          status: 'archived' as const,
          reason: 'order_history' as const,
          orderNumbers,
          references: {
            orderItems: inspection.orderItems,
            cartItems: inspection.cartItems,
          },
          message: `Não foi possível eliminar ${inspection.name} porque está associado à${orderNumbers.length === 1 ? ' encomenda' : 's encomendas'}${orderList}. O produto foi arquivado para preservar o histórico de encomendas.`,
        }
      }

      await deleteProductCartReferences(
        transaction,
        id,
        inspection.variantIds,
      )

      await transaction.product.delete({
        where: { id },
      })

      return {
        id,
        name: inspection.name,
        status: 'deleted' as const,
        orderNumbers: [],
        references: {
          orderItems: 0,
          cartItems: inspection.cartItems,
        },
        message: `Produto eliminado permanentemente.${inspection.cartItems > 0 ? ` ${inspection.cartItems} linha${inspection.cartItems === 1 ? '' : 's'} de carrinho associada${inspection.cartItems === 1 ? '' : 's'} foi removida.` : ''}`,
      }
    },
  )
}

async function setProductActiveInTransaction(
  transaction: ProductTransaction,
  id: string,
  isActive: boolean,
) {
  validateId(id)
  const existing =
    await transaction.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    })

  if (!existing) {
    throw new AdminProductNotFoundError(
      'Produto não encontrado',
    )
  }

  await transaction.product.update({
    where: { id },
    data: { isActive },
  })

  return {
    ...existing,
    isActive,
  }
}

export async function bulkAdminProductAction(
  input: unknown,
  client?: AdminProductClient,
): Promise<AdminProductBulkResult> {
  const data = parseBulkActionInput(input)
  const db = getClient(client)
  const updated: AdminProductBulkResult['updated'] = []
  const deleted: AdminProductDeleteResult[] = []
  const archived: AdminProductDeleteResult[] = []
  const failed: AdminProductBulkFailure[] = []

  // Each product is handled in its own database transaction. This keeps a
  // single bad ID from rolling back safe products while still validating
  // existence and references on the server for every requested ID.
  for (const id of data.ids) {
    try {
      if (data.action === 'delete') {
        const result =
          await deleteAdminProduct(id, client)

        if (result.status === 'deleted') {
          deleted.push(result)
        } else {
          archived.push(result)
        }
        continue
      }

      const result = await db.$transaction(
        (transaction) =>
          setProductActiveInTransaction(
            transaction,
            id,
            data.action === 'activate',
          ),
      )
      updated.push(result)
    } catch (error) {
      failed.push({
        id,
        error: getBulkFailureMessage(
          error,
          data.action,
        ),
      })
    }
  }

  return {
    action: data.action,
    updated,
    deleted,
    archived,
    failed,
    counts: {
      requested: data.ids.length,
      updated: updated.length,
      deleted: deleted.length,
      archived: archived.length,
      failed: failed.length,
    },
  }
}

async function createCopySku(
  transaction: ProductTransaction,
  requestedSku: string,
) {
  const base =
    `${requestedSku}-COPY`.slice(0, 92)
  let candidate = base
  let suffix = 2

  while (
    await transaction.product.findFirst({
      where: { sku: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`.slice(
      0,
      100,
    )
    suffix += 1
  }

  return candidate
}

async function createCopyVariantSku(
  transaction: ProductTransaction,
  requestedSku: string,
) {
  const base =
    `${requestedSku}-COPY`.slice(0, 92)
  let candidate = base
  let suffix = 2

  while (
    await transaction.productVariant.findFirst({
      where: { sku: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`.slice(
      0,
      100,
    )
    suffix += 1
  }

  return candidate
}

export async function duplicateAdminProduct(
  id: string,
  client?: AdminProductClient,
): Promise<AdminProduct> {
  validateId(id)
  const source = await getAdminProduct(
    id,
    client,
  )
  const db = getClient(client)

  const copy = await db.$transaction(
    async (transaction) => {
      const category =
        await getCategoryRecord(
          transaction,
          source.category.id,
        )
      const profile = getProfile(category)
      const productSku =
        await createCopySku(
          transaction,
          source.sku,
        )
      const variants = []

      for (const variant of source.variants) {
        variants.push({
          sku: await createCopyVariantSku(
            transaction,
            variant.sku,
          ),
          price: Number(variant.price),
          stockQuantity:
            variant.stockQuantity,
          isActive: variant.isActive,
          optionKey: undefined,
          selections:
            Object.fromEntries(
              variant.options.map(
                (option) => [
                  option.code,
                  option.value,
                ],
              ),
            ),
          specifications:
            variant.specifications.map(
              (specification) => ({
                ...specification,
              }),
            ),
        })
      }

      if (variants.length === 0) {
        throw new AdminProductValidationError(
          'O produto não tem variantes para duplicar',
        )
      }

      const slug =
        await createAvailableSlug(
          transaction,
          `${source.name} cópia`,
        )
      const shippingRates: {
        create?: {
          region: 'PORTUGAL_MAINLAND'
          shippingCost: string
        }
      } = {}

      if (
        source.shippingClass === 'BULKY' &&
        source.mainlandShippingCost !== null
      ) {
        shippingRates.create = {
          region: 'PORTUGAL_MAINLAND',
          shippingCost:
            source.mainlandShippingCost,
        }
      }

      const product =
        await transaction.product.create({
          data: {
            name: `${source.name} (cópia)`,
            slug,
            sku: productSku,
            description:
              source.description,
            categoryId:
              source.category.id,
            productBrandId:
              source.brand?.id ?? null,
            isActive: false,
            images: [...source.images],
            defaultFinish:
              source.defaultFinish,
            shippingClass:
              source.shippingClass,
            ...(shippingRates.create
              ? {
                  shippingRates: {
                    create:
                      shippingRates.create,
                  },
                }
              : {}),
          },
          select: { id: true },
        })

      const finishValueIds =
        await replaceVariants(
          transaction,
          product.id,
          `${source.name} cópia`,
          profile,
          variants,
        )
      await replaceProductImages(
        transaction,
        product.id,
        {
          images: source.images,
          imageMetadata:
            source.imageMetadata.map(
              (image) => ({
                id: image.id,
                url: image.url,
                altText:
                  image.altText,
                sortOrder:
                  image.sortOrder,
                isPrimary:
                  image.isPrimary,
                finish:
                  image.finish,
              }),
            ),
        },
        profile,
        finishValueIds,
      )
      await replaceCompatibilities(
        transaction,
        product.id,
        profile,
        source.compatibilities.map(
          (compatibility) => ({
            vehicleBrandId:
              compatibility.vehicleBrandId,
            vehicleModelId:
              compatibility.vehicleModelId,
            vehicleGenerationId:
              compatibility.vehicleGenerationId,
            vehicleConfigurationId:
              compatibility.vehicleConfigurationId,
            yearMin:
              compatibility.yearMin,
            yearMax:
              compatibility.yearMax,
          }),
        ),
      )

      return product.id
    },
  )

  return getAdminProduct(
    copy,
    client,
  )
}
