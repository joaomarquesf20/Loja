import { z, ZodError } from 'zod'

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  previewCatalogImport,
} from '@/server/catalog-import-service'
import {
  IMPORT_FIELDS,
  SKU_STRATEGIES,
} from '@/lib/catalog-import'
import type {
  ImportField,
  ImportMode,
  ImportProfile,
} from '@/server/catalog-import-types'

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

  if (error instanceof ZodError) {
    return Response.json(
      { error: 'Pedido inválido.' },
      { status: 400 },
    )
  }

  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível pré-visualizar a importação.',
    },
    { status: 500 },
  )
}

const fieldKeySet = new Set<string>(
  IMPORT_FIELDS,
)

// O cliente envia mapping no sentido campo -> coluna
// (ex.: { productName: 'Wheel Name' }). Entradas
// desconhecidas são ignoradas em vez de rejeitadas.
const mappingSchema = z
  .record(
    z.string().min(1),
    z.string().trim().min(1),
  )
  .transform((record) => {
    const mapping: Partial<
      Record<ImportField, string>
    > = {}

    for (const [
      field,
      column,
    ] of Object.entries(record)) {
      if (fieldKeySet.has(field)) {
        mapping[field as ImportField] = column
      }
    }

    return mapping
  })
  .optional()

const bodySchema = z.object({
  fileText: z.string().min(1).max(8_000_000),
  fileName: z.string().trim().min(1).max(255),
  mapping: mappingSchema,
  profile: z
    .enum([
      'wheels',
      'suspension',
      'exterior',
      'generic',
    ])
    .optional(),
  mode: z
    .enum(['create-only', 'create-update'])
    .default('create-update'),
  skuStrategy: z
    .enum(SKU_STRATEGIES)
    .optional(),
  skuOverrides: z
    .record(
      z.coerce.number().int().positive(),
      z.string().trim().min(1).max(100),
    )
    .optional(),
})

export async function POST(
  request: Request,
) {
  try {
    await requireAdmin()

    const body = bodySchema.parse(
      await request.json(),
    )

    const preview =
      await previewCatalogImport({
        fileText: body.fileText,
        fileName: body.fileName,
        mapping: body.mapping,
        profile: body
          .profile as ImportProfile,
        mode: body.mode as ImportMode,
        skuStrategy: body.skuStrategy,
        skuOverrides: body.skuOverrides,
      })

    if ('error' in preview) {
      return Response.json(
        { error: preview.error },
        { status: 400 },
      )
    }

    return Response.json(preview)
  } catch (error) {
    return handleError(error)
  }
}
