import { ZodError } from 'zod'
import {
  ConflictError,
  ValidationError,
  createCategory,
  listCategories,
} from '@/server/categories'
import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }

  if (error instanceof AdminForbiddenError) {
    return Response.json({ error: 'Sem autorização' }, { status: 403 })
  }

  if (error instanceof ZodError || error instanceof ValidationError) {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  if (error instanceof ConflictError) {
    return Response.json({ error: error.message }, { status: 409 })
  }

  console.error('Unexpected categories API error:', error)

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET() {
  try {
    await requireAdmin()

    const categories = await listCategories()

    return Response.json(categories, { status: 200 })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const category = await createCategory(body)

    return Response.json(category, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}