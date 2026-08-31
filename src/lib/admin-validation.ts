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

