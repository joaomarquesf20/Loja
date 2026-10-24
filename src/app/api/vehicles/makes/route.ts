import {
  ValidationError,
  listVehicleMakes,
} from '@/server/vehicle-search'

function handleError(error: unknown) {
  if (error instanceof ValidationError) {
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
    const vehicleMakes =
      await listVehicleMakes()

    return Response.json(vehicleMakes, {
      status: 200,
    })
  } catch (error) {
    return handleError(error)
  }
}
