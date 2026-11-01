import { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import {
  NotFoundError,
  ValidationError,
  getVehicleModels,
} from '@/server/vehicles'

/**
 * Épico 8 — GET /api/vehicles/models?makeId=...: lista de modelos de
 * uma marca (segundo nível do seletor de compatibilidade).
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

  if (error instanceof NotFoundError) {
    return Response.json(
      { error: error.message },
      { status: 404 },
    )
  }

  console.error(
    'Unexpected vehicle-models API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET(
  request: NextRequest,
) {
  const makeId =
    request.nextUrl.searchParams.get(
      'makeId',
    ) ?? ''

  try {
    const models =
      await getVehicleModels(makeId)

    return Response.json(
      { models },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
