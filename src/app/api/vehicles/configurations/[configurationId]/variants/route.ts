import { NextRequest } from 'next/server'

import {
  NotFoundError,
  ValidationError,
  findCompatibleVariantsForVehicleConfiguration,
} from '@/server/vehicle-search'

type RouteContext = {
  params: Promise<{
    configurationId: string
  }>
}

function handleError(error: unknown) {
  if (error instanceof ValidationError) {
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
  context: RouteContext,
) {
  const { configurationId } =
    await context.params

  try {
    const variants =
      await findCompatibleVariantsForVehicleConfiguration(
        configurationId,
      )

    return Response.json(variants, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}
