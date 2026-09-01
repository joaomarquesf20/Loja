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
  slug: z.string()
    .trim()
    .min(1)
    .transform((val) => toSlug(val))
    .pipe(z.string().min(1)),
  description: z.string().optional(),
  parentId: z.union([z.string().trim().min(1), z.null()]).optional(),
})

/**
 * Validação de Category para atualização (todos os campos opcionais)
 */
export const categoryUpdateSchema = categorySchema.partial()

/**
 * Validação de ProductBrand para criação
 * - name: string trim min 1 max 120
 * - slug: string trim min 1 normalizado com toSlug()
 */
export const productBrandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string()
    .trim()
    .min(1)
    .transform((val) => toSlug(val))
    .pipe(z.string().min(1)),
})

/**
 * Validação de ProductBrand para atualização (todos os campos opcionais)
 */
export const productBrandUpdateSchema = productBrandSchema.partial()

/**
 * Validação de Product para criação
 * - name: string trim min 1 max 200
 * - slug: string trim min 1 normalizado com toSlug() obrigatório após normalização
 * - sku: string trim min 1 max 100
 * - description: opcional
 * - price: número >= 0, não aceita NaN/Infinity
 * - stockQuantity: integer >= 0
 * - categoryId: string trim min 1 (obrigatório)
 * - productBrandId: opcional, aceita string não vazia ou null
 * - isActive: boolean opcional
 */
export const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string()
    .trim()
    .min(1)
    .transform((val) => toSlug(val))
    .pipe(z.string().min(1)),
  sku: z.string().trim().min(1).max(100),
  description: z.string().optional(),
  price: z.number()
    .finite()
    .min(0),
  stockQuantity: z.number().int().min(0),
  categoryId: z.string().trim().min(1),
  productBrandId: z.union([z.string().trim().min(1), z.null()]).optional(),
  isActive: z.boolean().optional(),
})

/**
 * Validação de Product para atualização (todos os campos opcionais)
 */
export const productUpdateSchema = productSchema.partial()

