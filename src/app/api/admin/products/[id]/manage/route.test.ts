import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock('@/server/admin-products', () => {
  class AdminProductConflictError extends Error {}
  class AdminProductNotFoundError extends Error {}
  class AdminProductValidationError extends Error {}
  class AdminProductFieldValidationError extends Error {
    fieldErrors: Record<string, string[]>

    constructor(
      fieldErrors: Record<string, string[]>,
      message = 'Alguns campos precisam de correção antes de guardar.',
    ) {
      super(message)
      this.fieldErrors = fieldErrors
    }
  }

  return {
    AdminProductConflictError,
    AdminProductNotFoundError,
    AdminProductValidationError,
    AdminProductFieldValidationError,
    toFieldValidationError: (error: {
      issues: Array<{
        path: ArrayLike<PropertyKey>
        message: string
      }>
    }) => {
      const fieldErrors: Record<
        string,
        string[]
      > = {}

      for (const issue of error.issues) {
        const key =
          issue.path.length > 0
            ? Array.from(issue.path).join('.')
            : '_form'

        fieldErrors[key] ??= []
        fieldErrors[key].push(issue.message)
      }

      return new AdminProductFieldValidationError(
        fieldErrors,
      )
    },
    deleteAdminProduct: vi.fn(),
    getAdminProduct: vi.fn(),
    setAdminProductActive: vi.fn(),
    updateAdminProduct: vi.fn(),
  }
})

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  AdminProductNotFoundError,
  deleteAdminProduct,
} from '@/server/admin-products'
import { DELETE } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockDeleteAdminProduct =
  vi.mocked(deleteAdminProduct)

function context() {
  return {
    params: Promise.resolve({
      id: 'product-test',
    }),
  }
}

function request() {
  return new Request(
    'http://localhost/api/admin/products/product-test/manage',
    { method: 'DELETE' },
  )
}

describe('Admin product workspace DELETE API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({
      user: {
        id: 'admin-test',
        role: 'ADMIN',
      },
    } as Awaited<ReturnType<typeof requireAdmin>>)
  })

  test('elimina ou arquiva o produto e devolve o resultado estruturado', async () => {
    const result = {
      id: 'product-test',
      name: 'Produto Teste',
      status: 'archived' as const,
      reason: 'order_history' as const,
      orderNumbers: ['PFA-TESTE-1'],
      references: {
        orderItems: 1,
        cartItems: 0,
      },
      message: 'Produto arquivado.',
    }
    mockDeleteAdminProduct.mockResolvedValue(
      result,
    )

    const response = await DELETE(
      request(),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      result,
    )
    expect(
      mockDeleteAdminProduct,
    ).toHaveBeenCalledWith('product-test')
  })

  test('devolve 404 sem tentar eliminar um produto inexistente', async () => {
    mockDeleteAdminProduct.mockRejectedValue(
      new AdminProductNotFoundError(
        'Produto não encontrado',
      ),
    )

    const response = await DELETE(
      request(),
      context(),
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: 'Produto não encontrado',
    })
  })

  test('devolve 401 sem autenticação', async () => {
    mockRequireAdmin.mockRejectedValue(
      new UnauthorizedError(),
    )

    const response = await DELETE(
      request(),
      context(),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Não autenticado',
    })
    expect(
      mockDeleteAdminProduct,
    ).not.toHaveBeenCalled()
  })

  test('devolve 403 sem autorização ADMIN', async () => {
    mockRequireAdmin.mockRejectedValue(
      new AdminForbiddenError(),
    )

    const response = await DELETE(
      request(),
      context(),
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Sem autorização',
    })
  })
})
