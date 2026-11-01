import { ZodError } from 'zod'

import {
  ValidationError,
  getVehicleMakes,
} from '@/server/vehicles'

/**
 * Épico 8 — GET /api/vehicles/makes: lista de marcas de veículos
 * (primeiro nível do seletor de compatibilidade).
 */
function handleError(error: unknown) {
  if (
    error instanceof ZodError ||
    error instanceof ValidationError
  ) {
    return Response.json(
      { error: 'Dados inválidos' },
      { status: 400 },
    )
  }

  console.error(
    'Unexpected vehicle-makes API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET() {
  try {
    const makes =
      await getVehicleMakes()

    return Response.json(
      { makes },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
