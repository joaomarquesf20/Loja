import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const {
  requireAdminMock,
  previewMock,
  commitMock,
  UnauthorizedError,
  ForbiddenError,
} = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    requireAdminMock: vi.fn(),
    previewMock: vi.fn(),
    commitMock: vi.fn(),
    UnauthorizedError,
    ForbiddenError,
  }
})

vi.mock('@/server/admin-auth', () => ({
  UnauthorizedError,
  ForbiddenError,
  requireAdmin: requireAdminMock,
}))

vi.mock(
  '@/server/catalog-import-service',
  () => ({
    previewCatalogImport: previewMock,
    commitCatalogImport: commitMock,
    listImportHistory: vi.fn(),
  }),
)

import { POST as previewPost } from './preview/route'
import { POST as commitPost } from './commit/route'

function jsonRequest(
  path: string,
  body: unknown,
) {
  return new Request(`https://test.local${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const validBody = {
  fileText:
    'Product;SKU;Price\nVeemann MF-Z7;VMFZ7-001;299,90',
  fileName: 'catalog.csv',
  mapping: {
    productName: 'Product',
    sku: 'SKU',
    price: 'Price',
  },
  profile: 'wheels',
  mode: 'create-update',
}

describe('import routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('preview exige autenticação de admin', async () => {
    requireAdminMock.mockRejectedValueOnce(
      new UnauthorizedError('Não autenticado'),
    )

    const response = await previewPost(
      jsonRequest(
        '/api/admin/import/preview',
        validBody,
      ),
    )

    expect(response.status).toBe(401)
    expect(previewMock).not.toHaveBeenCalled()
  })

  test('preview devolve a pré-visualização do motor', async () => {
    requireAdminMock.mockResolvedValueOnce({
      user: { id: 'admin-1' },
    })
    previewMock.mockResolvedValueOnce({
      profile: 'wheels',
      mode: 'create-update',
      productsToCreate: 1,
      productsToUpdate: 0,
      variantsToCreate: 3,
      variantsToUpdate: 0,
      products: [],
      errors: [],
      warnings: [],
      totalRows: 3,
    })

    const response = await previewPost(
      jsonRequest(
        '/api/admin/import/preview',
        validBody,
      ),
    )
    const body = (await response.json()) as {
      variantsToCreate: number
    }

    expect(response.status).toBe(200)
    expect(body.variantsToCreate).toBe(3)
  })

  test('preview devolve erro de ficheiro vazio', async () => {
    requireAdminMock.mockResolvedValueOnce({
      user: { id: 'admin-1' },
    })

    const response = await previewPost(
      jsonRequest(
        '/api/admin/import/preview',
        {
          ...validBody,
          fileText: '',
        },
      ),
    )

    expect(response.status).toBe(400)
  })

  test('commit exige admin e devolve o resultado', async () => {
    requireAdminMock.mockResolvedValueOnce({
      user: { id: 'admin-1' },
    })
    commitMock.mockResolvedValueOnce({
      id: 'import-1',
      status: 'success',
      createdProducts: 1,
      updatedProducts: 0,
      createdVariants: 3,
      updatedVariants: 0,
      generatedSkus: 0,
      collisions: 0,
      errorCount: 0,
      errors: [],
      warnings: [],
    })

    const response = await commitPost(
      jsonRequest(
        '/api/admin/import/commit',
        validBody,
      ),
    )
    const body = (await response.json()) as {
      status: string
      createdVariants: number
    }

    expect(response.status).toBe(200)
    expect(body.status).toBe('success')
    expect(body.createdVariants).toBe(3)
    expect(commitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 'admin-1',
        mode: 'create-update',
      }),
    )
  })

  test('commit aceita skuStrategy, failureMode e overrides', async () => {
    requireAdminMock.mockResolvedValueOnce({
      user: { id: 'admin-1' },
    })
    commitMock.mockResolvedValueOnce({
      id: 'import-1',
      status: 'success',
      createdProducts: 1,
      updatedProducts: 0,
      createdVariants: 1,
      updatedVariants: 0,
      generatedSkus: 0,
      collisions: 0,
      errorCount: 0,
      errors: [],
      warnings: [],
    })

    const response = await commitPost(
      jsonRequest(
        '/api/admin/import/commit',
        {
          ...validBody,
          skuStrategy: 'auto',
          failureMode: 'partial',
          skuOverrides: { 2: 'MANUAL-01' },
        },
      ),
    )

    expect(response.status).toBe(200)
    expect(commitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skuStrategy: 'auto',
        failureMode: 'partial',
        skuOverrides: { 2: 'MANUAL-01' },
      }),
    )
  })

  test('commit rejeita skuStrategy inválida (400)', async () => {
    requireAdminMock.mockResolvedValueOnce({
      user: { id: 'admin-1' },
    })

    const response = await commitPost(
      jsonRequest(
        '/api/admin/import/commit',
        {
          ...validBody,
          skuStrategy: 'aleatoria',
        },
      ),
    )

    expect(response.status).toBe(400)
    expect(commitMock).not.toHaveBeenCalled()
  })

  test('commit devolve erro do motor (linhas inválidas)', async () => {
    requireAdminMock.mockResolvedValueOnce({
      user: { id: 'admin-1' },
    })
    commitMock.mockResolvedValueOnce({
      error: 'O ficheiro tem 2 linha(s) inválida(s). Corrige e volta a importar.',
    })

    const response = await commitPost(
      jsonRequest(
        '/api/admin/import/commit',
        validBody,
      ),
    )

    expect(response.status).toBe(400)

    const body = (await response.json()) as {
      error: string
    }

    expect(body.error).toContain('inválida')
  })
})
