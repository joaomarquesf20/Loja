import { describe, expect, test } from 'vitest'

import { render } from '@react-email/render'

import {
  OrderStatusUpdateEmail,
} from './order-status-update'

import type {
  OrderStatusUpdateEmailProps,
} from './order-status-update'

const baseProps: OrderStatusUpdateEmailProps = {
  orderNumber:
    'ORD-2026-1',
  customerName:
    'Maria Encomenda',
  status: 'SHIPPED',
  paymentStatus: 'PAID',
  // Meio-dia UTC: o local pode estar entre UTC−11 e UTC+12 sem alterar o dia.
  updatedAt:
    '2026-10-22T12:00:00.000Z',
}

function normalizeText(
  value: string,
) {
  return value
    .replace(
      /\u00a0/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
}

describe(
  'Template de atualização de estado de encomenda',
  () => {
    test(
      'apresenta o estado atual com etiquetas em pt-PT',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderStatusUpdateEmail
                {...baseProps}
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'O estado da encomenda ORD-2026-1 foi atualizado.',
        )

        expect(
          html,
        ).toContain(
          'Expedida',
        )

        expect(
          html,
        ).toContain(
          'Pago',
        )

        expect(
          html,
        ).toContain(
          '22 de outubro de 2026',
        )
      },
    )

    test(
      'cancelamento mostra mensagem dedicada e apoio ao cliente',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderStatusUpdateEmail
                {...baseProps}
                status="CANCELLED"
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'A encomenda ORD-2026-1 foi cancelada.',
        )

        expect(
          html,
        ).toContain(
          'Cancelada',
        )

        expect(
          html,
        ).toContain(
          'contacte o nosso apoio ao cliente',
        )
      },
    )

    test(
      'reembolso mostra mensagem dedicada',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderStatusUpdateEmail
                {...baseProps}
                status="PENDING"
                paymentStatus="REFUNDED"
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'O pagamento da encomenda ORD-2026-1 foi reembolsado.',
        )

        expect(
          html,
        ).toContain(
          'Reembolsado',
        )
      },
    )

    test(
      'estados desconhecidos aparecem sem etiqueta inventada',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderStatusUpdateEmail
                {...baseProps}
                status="MYSTERY_STATUS"
                paymentStatus="MYSTERY_PAYMENT"
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'MYSTERY_STATUS',
        )

        expect(
          html,
        ).toContain(
          'MYSTERY_PAYMENT',
        )
      },
    )

    test(
      'data inválida recorre ao texto original',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderStatusUpdateEmail
                {...baseProps}
                updatedAt="not-a-date"
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'not-a-date',
        )
      },
    )
  },
)
