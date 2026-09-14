import {
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  './db',
  () => ({
    prisma: {},
  }),
)

import {
  CheckoutValidationError,
  createCheckoutOrder,
  previewCheckout,
  type CheckoutClient,
} from './checkout'

function createClient() {
  const transaction = vi.fn()

  return {
    client: {
      $transaction:
        transaction,
    } as unknown as
      CheckoutClient,
    transaction,
  }
}

function invalidInstallmentsInput() {
  return {
    fulfillmentMethod:
      'PICKUP' as const,
    shipping: {
      name: 'Maria Silva',
      phone: '910000000',
    },
    paymentMethod:
      'INSTALLMENTS' as const,
    installmentCount: 200,
  }
}

describe(
  'checkout installment limit',
  () => {
    test(
      'preview rejeita 200 prestações antes de abrir transação',
      async () => {
        const {
          client,
          transaction,
        } = createClient()

        await expect(
          previewCheckout(
            'user-1',
            invalidInstallmentsInput(),
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutValidationError,
        )

        await expect(
          previewCheckout(
            'user-1',
            invalidInstallmentsInput(),
            client,
          ),
        ).rejects.toThrow(
          'Número de prestações inválido',
        )

        expect(
          transaction,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'criação rejeita 200 prestações antes de abrir transação',
      async () => {
        const {
          client,
          transaction,
        } = createClient()

        await expect(
          createCheckoutOrder(
            'user-1',
            invalidInstallmentsInput(),
            'ab'.repeat(32),
            client,
          ),
        ).rejects.toBeInstanceOf(
          CheckoutValidationError,
        )

        await expect(
          createCheckoutOrder(
            'user-1',
            invalidInstallmentsInput(),
            'ab'.repeat(32),
            client,
          ),
        ).rejects.toThrow(
          'Número de prestações inválido',
        )

        expect(
          transaction,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
