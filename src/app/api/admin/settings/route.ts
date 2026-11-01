import {
  BrandingValidationError,
  getAdminStoreBranding,
  updateStoreBranding,
} from '@/server/branding-settings'
import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

/**
 * Épico white-label — configurações da loja (identidade da
 * vitrine). GET devolve a identidade resolvida (com defaults do
 * template) + os valores cruais (`null` = não configurado) para
 * pré preencher o formulário; PATCH grava com validação Zod.
 */

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json(
      { error: 'Não autenticado' },
      { status: 401 },
    )
  }

  if (error instanceof AdminForbiddenError) {
    return Response.json(
      { error: 'Sem autorização' },
      { status: 403 },
    )
  }

  if (error instanceof BrandingValidationError) {
    return Response.json(
      { error: error.message },
      { status: 400 },
    )
  }

  console.error(
    'Unexpected admin settings API error:',
    error,
  )

  return Response.json(
    { error: 'Erro interno do servidor' },
    { status: 500 },
  )
}

export async function GET() {
  try {
    await requireAdmin()

    const settings =
      await getAdminStoreBranding()

    return Response.json(
      {
        branding: settings.branding,
        raw: settings.raw,
      },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    await requireAdmin()

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return Response.json(
        { error: 'Dados inválidos' },
        { status: 400 },
      )
    }

    const branding =
      await updateStoreBranding(body)

    return Response.json(
      { branding },
      { status: 200 },
    )
  } catch (error) {
    return handleError(error)
  }
}
