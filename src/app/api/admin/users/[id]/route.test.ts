import { ZodError } from 'zod'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  '@/server/admin-auth',
  () => {
    class UnauthorizedError extends Error {}
    class ForbiddenError extends Error {}

    return {
      UnauthorizedError,
      ForbiddenError,
      requireAdmin: vi.fn(),
    }
  },
)

vi.mock(
  '@/server/admin-users',
  () => ({
    AdminUserNotFoundError:
      class AdminUserNotFoundError extends Error {},
    AdminUserSelfUpdateError:
      class AdminUserSelfUpdateError extends Error {},
    AdminUserValidationError:
      class AdminUserValidationError extends Error {},
    getAdminUserById:
      vi.fn(),
    updateAdminUser:
      vi.fn(),
  }),
)

vi.mock(
  '@/server/http-request',
  () => ({
    InvalidJsonBodyError:
      class InvalidJsonBodyError extends Error {},
    RequestPayloadTooLargeError:
      class RequestPayloadTooLargeError extends Error {},
    readJsonBody:
      vi.fn(),
  }),
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  AdminUserNotFoundError,
  AdminUserSelfUpdateError,
  AdminUserValidationError,
  getAdminUserById,
  updateAdminUser,
} from '@/server/admin-users'
import {
  InvalidJsonBodyError,
  readJsonBody,
} from '@/server/http-request'
import {
  GET,
  PATCH,
} from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockGetAdminUserById =
  vi.mocked(getAdminUserById)

const mockUpdateAdminUser =
  vi.mocked(updateAdminUser)

const mockReadJsonBody =
  vi.mocked(readJsonBody)

const routeContext = {
  params: Promise.resolve({
    id: 'user-1',
  }),
}

function createPatchRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/users/user-1',
    {
      method: 'PATCH',
      headers: {
        'content-type':
          'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

describe(
  'Admin User Detail API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRequireAdmin.mockResolvedValue(
        {
          user: {
            id: 'admin-1',
            role: 'ADMIN',
          },
        } as Awaited<
          ReturnType<
            typeof requireAdmin
          >
        >,
      )
    })

    test(
      'detalhe devolve utilizador para administrador autenticado',
      async () => {
        const user = {
          id: 'user-1',
          email:
            'cliente@example.com',
          name: 'Cliente Teste',
          role: 'BUYER',
          isActive: true,
          createdAt:
            new Date(
              '2026-08-01T00:00:00.000Z',
            ),
          ordersCount: 2,
          totalExpenditure:
            '128.00',
          orders: [],
        }

        mockGetAdminUserById.mockResolvedValue(
          user as Awaited<
            ReturnType<
              typeof getAdminUserById
            >
          >,
        )

        const response =
          await GET(
            new Request(
              'http://localhost/api/admin/users/user-1',
            ),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          user: {
            ...user,
            createdAt:
              user.createdAt.toISOString(),
          },
        })

        expect(
          mockGetAdminUserById,
        ).toHaveBeenCalledWith(
          'user-1',
        )
      },
    )

    test(
      'detalhe devolve 404 quando o utilizador não existe',
      async () => {
        mockGetAdminUserById.mockResolvedValue(
          null,
        )

        const response =
          await GET(
            new Request(
              'http://localhost/api/admin/users/user-404',
            ),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(404)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Utilizador não encontrado',
        })
      },
    )

    test(
      'detalhe devolve 401 sem autenticação',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const response =
          await GET(
            new Request(
              'http://localhost/api/admin/users/user-1',
            ),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          mockGetAdminUserById,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'update aplica papel e estado e devolve o utilizador',
      async () => {
        const updatedUser = {
          id: 'user-1',
          email:
            'cliente@example.com',
          name: 'Cliente Teste',
          role: 'SELLER',
          isActive: false,
          ordersCount: 2,
        }

        mockReadJsonBody.mockResolvedValue(
          {
            role: 'SELLER',
            isActive: false,
          },
        )

        mockUpdateAdminUser.mockResolvedValue(
          updatedUser as Awaited<
            ReturnType<
              typeof updateAdminUser
            >
          >,
        )

        const response =
          await PATCH(
            createPatchRequest({
              role: 'SELLER',
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          user: updatedUser,
        })

        expect(
          mockUpdateAdminUser,
        ).toHaveBeenCalledWith(
          'user-1',
          {
            role: 'SELLER',
            isActive: false,
          },
          'admin-1',
        )
      },
    )

    test(
      'update devolve 400 com fieldErrors para corpo inválido',
      async () => {
        mockReadJsonBody.mockResolvedValue(
          {
            role: 'MANAGER',
          },
        )

        mockUpdateAdminUser.mockRejectedValue(
          new ZodError([
            {
              code: 'custom',
              path: ['role'],
              message:
                'Papel de utilizador inválido.',
            } as never,
          ]),
        )

        const response =
          await PATCH(
            createPatchRequest({
              role: 'MANAGER',
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(400)

        const payload =
          (await response.json()) as {
            error: string
            fieldErrors: Record<
              string,
              string[]
            >
          }

        expect(
          payload.error,
        ).toContain(
          'correção',
        )

        expect(
          payload.fieldErrors,
        ).toHaveProperty(
          'role',
        )
      },
    )

    test(
      'update devolve 404 quando o utilizador não existe',
      async () => {
        mockReadJsonBody.mockResolvedValue(
          {
            isActive: false,
          },
        )

        mockUpdateAdminUser.mockRejectedValue(
          new AdminUserNotFoundError(),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(404)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Utilizador não encontrado',
        })
      },
    )

    test(
      'update devolve 409 quando o administrador tenta bloquear-se a si próprio',
      async () => {
        mockReadJsonBody.mockResolvedValue(
          {
            isActive: false,
          },
        )

        mockUpdateAdminUser.mockRejectedValue(
          new AdminUserSelfUpdateError(
            'Não é possível alterar o seu próprio papel ou desativar a sua conta.',
          ),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(409)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Não é possível alterar o seu próprio papel ou desativar a sua conta.',
        })
      },
    )

    test(
      'update devolve 401 sem autenticação e 400 para corpo inválido',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const unauthorized =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          unauthorized.status,
        ).toBe(401)

        expect(
          mockReadJsonBody,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'update devolve 400 para JSON inválido',
      async () => {
        mockReadJsonBody.mockRejectedValue(
          new InvalidJsonBodyError(),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Dados inválidos',
        })
      },
    )

    test(
      'update devolve 403 sem autorização ADMIN',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new ForbiddenError(),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(403)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Sem autorização',
        })
      },
    )

    test(
      'update devolve 400 para identificador vazio',
      async () => {
        mockReadJsonBody.mockResolvedValue(
          {
            isActive: false,
          },
        )

        mockUpdateAdminUser.mockRejectedValue(
          new AdminUserValidationError(
            'Identificador de utilizador inválido.',
          ),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            {
              params: Promise.resolve(
                {
                  id: '   ',
                },
              ),
            },
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Identificador de utilizador inválido.',
        })
      },
    )
  },
)
