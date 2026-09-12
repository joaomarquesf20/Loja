import { z } from 'zod'

export const MAX_EMAIL_LENGTH = 254
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_BYTES = 72
export const MAX_QUANTITY = 1000
export const MAX_ID_LENGTH = 200

function utf8ByteLength(
  value: string,
) {
  return new TextEncoder().encode(
    value,
  ).length
}

/**
 * Email válido, sem espaços exteriores,
 * normalizado para lowercase e limitado
 * defensivamente.
 */
export const emailSchema = z
  .string()
  .trim()
  .max(MAX_EMAIL_LENGTH)
  .email()
  .transform((value) =>
    value.toLowerCase(),
  )

/**
 * Password:
 * - mínimo de 8 caracteres
 * - máximo de 72 bytes UTF-8
 *
 * O limite em bytes evita truncagem silenciosa
 * pelo bcrypt.
 */
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .refine(
    (value) =>
      utf8ByteLength(value) <=
      MAX_PASSWORD_BYTES,
    {
      message:
        'Password excede o limite de 72 bytes',
    },
  )

/**
 * Quantity:
 * - número
 * - inteiro
 * - positivo
 * - máximo defensivo
 */
export const quantitySchema = z
  .number()
  .int()
  .positive()
  .max(MAX_QUANTITY)

/**
 * ID:
 * - string
 * - trim
 * - não vazia
 * - comprimento máximo defensivo
 */
export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ID_LENGTH)