import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listCartItems: vi.fn(),
  requireActiveUserId: vi.fn(),
}))

vi.mock('@/server/cart', () => ({
  listCartItems: mocks.listCartItems,
}))

vi.mock('@/server/user-auth', () => {
  class UnauthorizedUserError extends Error {
    constructor(message = 'Não autenticado') {
      super(message)
      this.name = 'UnauthorizedUserError'
    }
  }

  return {
    UnauthorizedUserError,
    requireActiveUserId: mocks.requireActiveUserId,
  }
})

vi.mock('./checkout-client', () => ({
  CheckoutClient: () => (
    <div>Calculadora de checkout</div>
  ),
}))

import CheckoutPage from './page'
import { UnauthorizedUserError } from '@/server/user-auth'

async function renderPage() {
  render(await CheckoutPage())
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('mostra estado de carrinho vazio com ligação à loja sem calcular total', async () => {
    mocks.requireActiveUserId.mockResolvedValue('user-1')
    mocks.listCartItems.mockResolvedValue([])

    await renderPage()

    expect(
      screen.getByRole('heading', {
        name: 'O carrinho está vazio',
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('link', {
        name: 'Ver produtos',
      }),
    ).toHaveAttribute('href', '/')

    expect(
      screen.queryByText('Calculadora de checkout'),
    ).toBeNull()

    expect(
      mocks.listCartItems,
    ).toHaveBeenCalledWith('user-1')
  })

  test('mantém o checkout quando o carrinho tem produtos', async () => {
    mocks.requireActiveUserId.mockResolvedValue('user-1')
    mocks.listCartItems.mockResolvedValue([
      { id: 'item-1' },
    ])

    await renderPage()

    expect(
      screen.getByText('Calculadora de checkout'),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'O carrinho está vazio',
      }),
    ).toBeNull()
  })

  test('sem sessão renderiza o cliente, que trata o redirecionamento para o login', async () => {
    mocks.requireActiveUserId.mockRejectedValue(
      new UnauthorizedUserError(),
    )

    await renderPage()

    expect(
      screen.getByText('Calculadora de checkout'),
    ).toBeInTheDocument()

    expect(
      mocks.listCartItems,
    ).not.toHaveBeenCalled()
  })
})
