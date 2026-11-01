import { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import {
  NotFoundError,
  ValidationError,
  getVehicleSpecs,
} from '@/server/vehicles'

/**
 * Épico 8 — GET /api/vehicles/specs?modelId=...: lista de
 * especificações (fitment) de um modelo — motor, código, anos,
 * combustível e potência (terceiro nível do seletor).
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
    'Unexpected vehicle-specs API error:',
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
  const modelId =
    request.nextUrl.searchParams.get(
      'modelId',
    ) ?? ''

  try {
    const specs =
      await getVehicleSpecs(modelId)

    return Response.json(
      { specs },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
