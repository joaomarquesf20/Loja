import { ZodError } from 'zod'
import {
  ConflictError,
  ForbiddenError as CategoryForbiddenError,
  NotFoundError,
  ValidationError,
  deleteCategory,
  getCategoryById,
  updateCategory,
} from '@/server/categories'
import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }

  if (error instanceof AdminForbiddenError) {
    return Response.json({ error: 'Sem autorização' }, { status: 403 })
  }

  if (
    error instanceof ZodError ||
    error instanceof ValidationError ||
    error instanceof CategoryForbiddenError
  ) {
    return Response.json({ error: error.message }, { status: 400 })
  }

  if (error instanceof NotFoundError) {
    return Response.json({ error: error.message }, { status: 404 })
  }

  if (error instanceof ConflictError) {
    return Response.json({ error: error.message }, { status: 409 })
  }

  console.error('Unexpected category API error:', error)

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params
    const category = await getCategoryById(id)

    return Response.json(category, { status: 200 })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params
    const body = await request.json()
    const category = await updateCategory(id, body)

    return Response.json(category, { status: 200 })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    await requireAdmin()

    const { id } = await params
    const category = await deleteCategory(id)

    return Response.json(category, { status: 200 })
  } catch (error) {
    return handleError(error)
  }
}