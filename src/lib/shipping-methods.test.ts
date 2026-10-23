import { describe, expect, test } from 'vitest'

import {
  getShippingMethodEstimate,
  getShippingMethodLabel,
  getShippingMethodOptions,
  isShippingMethodCode,
  SHIPPING_METHOD_OPTIONS,
} from './shipping-methods'

describe(
  'SHIPPING_METHOD_OPTIONS',
  () => {
    test('cobre levantamento, standard e expresso com rótulos pt-PT e estimativas', () => {
      expect(
        SHIPPING_METHOD_OPTIONS.map(
          (option) => option.id,
        ),
      ).toEqual([
        'STANDARD',
        'EXPRESS',
        'PICKUP',
      ])

      expect(
        SHIPPING_METHOD_OPTIONS.map(
          (option) => option.label,
        ),
      ).toEqual([
        'Envio standard',
        'Envio expresso',
        'Levantamento em loja',
      ])

      for (const option of SHIPPING_METHOD_OPTIONS) {
        expect(
          option.estimate.length,
        ).toBeGreaterThan(0)
        expect(
          option.label.length,
        ).toBeGreaterThan(0)
      }
    })

    test(
      'mapeia cada opção para o modo de cumprimento e código da base de dados',
      () => {
        expect(
          SHIPPING_METHOD_OPTIONS.map(
            (option) => [
              option.fulfillmentMethod,
              option.shippingMethodCode,
            ],
          ),
        ).toEqual([
          ['DELIVERY', 'STANDARD'],
          ['DELIVERY', 'EXPRESS'],
          ['PICKUP', null],
        ])
      },
    )
  },
)

describe(
  'isShippingMethodCode',
  () => {
    test('valida apenas os códigos persistidos em Order.shippingMethod', () => {
      expect(
        isShippingMethodCode('STANDARD'),
      ).toBe(true)
      expect(
        isShippingMethodCode('EXPRESS'),
      ).toBe(true)
      expect(
        isShippingMethodCode('PICKUP'),
      ).toBe(false)
      expect(
        isShippingMethodCode(null),
      ).toBe(false)
      expect(
        isShippingMethodCode(undefined),
      ).toBe(false)
      expect(
        isShippingMethodCode('standard'),
      ).toBe(false)
      expect(
        isShippingMethodCode(123),
      ).toBe(false)
    })
  },
)

describe(
  'getShippingMethodOptions',
  () => {
    test(
      'devolve standard e expresso pela ordem do checkout para entrega',
      () => {
        expect(
          getShippingMethodOptions(
            'DELIVERY',
          ),
        ).toEqual([
          SHIPPING_METHOD_OPTIONS[0],
          SHIPPING_METHOD_OPTIONS[1],
        ])
      },
    )

    test(
      'devolve o levantamento em loja para o modo de recolha',
      () => {
        expect(
          getShippingMethodOptions(
            'PICKUP',
          ),
        ).toEqual([SHIPPING_METHOD_OPTIONS[2]])
      },
    )
  },
)

describe(
  'getShippingMethodLabel',
  () => {
    test(
      'identifica o método a partir do modo de cumprimento e do código guardado',
      () => {
        expect(
          getShippingMethodLabel(
            'DELIVERY',
            'STANDARD',
          ),
        ).toBe('Envio standard')
        expect(
          getShippingMethodLabel(
            'DELIVERY',
            'EXPRESS',
          ),
        ).toBe('Envio expresso')
        expect(
          getShippingMethodLabel(
            'PICKUP',
            null,
          ),
        ).toBe('Levantamento em loja')
      },
    )

    test(
      'assume o envio standard para encomendas de entrega sem código (anteriores à Etapa 6)',
      () => {
        expect(
          getShippingMethodLabel(
            'DELIVERY',
            null,
          ),
        ).toBe('Envio standard')
      },
    )

    test(
      'ignora o código em encomendas de levantamento',
      () => {
        expect(
          getShippingMethodLabel(
            'PICKUP',
            'EXPRESS',
          ),
        ).toBe('Levantamento em loja')
      },
    )
  },
)

describe(
  'getShippingMethodEstimate',
  () => {
    test(
      'devolve a estimativa pt-PT do método',
      () => {
        expect(
          getShippingMethodEstimate(
            'DELIVERY',
            'STANDARD',
          ),
        ).toBe(
          'Entrega estimada em 2–5 dias úteis.',
        )
        expect(
          getShippingMethodEstimate(
            'DELIVERY',
            'EXPRESS',
          ),
        ).toBe(
          'Entrega estimada em 1–2 dias úteis.',
        )
        expect(
          getShippingMethodEstimate(
            'PICKUP',
            null,
          ),
        ).toBe(
          'Pronto para levantamento em 1–3 dias úteis após a confirmação do pagamento.',
        )
      },
    )

    test(
      'assume a estimativa standard para entregas sem código',
      () => {
        expect(
          getShippingMethodEstimate(
            'DELIVERY',
            null,
          ),
        ).toBe(
          'Entrega estimada em 2–5 dias úteis.',
        )
      },
    )
  },
)
