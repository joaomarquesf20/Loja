import { z } from 'zod'

/**
 * Email válido, sem espaços exteriores e normalizado para lowercase.
 */
export const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) =>
    value.toLowerCase(),
  )

/**
 * Password - string, mínimo 8 caracteres.
 */
export const passwordSchema = z
  .string()
  .min(8)

/**
 * Quantity - number, inteiro, > 0.
 */
export const quantitySchema = z
  .number()
  .int()
  .positive()

/**
 * ID - string não vazia.
 */
export const idSchema = z
  .string()
  .trim()
  .min(1)
