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
    sendOrderConfirmationEmail:
      vi.fn(),
    sendOrderStatusUpdateEmail:
      vi.fn(),
  }),
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
} from '@/server/email'
import { POST } from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockSendOrderConfirmationEmail = vi.mocked(
  sendOrderConfirmationEmail,
)

const mockSendOrderStatusUpdateEmail = vi.mocked(
  sendOrderStatusUpdateEmail,
)

function postRequest(
  body: unknown = {
    type: 'CONFIRMATION',
  },
) {
  return new Request(
    'http://localhost/api/admin/orders/order-1/email-resend',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(body),
    },
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
  'Admin Order Email Resend API',
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
      'reenvia a confirmação sem a deteção de entregas repetidas do webhook',
      async () => {
        mockSendOrderConfirmationEmail.mockResolvedValue(
          {
            status: 'sent',
            id: 'resend-email-1',
          },
        )

        const response =
          await POST(
            postRequest({
              type: 'CONFIRMATION',
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          resend: {
            status: 'sent',
            id: 'resend-email-1',
          },
        })

        // Chamada SEM segunda janela temporal: reenvio manual força nova
        // entrega; a supressão do webhook não se aplica.
        expect(
          mockSendOrderConfirmationEmail,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
        })

        expect(
          mockSendOrderStatusUpdateEmail,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'reenvia a atualização de estado',
      async () => {
        mockSendOrderStatusUpdateEmail.mockResolvedValue(
          {
            status: 'sent',
            id: 'resend-email-2',
          },
        )

        const response =
          await POST(
            postRequest({
              type: 'STATUS_UPDATE',
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          resend: {
            status: 'sent',
            id: 'resend-email-2',
          },
        })

        expect(
          mockSendOrderStatusUpdateEmail,
        ).toHaveBeenCalledWith({
          orderId: 'order-1',
        })

        expect(
          mockSendOrderConfirmationEmail,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'explica em 200 o modo de simulação (sem chave do Resend)',
      async () => {
        mockSendOrderConfirmationEmail.mockResolvedValue(
          {
            status: 'skipped',
            reason:
              'missing-api-key',
          },
        )

        const response =
          await POST(
            postRequest({
              type: 'CONFIRMATION',
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toMatchObject({
          resend: {
            status: 'skipped',
            reason:
              'missing-api-key',
          },
        })
      },
    )

    test(
      'explica em 200 quando a confirmação não se aplica a encomendas não pagas',
      async () => {
        mockSendOrderConfirmationEmail.mockResolvedValue(
          {
            status: 'skipped',
            reason:
              'order-not-paid',
          },
        )

        const response =
          await POST(
            postRequest({
              type: 'CONFIRMATION',
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual({
          resend: {
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
      'devolve 404 para encomenda inexistente',
      async () => {
        mockSendOrderStatusUpdateEmail.mockResolvedValue(
          {
            status: 'skipped',
            reason:
              'order-not-found',
          },
        )

        const response =
          await POST(
            postRequest({
              type: 'STATUS_UPDATE',
            }),
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
      'devolve 400 para tipo de email inválido',
      async () => {
        const response =
          await POST(
            postRequest({
              type: 'DELETE',
            }),
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

        expect(
          mockSendOrderConfirmationEmail,
        ).not.toHaveBeenCalled()

        expect(
          mockSendOrderStatusUpdateEmail,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 400 para JSON inválido',
      async () => {
        const request =
          new Request(
            'http://localhost/api/admin/orders/order-1/email-resend',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: '{',
            },
          )

        const response =
          await POST(
            request,
            context(),
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          mockSendOrderConfirmationEmail,
        ).not.toHaveBeenCalled()

        expect(
          mockSendOrderStatusUpdateEmail,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 413 quando o body ultrapassa o limite',
      async () => {
        const response =
          await POST(
            postRequest({
              type: 'CONFIRMATION',
              extra:
                'x'.repeat(
                  9 * 1024,
                ),
            }),
            context(),
          )

        expect(
          response.status,
        ).toBe(413)

        expect(
          mockSendOrderConfirmationEmail,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'devolve 500 seguro quando o envio falha no fornecedor',
      async () => {
        const consoleError =
          vi.spyOn(
            console,
            'error',
          ).mockImplementation(
            () => undefined,
          )

        mockSendOrderConfirmationEmail.mockResolvedValue(
          {
            status: 'error',
            error:
              'falha no fornecedor de email',
          },
        )

        const response =
          await POST(
            postRequest({
              type: 'CONFIRMATION',
            }),
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

    test(
      'devolve 401 sem autenticação',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const response =
          await POST(
            postRequest(),
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
          mockSendOrderConfirmationEmail,
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
          await POST(
            postRequest(),
            context(),
          )

        expect(
          response.status,
        ).toBe(403)

        expect(
          mockSendOrderConfirmationEmail,
        ).not.toHaveBeenCalled()

        expect(
          mockSendOrderStatusUpdateEmail,
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
          await POST(
            postRequest(),
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
