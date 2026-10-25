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
    listAdminUsers:
      vi.fn(),
  }),
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  listAdminUsers,
} from '@/server/admin-users'
import { GET } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockListAdminUsers =
  vi.mocked(listAdminUsers)

describe(
  'Admin Users API',
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
      'lista utilizadores para administrador autenticado',
      async () => {
        const users = [
          {
            id: 'user-1',
            email:
              'cliente@example.com',
            name: 'Cliente Teste',
            role: 'BUYER',
            isActive: true,
            ordersCount: 2,
          },
        ]

        mockListAdminUsers.mockResolvedValue(
          users as Awaited<
            ReturnType<
              typeof listAdminUsers
            >
          >,
        )

        const response =
          await GET()

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          users,
        })

        expect(
          mockListAdminUsers,
        ).toHaveBeenCalledTimes(1)
      },
    )

    test(
      'devolve 401 sem autenticação',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const response =
          await GET()

        expect(
          response.status,
        ).toBe(401)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Não autenticado',
        })

        expect(
          mockListAdminUsers,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 403 sem autorização ADMIN',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new ForbiddenError(),
        )

        const response =
          await GET()

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
      'devolve 500 seguro para erro inesperado',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => undefined,
          )

        mockListAdminUsers.mockRejectedValue(
          new Error(
            'erro interno sensível',
          ),
        )

        const response =
          await GET()

        expect(
          response.status,
        ).toBe(500)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Erro interno do servidor',
        })

        expect(
          consoleError,
        ).toHaveBeenCalled()

        consoleError.mockRestore()
      },
    )
  },
)
