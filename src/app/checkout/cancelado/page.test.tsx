import {
  cleanup,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  describe,
  expect,
  test,
} from 'vitest'

import CheckoutCanceledPage from './page'

describe(
  '/checkout/cancelado',
  () => {
    afterEach(() => {
      cleanup()
    })

    test(
      'explica o cancelamento e mantém caminhos de volta à loja e à conta',
      () => {
        render(
          <CheckoutCanceledPage />,
        )

        expect(
          screen.getByRole(
            'heading',
            { level: 1 },
          ),
        ).toHaveTextContent(
          'Pagamento cancelado',
        )

        expect(
          screen.getByRole(
            'status',
          ),
        ).toHaveTextContent(
          'a encomenda não ficou paga',
        )

        expect(
          screen.getByRole('link', {
            name:
              'Continuar a comprar',
          }),
        ).toHaveAttribute(
          'href',
          '/',
        )

        expect(
          screen.getByRole('link', {
            name:
              'Voltar ao carrinho',
          }),
        ).toHaveAttribute(
          'href',
          '/carrinho',
        )

        expect(
          screen.getByRole('link', {
            name:
              'Ver as minhas encomendas',
          }),
        ).toHaveAttribute(
          'href',
          '/conta',
        )
      },
    )
  },
)
