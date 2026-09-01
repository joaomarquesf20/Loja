import { z } from 'zod'

/**
 * Validação de ProductVehicleCompatibility para criação
 * - productId: string trim min 1 obrigatório
 * - vehicleConfigurationId: string trim min 1 obrigatório
 */
export const productCompatibilitySchema = z.object({
  productId: z.string().trim().min(1),
  vehicleConfigurationId: z.string().trim().min(1),
})

