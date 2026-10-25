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
  '@/server/email',
  () => ({
    buildOrderEmailPreview:
      vi.fn(),
  }),
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  buildOrderEmailPreview,
} from '@/server/email'
import { GET } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockBuildOrderEmailPreview = vi.mocked(
  buildOrderEmailPreview,
)

function getRequest(
  search = '?type=CONFIRMATION',
) {
  return new Request(
    `http://localhost/api/admin/orders/order-1/email-preview${search}`,
  )
}

function context() {
  return {
    params: Promise.resolve({
      id: 'order-1',
    }),
  }
}

describe(
  'Admin Order Email Preview API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockRequireAdmin.mockResolvedValue(
        {
          user: {
            id: 'admin-test',
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
      'devolve a pré-visualização renderizada para o tipo pedido',
      async () => {
        mockBuildOrderEmailPreview.mockResolvedValue(
          {
            status: 'ready',
            type: 'CONFIRMATION',
            subject:
              'PFAAutoParts: Encomenda ORD-2026-1 confirmada',
            recipient:
              'maria@example.com',
            html:
              '<html>PFAAutoParts</html>',
          },
        )

        const response =
          await GET(
            getRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          preview: {
            status: 'ready',
            type: 'CONFIRMATION',
            subject:
              'PFAAutoParts: Encomenda ORD-2026-1 confirmada',
            recipient:
              'maria@example.com',
            html:
              '<html>PFAAutoParts</html>',
          },
        })

        expect(
          mockBuildOrderEmailPreview,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
          type: 'CONFIRMATION',
        })
      },
    )

    test(
      'passa o tipo da query string ao serviço',
      async () => {
        mockBuildOrderEmailPreview.mockResolvedValue(
          {
            status: 'ready',
            type: 'STATUS_UPDATE',
            subject:
              'PFAAutoParts: Atualização da encomenda ORD-2026-1',
            recipient: null,
            html: '<html>estado</html>',
          },
        )

        const response =
          await GET(
            getRequest(
              '?type=STATUS_UPDATE',
            ),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          mockBuildOrderEmailPreview,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
          type: 'STATUS_UPDATE',
        })
      },
    )

    test(
      'devolve 404 para encomenda inexistente',
      async () => {
        mockBuildOrderEmailPreview.mockResolvedValue(
          {
            status: 'skipped',
            reason:
              'order-not-found',
          },
        )

        const response =
          await GET(
            getRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(404)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Encomenda não encontrada',
        })
      },
    )

    test(
      'devolve 400 para tipo não suportado',
      async () => {
        mockBuildOrderEmailPreview.mockResolvedValue(
          {
            status: 'skipped',
            reason:
              'unsupported-type',
          },
        )

        const response =
          await GET(
            getRequest(
              '?type=NEWSLETTER',
            ),
            context(),
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
      'devolve 400 para pedido sem tipo na query',
      async () => {
        mockBuildOrderEmailPreview.mockResolvedValue(
          {
            status: 'skipped',
            reason:
              'unsupported-type',
          },
        )

        const response =
          await GET(
            new Request(
              'http://localhost/api/admin/orders/order-1/email-preview',
            ),
            context(),
          )

        expect(
          response.status,
        ).toBe(400)
      },
    )

    test(
      'explica em 200 quando a confirmação não se aplica a encomendas não pagas',
      async () => {
        mockBuildOrderEmailPreview.mockResolvedValue(
          {
            status: 'skipped',
            reason:
              'order-not-paid',
          },
        )

        const response =
          await GET(
            getRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          preview: {
            status: 'skipped',
            reason:
              'order-not-paid',
            message:
              'O email de confirmação só existe para encomendas pagas.',
          },
        })
      },
    )

    test(
      'devolve 500 seguro quando a preparação do email falha',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => undefined,
          )

        mockBuildOrderEmailPreview.mockResolvedValue(
          {
            status: 'error',
            error:
              'Valores monetários da encomenda inválidos',
          },
        )

        const response =
          await GET(
            getRequest(),
            context(),
          )

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

    test(
      'devolve 401 sem autenticação',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const response =
          await GET(
            getRequest(),
            context(),
          )

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
          mockBuildOrderEmailPreview,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 403 sem papel ADMIN',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new ForbiddenError(),
        )

        const response =
          await GET(
            getRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(403)

        expect(
          mockBuildOrderEmailPreview,
        ).not.toHaveBeenCalled()
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

        mockRequireAdmin.mockRejectedValue(
          new Error('falha de infraestrutura'),
        )

        const response =
          await GET(
            getRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(500)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Erro interno do servidor',
        })

        consoleError.mockRestore()
      },
    )
  },
)
