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

import UsersClient from './users-client'

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
    Record<string, unknown> = {},
) {
  return {
    id: 'user-1',
    email:
      'cliente@example.com',
    name: 'Cliente Teste',
    role: 'BUYER',
    isActive: true,
    createdAt:
      '2026-08-01T00:00:00.000Z',
    ordersCount: 3,
    ...overrides,
  }
}

describe(
  'Admin Users Client',
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
      'carrega e apresenta os utilizadores',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            users: [
              createUser(),
              createUser({
                id: 'user-2',
                email:
                  'gerente@pfautoparts.pt',
                name: 'Gerente Global',
                role: 'ADMIN',
                isActive: false,
                ordersCount: 12,
              }),
            ],
          }),
        )

        render(
          <UsersClient />,
        )

        expect(
          fetchMock,
        ).toHaveBeenCalledWith(
          '/api/admin/users',
        )

        expect(
          await screen.findByText(
            'Cliente Teste',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Gerente Global',
          ),
        ).toBeInTheDocument()

        const clienteRow =
          screen.getByText(
            'Cliente Teste',
          ).closest('tr')

        expect(
          clienteRow,
        ).toHaveTextContent(
          'Comprador',
        )

        expect(
          clienteRow,
        ).toHaveTextContent(
          'Ativa',
        )

        const gerenteRow =
          screen.getByText(
            'Gerente Global',
          ).closest('tr')

        expect(
          gerenteRow,
        ).toHaveTextContent(
          'Administrador',
        )

        expect(
          gerenteRow,
        ).toHaveTextContent(
          'Inativa',
        )

        expect(
          screen.getByText(
            '2 de 2 utilizadores',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'pesquisa utilizadores por nome e email e filtra por papel e estado',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse({
            users: [
              createUser(),
              createUser({
                id: 'user-2',
                email:
                  'bruno@example.com',
                name: 'Bruno Dias',
                role: 'SELLER',
              }),
              createUser({
                id: 'user-3',
                email:
                  'ana@example.com',
                name: 'Ana Costa',
                isActive: false,
              }),
            ],
          }),
        )

        render(
          <UsersClient />,
        )

        expect(
          await screen.findByText(
            'Cliente Teste',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '3 de 3 utilizadores',
          ),
        ).toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Pesquisar',
          ),
          {
            target: {
              value: 'bruno',
            },
          },
        )

        expect(
          screen.getByText(
            '1 de 3 utilizadores',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Bruno Dias',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Cliente Teste',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.queryByText(
            'Ana Costa',
          ),
        ).not.toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Pesquisar',
          ),
          {
            target: {
              value:
                'ana@example.com',
            },
          },
        )

        expect(
          screen.getByText(
            'Ana Costa',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Bruno Dias',
          ),
        ).not.toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Pesquisar',
          ),
          {
            target: { value: '' },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Papel',
          ),
          {
            target: {
              value: 'SELLER',
            },
          },
        )

        expect(
          screen.getByText(
            '1 de 3 utilizadores',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Bruno Dias',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Cliente Teste',
          ),
        ).not.toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Papel',
          ),
          {
            target: {
              value: 'all',
            },
          },
        )

        fireEvent.change(
          screen.getByLabelText(
            'Estado da conta',
          ),
          {
            target: {
              value: 'inactive',
            },
          },
        )

        expect(
          screen.getByText(
            '1 de 3 utilizadores',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Ana Costa',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'Cliente Teste',
          ),
        ).not.toBeInTheDocument()

        fireEvent.change(
          screen.getByLabelText(
            'Pesquisar',
          ),
          {
            target: {
              value:
                'ninguem@pfautoparts.pt',
            },
          },
        )

        expect(
          screen.getByText(
            'Nenhum utilizador corresponde aos filtros',
          ),
        ).toBeInTheDocument()

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Limpar filtros',
            },
          ),
        )

        expect(
          await screen.findByText(
            '3 de 3 utilizadores',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Cliente Teste',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Bruno Dias',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Ana Costa',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'pagina a lista de utilizadores',
      async () => {
        const users =
          Array.from(
            { length: 12 },
            (_, index) =>
              createUser({
                id: `user-${index + 1}`,
                email: `cliente${
                  index + 1
                }@example.com`,
              }),
          )

        fetchMock.mockResolvedValue(
          createJsonResponse({
            users,
          }),
        )

        render(
          <UsersClient />,
        )

        expect(
          await screen.findByText(
            'cliente1@example.com',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            '12 de 12 utilizadores',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'Página 1 de 2',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'cliente12@example.com',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByRole(
            'button',
            {
              name: 'Página anterior',
            },
          ),
        ).toBeDisabled()

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name: 'Página seguinte',
            },
          ),
        )

        expect(
          screen.getByText(
            'Página 2 de 2',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'cliente11@example.com',
          ),
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            'cliente12@example.com',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            'cliente1@example.com',
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByRole(
            'button',
            {
              name: 'Página seguinte',
            },
          ),
        ).toBeDisabled()

        fireEvent.change(
          screen.getByLabelText(
            'Pesquisar',
          ),
          {
            target: {
              value:
                'cliente12@example.com',
            },
          },
        )

        expect(
          screen.getByText(
            '1 de 12 utilizadores',
          ),
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            /Página \d de \d/,
          ),
        ).not.toBeInTheDocument()

        expect(
          screen.getByText(
            'cliente12@example.com',
          ),
        ).toBeInTheDocument()
      },
    )

    test(
      'apresenta erro seguro quando a listagem falha',
      async () => {
        fetchMock.mockResolvedValue(
          createJsonResponse(
            {
              error:
                'Sem autorização',
            },
            403,
          ),
        )

        render(
          <UsersClient />,
        )

        expect(
          await screen.findByRole(
            'alert',
          ),
        ).toHaveTextContent(
          'Sem autorização',
        )
      },
    )
  },
)
