import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => {
    class OrderValidationError
      extends Error {
      constructor(
        message: string,
      ) {
        super(message)
        this.name =
          'OrderValidationError'
      }
    }

    class UnauthorizedUserError
      extends Error {
      constructor(
        message =
          'Não autenticado',
      ) {
        super(message)
        this.name =
          'UnauthorizedUserError'
      }
    }

    return {
      requireActiveUserId:
        vi.fn(),
      listUserOrders:
        vi.fn(),
      OrderValidationError,
      UnauthorizedUserError,
    }
  },
)

vi.mock(
  '@/server/orders',
  () => ({
    OrderValidationError:
      mocks.OrderValidationError,
    listUserOrders:
      mocks.listUserOrders,
  }),
)

vi.mock(
  '@/server/user-auth',
  () => ({
    UnauthorizedUserError:
      mocks.UnauthorizedUserError,
    requireActiveUserId:
      mocks.requireActiveUserId,
  }),
)

import { GET } from './route'

describe('/api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.requireActiveUserId
      .mockResolvedValue(
        'user-1',
      )

    mocks.listUserOrders
      .mockResolvedValue([])
  })

  test(
    'devolve 401 quando o utilizador não está autenticado ou ativo',
    async () => {
      mocks.requireActiveUserId
        .mockRejectedValue(
          new mocks
            .UnauthorizedUserError(),
        )

      const response =
        await GET()

      expect(
        response.status,
      ).toBe(401)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Não autenticado',
      })

      expect(
        mocks.listUserOrders,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'lista as encomendas do utilizador autenticado e ativo',
    async () => {
      const orders = [
        {
          id: 'order-1',
        },
        {
          id: 'order-2',
        },
      ]

      mocks.listUserOrders
        .mockResolvedValue(
          orders,
        )

      const response =
        await GET()

      expect(
        response.status,
      ).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual({
        orders,
      })

      expect(
        mocks.requireActiveUserId,
      ).toHaveBeenCalledTimes(
        1,
      )

      expect(
        mocks.listUserOrders,
      ).toHaveBeenCalledWith(
        'user-1',
      )
    },
  )

  test(
    'devolve lista vazia quando o utilizador não tem encomendas',
    async () => {
      mocks.listUserOrders
        .mockResolvedValue([])

      const response =
        await GET()

      expect(
        response.status,
      ).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual({
        orders: [],
      })

      expect(
        mocks.listUserOrders,
      ).toHaveBeenCalledWith(
        'user-1',
      )
    },
  )

  test(
    'devolve 400 para erro de validação',
    async () => {
      mocks.listUserOrders
        .mockRejectedValue(
          new mocks
            .OrderValidationError(
              'Utilizador inválido',
            ),
        )

      const response =
        await GET()

      expect(
        response.status,
      ).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Utilizador inválido',
      })
    },
  )

  test(
    'devolve 500 genérico em erro inesperado',
    async () => {
      const consoleError =
        vi.spyOn(
          console,
          'error',
        ).mockImplementation(
          () => {},
        )

      mocks.listUserOrders
        .mockRejectedValue(
          new Error('erro'),
        )

      const response =
        await GET()

      expect(
        response.status,
      ).toBe(500)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Erro interno do servidor',
      })

      expect(
        consoleError,
      ).toHaveBeenCalledWith(
        'Unexpected orders API error:',
        expect.any(Error),
      )

      consoleError.mockRestore()
    },
  )
})