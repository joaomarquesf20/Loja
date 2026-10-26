import {
  InventoryNotFoundError,
  InventoryValidationError,
  listLowStockVariants,
  normalizeLowStockThreshold,
  updateVariantStock,
} from '@/server/inventory'
import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'

function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json(
      {
        error: 'Não autenticado',
      },
      {
        status: 401,
      },
    )
  }

  if (error instanceof AdminForbiddenError) {
    return Response.json(
      {
        error: 'Sem autorização',
      },
      {
        status: 403,
      },
    )
  }

  if (error instanceof InventoryNotFoundError) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: 404,
      },
    )
  }

  if (
    error instanceof
    InventoryValidationError
  ) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: 400,
      },
    )
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      {
        error: 'JSON inválido',
      },
      {
        status: 400,
      },
    )
  }

  console.error(
    'Unexpected inventory API error:',
    error,
  )

  return Response.json(
    {
      error: 'Erro interno do servidor',
    },
    {
      status: 500,
    },
  )
}

export async function GET(
  request: Request,
) {
  try {
    await requireAdmin()

    const threshold =
      normalizeLowStockThreshold(
        new URL(request.url).searchParams.get(
          'threshold',
        ) ?? undefined,
      )

    const variants =
      await listLowStockVariants({
        threshold,
      })

    return Response.json(
      {
        threshold,
        variants,
      },
      {
        status: 200,
      },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    // Épico 6: o admin autenticado é registado como ator do movimento
    // MANUAL_ADJUSTMENT no histórico de stock.
    const session =
      await requireAdmin()

    const body: unknown =
      await request.json()

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      throw new InventoryValidationError(
        'variantId',
        'Correção de stock inválida',
      )
    }

    const result =
      await updateVariantStock(
        body as {
          variantId: unknown
          stock: unknown
        },
        undefined,
        session.user.id,
      )

    return Response.json(
      result,
      {
        status: 200,
      },
    )
  } catch (error) {
    return handleError(error)
  }
}
