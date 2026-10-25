import { render, screen } from '@testing-library/react'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const mocks = vi.hoisted(
  () => ({
    useSession: vi.fn(),
  }),
)

vi.mock(
  'next-auth/react',
  () => ({
    useSession:
      mocks.useSession,
  }),
)

vi.mock(
  './orders-history-client',
  () => ({
    OrdersHistoryClient: () => (
      <section data-testid="orders-history-client">
        Histórico real
      </section>
    ),
  }),
)

import OrderHistoryPage from './page'

describe(
  'OrderHistoryPage',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.useSession.mockReturnValue(
        {
          data: null,
          status:
            'unauthenticated',
        },
      )
    })

    test(
      'não apresenta dados enquanto a sessão está a carregar',
      () => {
        mocks.useSession.mockReturnValue(
          {
            data: null,
            status:
              'loading',
          },
        )

        render(
          <OrderHistoryPage />,
        )

        expect(
          screen.getByText(
            'A verificar sessão…',
          ),
        ).toBeTruthy()

        expect(
          screen.queryByTestId(
            'orders-history-client',
          ),
        ).toBeNull()
      },
    )

    test(
      'pede início de sessão com retorno para a página',
      () => {
        render(
          <OrderHistoryPage />,
        )

        expect(
          screen.getByText(
            'Inicia sessão',
          ),
        ).toBeTruthy()

        const loginLink =
          screen.getByRole(
            'link',
            {
              name: 'Entrar',
            },
          )

        expect(
          loginLink.getAttribute(
            'href',
          ),
        ).toBe(
          '/login?callbackUrl=%2Fconta%2Fencomendas',
        )

        expect(
          screen.queryByTestId(
            'orders-history-client',
          ),
        ).toBeNull()
      },
    )

    test(
      'apresenta o histórico de encomendas do utilizador autenticado',
      () => {
        mocks.useSession.mockReturnValue(
          {
            data: {
              user: {
                id: 'user-1',
                name: 'Maria Silva',
                email:
                  'maria@example.com',
              },
            },
            status:
              'authenticated',
          },
        )

        render(
          <OrderHistoryPage />,
        )

        expect(
          screen.getByText(
            'As minhas encomendas',
          ),
        ).toBeTruthy()

        expect(
          screen.getByTestId(
            'orders-history-client',
          ),
        ).toBeTruthy()
      },
    )
  },
)
