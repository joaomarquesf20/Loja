import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { ZodError } from 'zod'

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
    bulkAdminProductAction: vi.fn(),
  }
})

import {
  ForbiddenError as AdminForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  type AdminProductBulkResult,
  bulkAdminProductAction,
} from '@/server/admin-products'
import { POST } from './route'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockBulkAdminProductAction =
  vi.mocked(bulkAdminProductAction)

function request(body: unknown) {
  return new Request(
    'http://localhost/api/admin/products/bulk',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

describe('Admin bulk products API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({
      user: {
        id: 'admin-test',
        role: 'ADMIN',
      },
    } as Awaited<ReturnType<typeof requireAdmin>>)
  })

  test('devolve resultados parciais estruturados', async () => {
    const body = {
      ids: ['product-one', 'product-two'],
      action: 'delete',
    }
    const result: AdminProductBulkResult = {
      action: 'delete',
      updated: [],
      deleted: [
        {
          id: 'product-one',
          name: 'Produto Um',
          status: 'deleted',
          orderNumbers: [],
          references: {
            orderItems: 0,
            cartItems: 0,
          },
          message: 'Eliminado.',
        },
      ],
      archived: [
        {
          id: 'product-two',
          name: 'Produto Dois',
          status: 'archived',
          reason: 'order_history',
          orderNumbers: ['PFA-TESTE-2'],
          references: {
            orderItems: 1,
            cartItems: 0,
          },
          message: 'Arquivado.',
        },
      ],
      failed: [],
      counts: {
        requested: 2,
        updated: 0,
        deleted: 1,
        archived: 1,
        failed: 0,
      },
    }
    mockBulkAdminProductAction.mockResolvedValue(
      result,
    )

    const response = await POST(request(body))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(result)
    expect(
      mockBulkAdminProductAction,
    ).toHaveBeenCalledWith(body)
  })

  test('rejeita action inválida com 400 e erros por campo', async () => {
    const invalidActionIssue = {
      code: 'invalid_value',
      path: ['action'],
      message:
        'Opção inválida: esperava uma de "activate" | "deactivate" | "delete"',
    } as never

    mockBulkAdminProductAction.mockRejectedValue(
      new ZodError([invalidActionIssue]),
    )

    const response = await POST(
      request({
        ids: ['product-one'],
        action: 'remove-everything',
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error:
        'Alguns campos precisam de correção antes de guardar.',
      fieldErrors: {
        action: [
          'Opção inválida: esperava uma de "activate" | "deactivate" | "delete"',
        ],
      },
    })
    expect(
      mockBulkAdminProductAction,
    ).toHaveBeenCalledWith({
      ids: ['product-one'],
      action: 'remove-everything',
    })
  })

  test('devolve 401 sem autenticação', async () => {
    mockRequireAdmin.mockRejectedValue(
      new UnauthorizedError(),
    )

    const response = await POST(
      request({
        ids: ['product-one'],
        action: 'activate',
      }),
    )

    expect(response.status).toBe(401)
    expect(
      mockBulkAdminProductAction,
    ).not.toHaveBeenCalled()
  })

  test('devolve 403 sem autorização ADMIN', async () => {
    mockRequireAdmin.mockRejectedValue(
      new AdminForbiddenError(),
    )

    const response = await POST(
      request({
        ids: ['product-one'],
        action: 'activate',
      }),
    )

    expect(response.status).toBe(403)
    expect(
      mockBulkAdminProductAction,
    ).not.toHaveBeenCalled()
  })

  test('devolve 400 para JSON inválido', async () => {
    const malformedRequest = new Request(
      'http://localhost/api/admin/products/bulk',
      {
        method: 'POST',
        body: '{',
      },
    )

    const response = await POST(malformedRequest)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error:
        'O corpo da operação em massa tem de ser JSON válido',
    })
  })
})
