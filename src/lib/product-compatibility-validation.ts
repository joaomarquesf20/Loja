import { z } from 'zod'

/**
 * Validação de ProductCompatibility para criação (Épico 8)
 * - productId: string trim min 1 obrigatório
 * - vehicleSpecId: string trim min 1 obrigatório
 * - notes: nota opcional do administrador (vira null quando vazia)
 */
export const productCompatibilitySchema = z.object({
  productId: z.string().trim().min(1),
  vehicleSpecId: z.string().trim().min(1),
  notes: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
})
