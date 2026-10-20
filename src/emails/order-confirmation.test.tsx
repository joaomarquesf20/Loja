import { describe, expect, test } from 'vitest'

import { render } from '@react-email/render'

import {
  OrderConfirmationEmail,
} from './order-confirmation'

import type {
  OrderConfirmationEmailProps,
} from './order-confirmation'

const baseProps: OrderConfirmationEmailProps =
  {
    orderNumber:
      'ORD-2026-1',
    customerName:
      'Maria Encomenda',
    fulfillmentMethod:
      'DELIVERY',
    shippingAddress: {
      name: 'Maria Encomenda',
      line1:
        'Rua das Flores, 10',
      line2: '2.º Dto',
      postalCode: '1000-001',
      city: 'Lisboa',
      country: 'Portugal',
    },
    items: [
      {
        productName:
          'Óleo do motor',
        sku: 'SKU-1',
        quantity: 2,
        unitPriceCents: 1250,
        lineTotalCents: 2500,
        options: [
          {
            name: 'Capacidade',
            value: '2 L',
          },
        ],
      },
    ],
    subtotalCents: 10000,
    shippingCostCents: 490,
    taxCents: 1800,
    totalCents: 10490,
  }

/** Normaliza espaços (incl. non-breaking space do Intl) para comparações estáveis. */
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
  'Template de confirmação de encomenda',
  () => {
    test(
      'apresenta encomenda, artigos, morada e totais',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderConfirmationEmail
                {...baseProps}
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'Encomenda ORD-2026-1 confirmada',
        )

        expect(
          html,
        ).toContain(
          'Olá, Maria Encomenda!',
        )

        expect(
          html,
        ).toContain(
          'Óleo do motor',
        )

        expect(
          html,
        ).toContain(
          'SKU SKU-1',
        )

        expect(
          html,
        ).toContain(
          'Qtd: 2',
        )

        expect(
          html,
        ).toContain(
          '12,50 € / unid.',
        )

        expect(
          html,
        ).toContain(
          '25,00 €',
        )

        expect(
          html,
        ).toContain(
          'Rua das Flores, 10',
        )

        expect(
          html,
        ).toContain(
          '2.º Dto',
        )

        expect(
          html,
        ).toContain(
          '1000-001 Lisboa',
        )

        expect(
          html,
        ).toContain(
          'Portugal',
        )

        expect(
          html,
        ).toContain(
          '104,90 €',
        )

        expect(
          html,
        ).toContain(
          '18,00 €',
        )
      },
    )

    test(
      'levantamento mostra a nota de recolha e omite a morada',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderConfirmationEmail
                {...baseProps}
                fulfillmentMethod="PICKUP"
                shippingAddress={
                  null
                }
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'Levantamento na loja',
        )

        expect(
          html,
        ).toContain(
          'Irá ser notificado quando estiver pronta para levantamento.',
        )

        expect(
          html,
        ).not.toContain(
          'Rua das Flores',
        )
      },
    )

    test(
      'entrega sem morada registada apresenta nota genérica',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderConfirmationEmail
                {...baseProps}
                shippingAddress={
                  null
                }
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'Morada de entrega não disponível',
        )
      },
    )

    test(
      'artigos sem opções não mostram linha de opções',
      async () => {
        const html =
          normalizeText(
            await render(
              <OrderConfirmationEmail
                {...baseProps}
                items={[
                  {
                    productName:
                      'Filtro de óleo',
                    sku: 'SKU-2',
                    quantity: 1,
                    unitPriceCents:
                      3000,
                    lineTotalCents:
                      3000,
                    options: [],
                  },
                ]}
              />,
            ),
          )

        expect(
          html,
        ).toContain(
          'Filtro de óleo',
        )

        expect(
          html,
        ).toContain(
          '30,00 €',
        )
      },
    )
  },
)
