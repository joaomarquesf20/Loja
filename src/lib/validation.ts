import { z } from 'zod'

/**
 * Validação de email - string, email válido
 */
export const emailSchema = z.string().email()

/**
 * Validação de password - string, mínimo 8 caracteres
 */
export const passwordSchema = z.string().min(8)

/**
 * Validação de quantity - number, inteiro, > 0
 */
export const quantitySchema = z.number().int().positive()

/**
 * Validação de id - string, não vazia (rejeita strings vazias ou só com espaços)
 */
export const idSchema = z.string().trim().min(1)