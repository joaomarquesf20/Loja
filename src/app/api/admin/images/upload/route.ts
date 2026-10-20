import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  ImageStorageError,
  storeImageFile,
} from '@/server/image-storage'

export const runtime = 'nodejs'

type UploadError = {
  fileName: string
  message: string
}

function jsonError(
  error: string,
  status: number,
) {
  return Response.json(
    { error },
    { status },
  )
}

export async function POST(
  request: Request,
) {
  try {
    await requireAdmin()

    const formData =
      await request.formData()
    const values = [
      ...formData.getAll('files'),
      ...formData.getAll('file'),
    ].filter(
      (value): value is File =>
        typeof value !== 'string',
    )

    if (values.length === 0) {
      return jsonError(
        'Seleciona pelo menos uma imagem.',
        400,
      )
    }

    if (values.length > 20) {
      return jsonError(
        'Podes enviar no máximo 20 imagens de uma vez.',
        400,
      )
    }

    const images: Array<{
      url: string
      originalName: string
      mimeType: string
      size: number
    }> = []
    const errors: UploadError[] = []

    for (const file of values) {
      try {
        const stored =
          await storeImageFile(file)
        images.push({
          url: stored.url,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
        })
      } catch (error) {
        errors.push({
          fileName:
            file.name || 'imagem',
          message:
            error instanceof
              ImageStorageError
              ? error.message
              : 'Não foi possível carregar esta imagem.',
        })
      }
    }

    return Response.json(
      {
        images,
        errors,
      },
      {
        status:
          images.length > 0 ? 200 : 400,
      },
    )
  } catch (error) {
    if (
      error instanceof
      UnauthorizedError
    ) {
      return jsonError(
        'Não autenticado',
        401,
      )
    }

    if (
      error instanceof
      AdminForbiddenError
    ) {
      return jsonError(
        'Sem autorização',
        403,
      )
    }

    if (
      error instanceof
      ImageStorageError
    ) {
      return jsonError(
        error.message,
        error.statusCode,
      )
    }

    console.error(
      'Unexpected image upload API error:',
      error,
    )
    return jsonError(
      'Erro interno do servidor',
      500,
    )
  }
}
