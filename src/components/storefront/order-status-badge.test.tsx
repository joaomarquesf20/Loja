import { render } from '@testing-library/react'
import {
  describe,
  expect,
  test,
} from 'vitest'

import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from './order-status-badge'

describe(
  'OrderStatusBadge',
  () => {
    test(
      'apresenta a etiqueta pt-PT e a variante do estado',
      () => {
        const cases: Array<
          [
            string,
            string,
            string,
          ]
        > = [
          [
            'PENDING',
            'Pendente',
            'warning',
          ],
          [
            'CONFIRMED',
            'Confirmada',
            'info',
          ],
          [
            'PROCESSING',
            'Em processamento',
            'info',
          ],
          [
            'SHIPPED',
            'Expedida',
            'info',
          ],
          [
            'DELIVERED',
            'Entregue',
            'success',
          ],
          [
            'READY_FOR_PICKUP',
            'Pronta para levantamento',
            'success',
          ],
          [
            'PICKED_UP',
            'Levantada',
            'success',
          ],
          [
            'CANCELLED',
            'Cancelada',
            'danger',
          ],
        ]

        for (const [
          status,
          label,
          variant,
        ] of cases) {
          const {
            getByText,
            unmount,
          } = render(
            <OrderStatusBadge
              status={status}
            />,
          )

          const badge =
            getByText(
              label,
            ).closest(
              '[data-variant]',
            )

          expect(
            badge,
          ).toHaveAttribute(
            'data-variant',
            variant,
          )

          unmount()
        }
      },
    )

    test(
      'usa a variante neutra com o valor original para estados desconhecidos',
      () => {
        const {
          getByText,
        } = render(
          <OrderStatusBadge
            status="ARCHIVED"
          />,
        )

        const badge =
          getByText(
            'ARCHIVED',
          ).closest(
            '[data-variant]',
          )

        expect(
          badge,
        ).toHaveAttribute(
          'data-variant',
          'neutral',
        )
      },
    )
  },
)

describe(
  'PaymentStatusBadge',
  () => {
    test(
      'apresenta a etiqueta pt-PT e a variante do estado',
      () => {
        const cases: Array<
          [
            string,
            string,
            string,
          ]
        > = [
          [
            'PENDING',
            'Pendente',
            'warning',
          ],
          [
            'AUTHORIZED',
            'Autorizado',
            'info',
          ],
          [
            'PAID',
            'Pago',
            'success',
          ],
          [
            'FAILED',
            'Falhado',
            'danger',
          ],
          [
            'REFUNDED',
            'Reembolsado',
            'neutral',
          ],
        ]

        for (const [
          status,
          label,
          variant,
        ] of cases) {
          const {
            getByText,
            unmount,
          } = render(
            <PaymentStatusBadge
              status={status}
            />,
          )

          const badge =
            getByText(
              label,
            ).closest(
              '[data-variant]',
            )

          expect(
            badge,
          ).toHaveAttribute(
            'data-variant',
            variant,
          )

          unmount()
        }
      },
    )

    test(
      'usa a variante neutra com o valor original para estados desconhecidos',
      () => {
        const {
          getByText,
        } = render(
          <PaymentStatusBadge
            status="PENDING_REFUND"
          />,
        )

        const badge =
          getByText(
            'PENDING_REFUND',
          ).closest(
            '[data-variant]',
          )

        expect(
          badge,
        ).toHaveAttribute(
          'data-variant',
          'neutral',
        )
      },
    )
  },
)
