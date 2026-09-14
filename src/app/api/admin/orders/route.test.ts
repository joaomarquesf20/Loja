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
  '@/server/admin-orders',
  () => ({
    listAdminOrders:
      vi.fn(),
  }),
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  listAdminOrders,
} from '@/server/admin-orders'
import { GET } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockListAdminOrders =
  vi.mocked(listAdminOrders)

describe(
  'Admin Orders API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRequireAdmin.mockResolvedValue({
        user: {
          id: 'admin-1',
          role: 'ADMIN',
        },
      } as Awaited<
        ReturnType<
          typeof requireAdmin
        >
      >)
    })

    test(
      'lista encomendas para administrador autenticado',
      async () => {
        const orders = [
          {
            id: 'order-1',
            orderNumber:
              'PFA-ABC123',
          },
        ]

        mockListAdminOrders.mockResolvedValue(
          orders as Awaited<
            ReturnType<
              typeof listAdminOrders
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
          orders,
        })

        expect(
          mockListAdminOrders,
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
          mockListAdminOrders,
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

        mockListAdminOrders.mockRejectedValue(
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
