import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import UserDetailClient, {
  type AdminUserDetailClientData,
} from './user-detail-client'

const fetchMock =
  vi.fn()

function createJsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'content-type':
          'application/json',
      },
    },
  )
}

function createUser(
  overrides:
    Partial<AdminUserDetailClientData> = {},
): AdminUserDetailClientData {
  return {
    id: 'user-1',
    email:
      'cliente@example.com',
    name: 'Cliente Teste',
    role: 'BUYER',
    isActive: true,
    createdAt:
      '2026-08-01T00:00:00.000Z',
    ordersCount: 2,
    totalExpenditure:
      '128.00',
    orders: [
      {
        id: 'order-1',
        orderNumber:
          'PFA-ABC123',
        total: '128.00',
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        createdAt:
          '2026-09-14T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

describe(
  'Admin User Detail Client',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      vi.stubGlobal(
        'fetch',
        fetchMock,
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    test(
      'apresenta perfil, despesa e histórico de encomendas',
      () => {
        render(
          <UserDetailClient
            initialUser={createUser()}
            currentUserId="admin-9"
          />,
        )

        expect(
          screen.getByText(
            'Cliente Teste',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'cliente@example.com',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getAllByText(
            '128.00 €',
          ).length,
        ).toBeGreaterThan(0)

        expect(
          screen.getAllByText(
            'Comprador',
          ).length,
        ).toBeGreaterThan(0)

        expect(
          screen.getByText(
            'PFA-ABC123',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            /Pagamento: Pago/,
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Guardar papel',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Desativar conta',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'guarda novo papel e atualiza a ficha',
      async () => {
        const initialUser =
          createUser()

        fetchMock.mockResolvedValueOnce(
          createJsonResponse({
            user: {
              ...initialUser,
              role: 'SELLER',
            },
          }),
        )

        render(
          <UserDetailClient
            initialUser={
              initialUser
            }
            currentUserId="admin-9"
          />,
        )

        fireEvent.change(
          screen.getByLabelText(
            'Papel de utilizador',
          ),
          {
            target: {
              value: 'SELLER',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Guardar papel',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Papel atualizado para Vendedor.',
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/admin/users/user-1',
          expect.objectContaining(
            {
              method: 'PATCH',
            },
          ),
        )

        expect(
          screen.getAllByText(
            'Vendedor',
          ).length,
        ).toBeGreaterThan(1)
      },
    )

    test(
      'bloqueia alterações destrutivas na própria conta sem pedir confirmação',
      async () => {
        const confirmSpy =
          vi.spyOn(
            window,
            'confirm',
          )
            .mockReturnValue(
              true,
            )

        render(
          <UserDetailClient
            initialUser={createUser()}
            currentUserId="user-1"
          />,
        )

        expect(
          screen.getByText(
            'Esta é a sua própria conta: papel e estado não podem ser alterados.',
          ),
        ).toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Papel de utilizador',
          ),
          {
            target: {
              value: 'SELLER',
            },
          },
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Guardar papel',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Não é possível alterar o seu próprio papel ou desativar a sua conta.',
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Desativar conta',
            },
          ),
        )

        expect(
          screen.getByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Não é possível alterar o seu próprio papel ou desativar a sua conta.',
        )

        expect(
          confirmSpy,
        ).not.toHaveBeenCalled()

        expect(
          fetchMock,
        ).not.toHaveBeenCalled()

        confirmSpy.mockRestore()
      },
    )

    test(
      'desativa e reativa a conta com confirmação',
      async () => {
        const confirmSpy =
          vi.spyOn(
            window,
            'confirm',
          )
            .mockReturnValue(
              true,
            )

        const initialUser =
          createUser()

        fetchMock.mockResolvedValueOnce(
          createJsonResponse({
            user: {
              ...initialUser,
              isActive: false,
            },
          }),
        )

        fetchMock.mockResolvedValueOnce(
          createJsonResponse({
            user: {
              ...initialUser,
              isActive: true,
            },
          }),
        )

        render(
          <UserDetailClient
            initialUser={
              initialUser
            }
            currentUserId="admin-9"
          />,
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Desativar conta',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'status',
          ),
        ).toHaveTextContent(
          'Conta desativada.',
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/admin/users/user-1',
          expect.objectContaining(
            {
              method: 'PATCH',
            },
          ),
        )

        expect(
          screen.getAllByText(
            'Inativa',
          )[0],
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Ativar conta',
            },
          ),
        )

        expect(
          await screen.findByText(
            'Conta ativada.',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getAllByText(
            'Ativa',
          )[0],
        ).toBeInTheDocument()

        expect(
          confirmSpy,
        ).toHaveBeenCalledTimes(2)

        confirmSpy.mockRestore()
      },
    )

    test(
      'apresenta erro do servidor quando a atualização falha',
      async () => {
        const confirmSpy =
          vi.spyOn(
            window,
            'confirm',
          )
            .mockReturnValue(
              true,
            )

        fetchMock.mockResolvedValueOnce(
          createJsonResponse(
            {
              error:
                'Sem autorização',
            },
            403,
          ),
        )

        render(
          <UserDetailClient
            initialUser={createUser()}
            currentUserId="admin-9"
          />,
        )

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Desativar conta',
            },
          ),
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Sem autorização',
        )

        confirmSpy.mockRestore()
      },
    )
  },
)
