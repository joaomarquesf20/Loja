import {
  describe,
  expect,
  test,
} from 'vitest'

import {
  getOrderStatusLabel,
  getPaymentStatusLabel,
} from './order-status-labels'

describe(
  'getOrderStatusLabel',
  () => {
    test(
      'devolve as etiquetas pt-PT usadas nos emails',
      () => {
        expect(
          getOrderStatusLabel(
            'PENDING',
          ),
        ).toBe('Pendente')
        expect(
          getOrderStatusLabel(
            'CONFIRMED',
          ),
        ).toBe('Confirmada')
        expect(
          getOrderStatusLabel(
            'PROCESSING',
          ),
        ).toBe(
          'Em processamento',
        )
        expect(
          getOrderStatusLabel(
            'SHIPPED',
          ),
        ).toBe('Expedida')
        expect(
          getOrderStatusLabel(
            'DELIVERED',
          ),
        ).toBe('Entregue')
        expect(
          getOrderStatusLabel(
            'READY_FOR_PICKUP',
          ),
        ).toBe(
          'Pronta para levantamento',
        )
        expect(
          getOrderStatusLabel(
            'PICKED_UP',
          ),
        ).toBe('Levantada')
        expect(
          getOrderStatusLabel(
            'CANCELLED',
          ),
        ).toBe('Cancelada')
      },
    )

    test(
      'devolve o valor original para estados desconhecidos',
      () => {
        expect(
          getOrderStatusLabel(
            'ARCHIVED',
          ),
        ).toBe('ARCHIVED')
        expect(
          getOrderStatusLabel(
            '',
          ),
        ).toBe('')
      },
    )
  },
)

describe(
  'getPaymentStatusLabel',
  () => {
    test(
      'devolve as etiquetas pt-PT usadas nos emails',
      () => {
        expect(
          getPaymentStatusLabel(
            'PENDING',
          ),
        ).toBe('Pendente')
        expect(
          getPaymentStatusLabel(
            'AUTHORIZED',
          ),
        ).toBe('Autorizado')
        expect(
          getPaymentStatusLabel(
            'PAID',
          ),
        ).toBe('Pago')
        expect(
          getPaymentStatusLabel(
            'FAILED',
          ),
        ).toBe('Falhado')
        expect(
          getPaymentStatusLabel(
            'REFUNDED',
          ),
        ).toBe('Reembolsado')
      },
    )

    test(
      'devolve o valor original para estados desconhecidos',
      () => {
        expect(
          getPaymentStatusLabel(
            'PENDING_REFUND',
          ),
        ).toBe('PENDING_REFUND')
        expect(
          getPaymentStatusLabel(
            '',
          ),
        ).toBe('')
      },
    )
  },
)
