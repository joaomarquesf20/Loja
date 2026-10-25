import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  class OrderValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name =
        'OrderValidationError'
    }
  }

  class UnauthorizedUserError extends Error {
    constructor(
      message = 'Não autenticado',
    ) {
      super(message)
      this.name =
        'UnauthorizedUserError'
    }
  }

  return {
    requireActiveUserId:
      vi.fn(),
    getUserOrder: vi.fn(),
    OrderValidationError,
    UnauthorizedUserError,
  }
})

vi.mock(
  '@/server/orders',
  () => ({
    OrderValidationError:
      mocks.OrderValidationError,
    getUserOrder:
      mocks.getUserOrder,
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

function createContext(
  id: string,
) {
  return {
    params: Promise.resolve({
      id,
    }),
  }
}

describe('/api/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.requireActiveUserId
      .mockResolvedValue(
        'user-1',
      )
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
        await GET(
          new Request(
            'http://localhost:3000/api/orders/PFA-ABC123',
          ),
          createContext(
            'PFA-ABC123',
          ),
        )

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
        mocks.getUserOrder,
      ).not.toHaveBeenCalled()
    },
  )

  test(
    'devolve o detalhe da encomenda do utilizador autenticado',
    async () => {
      const order = {
        id: 'order-1',
        orderNumber:
          'PFA-ABC123',
        total: '105.90',
        paymentStatus: 'PAID',
      }

      mocks.getUserOrder
        .mockResolvedValue(
          order,
        )

      const response =
        await GET(
          new Request(
            'http://localhost:3000/api/orders/PFA-ABC123',
          ),
          createContext(
            'PFA-ABC123',
          ),
        )

      expect(
        response.status,
      ).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual({
        order,
      })

      expect(
        mocks.requireActiveUserId,
      ).toHaveBeenCalledTimes(
        1,
      )

      expect(
        mocks.getUserOrder,
      ).toHaveBeenCalledWith(
        'user-1',
        'PFA-ABC123',
      )
    },
  )

  test(
    'devolve 404 quando a encomenda não existe ou pertence a outra conta',
    async () => {
      mocks.getUserOrder.mockResolvedValue(
        null,
      )

      const response =
        await GET(
          new Request(
            'http://localhost:3000/api/orders/PFA-OUTRO',
          ),
          createContext(
            'PFA-OUTRO',
          ),
        )

      expect(
        response.status,
      ).toBe(404)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Encomenda não encontrada',
      })
    },
  )

  test(
    'devolve 400 para número de encomenda inválido',
    async () => {
      mocks.getUserOrder
        .mockRejectedValue(
          new mocks
            .OrderValidationError(
              'Encomenda inválida',
            ),
        )

      const response =
        await GET(
          new Request(
            'http://localhost:3000/api/orders/%20%20',
          ),
          createContext(
            '  ',
          ),
        )

      expect(
        response.status,
      ).toBe(400)

      await expect(
        response.json(),
      ).resolves.toEqual({
        error:
          'Encomenda inválida',
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

      mocks.getUserOrder
        .mockRejectedValue(
          new Error('erro'),
        )

      const response =
        await GET(
          new Request(
            'http://localhost:3000/api/orders/PFA-ABC123',
          ),
          createContext(
            'PFA-ABC123',
          ),
        )

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
        'Unexpected order detail API error:',
        expect.any(Error),
      )

      consoleError.mockRestore()
    },
  )
})
