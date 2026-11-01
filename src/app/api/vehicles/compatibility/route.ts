import { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import {
  ValidationError,
  checkProductCompatibility,
} from '@/server/vehicles'

/**
 * Épico 8 — GET /api/vehicles/compatibility?productId=...&specId=...:
 * estado de compatibilidade de um produto com uma especificação de
 * veículo, incluindo as notas do administrador.
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
    'Unexpected vehicle-compatibility API error:',
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
  const productId =
    request.nextUrl.searchParams.get(
      'productId',
    ) ?? ''
  const specId =
    request.nextUrl.searchParams.get(
      'specId',
    ) ?? ''

  try {
    const status =
      await checkProductCompatibility({
        productId,
        vehicleSpecId: specId,
      })

    return Response.json(status, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}
