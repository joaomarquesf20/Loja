import { NextRequest, NextResponse } from 'next/server'

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  createVehicleGeneration,
  listVehicleGenerations,
} from '@/server/vehicle-generations'

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message },
      { status: 401 },
    )
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message },
      { status: 403 },
    )
  }

  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    )
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 },
    )
  }

  if (error instanceof ConflictError) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 },
    )
  }

  console.error(
    'Unexpected vehicle-generations API error:',
    error,
  )

  return NextResponse.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET(
  request: NextRequest,
) {
  try {
    await requireAdmin()

    const modelId =
      request.nextUrl.searchParams.get(
        'modelId',
      ) ?? ''

    const generations =
      await listVehicleGenerations(modelId)

    return NextResponse.json(
      generations,
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(
  request: Request,
) {
  try {
    await requireAdmin()

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'JSON inválido' },
        { status: 400 },
      )
    }

    const generation =
      await createVehicleGeneration(body)

    return NextResponse.json(
      generation,
      { status: 201 },
    )
  } catch (error) {
    return handleError(error)
  }
}