import { NextRequest } from 'next/server'
import { ZodError } from 'zod'

import {
  ValidationError,
  getCompatibleProductIds,
} from '@/server/vehicles'

/**
 * Épico 8 — GET /api/vehicles/compatible-products?specId=...:
 * ids dos produtos ativos compatíveis com uma especificação de
 * veículo. Alimenta a filtragem client-side da grelha de
 * categoria (VehicleCompatibleProducts).
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
    'Unexpected compatible-products API error:',
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
  const specId =
    request.nextUrl.searchParams.get(
      'specId',
    ) ?? ''

  try {
    const productIds =
      await getCompatibleProductIds({
        vehicleSpecId: specId,
      })

    return Response.json({
      productIds,
    })
  } catch (error) {
    return handleError(error)
  }
}
