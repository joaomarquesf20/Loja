import { z } from 'zod'
import { toSlug } from './slug'

/**
 * Validação de Category para criação
 * - name: string trim min 1 max 120
 * - slug: string trim min 1 normalizado com toSlug()
 * - description opcional
 * - parentId opcional ou null
 */
export const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((val) => toSlug(val))
    .pipe(z.string().min(1)),
  description: z.string().optional(),
  parentId: z
    .union([z.string().trim().min(1), z.null()])
    .optional(),
})

/**
 * Validação de Category para atualização
 * (todos os campos opcionais)
 */
export const categoryUpdateSchema =
  categorySchema.partial()

/**
 * Validação de ProductBrand para criação
 * - name: string trim min 1 max 120
 * - slug: string trim min 1 normalizado com toSlug()
 */
export const productBrandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((val) => toSlug(val))
    .pipe(z.string().min(1)),
})

/**
 * Validação de ProductBrand para atualização
 * (todos os campos opcionais)
 */
export const productBrandUpdateSchema =
  productBrandSchema.partial()

const productImageSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
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
    },
    'Imagem tem de ser um URL HTTP/HTTPS ou um caminho relativo',
  )

/**
 * Classes que podem ser atribuídas manualmente
 * a um produto no Admin.
 *
 * UNASSIGNED fica deliberadamente excluído:
 * apenas produtos históricos podem continuar nesse estado.
 */
export const productShippingClassSchema = z.enum([
  'SMALL',
  'STANDARD',
  'BULKY',
  'HEAVY',
  'QUOTE_REQUIRED',
])

const productBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform((val) => toSlug(val))
    .pipe(z.string().min(1)),
  sku: z.string().trim().min(1).max(100),
  description: z.string().optional(),
  price: z.number().finite().min(0),
  stockQuantity: z.number().int().min(0),
  categoryId: z.string().trim().min(1),
  productBrandId: z
    .union([z.string().trim().min(1), z.null()])
    .optional(),
  isActive: z.boolean().optional(),
  images: z
    .array(productImageSchema)
    .max(20)
    .optional(),

  shippingClass: productShippingClassSchema,

  /**
   * Tarifa específica do produto para Portugal Continental.
   *
   * Só é utilizada por BULKY.
   * Os limites monetários concretos são validados no service
   * contra a configuração comercial atual.
   */
  mainlandShippingCost: z
    .number()
    .finite()
    .min(0)
    .nullable()
    .optional(),
})

/**
 * Validação de Product para criação.
 *
 * BULKY precisa sempre de tarifa específica.
 * As restantes classes não podem guardar uma tarifa individual.
 */
export const productSchema =
  productBaseSchema.superRefine((data, ctx) => {
    if (
      data.shippingClass === 'BULKY' &&
      data.mainlandShippingCost == null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['mainlandShippingCost'],
        message:
          'Artigos volumosos precisam de portes específicos',
      })
    }

    if (
      data.shippingClass !== 'BULKY' &&
      data.mainlandShippingCost != null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['mainlandShippingCost'],
        message:
          'Portes específicos só são permitidos em artigos volumosos',
      })
    }
  })

/**
 * Atualizações continuam parciais.
 *
 * As regras que dependem do estado atual do produto
 * são verificadas em src/server/products.ts.
 */
export const productUpdateSchema =
  productBaseSchema.partial()
