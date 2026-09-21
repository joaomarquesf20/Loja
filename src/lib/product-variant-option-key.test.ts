import {
  describe,
  expect,
  test,
} from 'vitest'
import {
  createProductVariantOptionKey,
  DEFAULT_PRODUCT_VARIANT_OPTION_KEY,
} from './product-variant-option-key'

describe('product variant option key', () => {
  test('usa uma chave estável para a variante sem opções', () => {
    expect(
      createProductVariantOptionKey([]),
    ).toBe(
      DEFAULT_PRODUCT_VARIANT_OPTION_KEY,
    )
  })

  test('é independente da ordem das opções', () => {
    const first =
      createProductVariantOptionKey([
        {
          optionId: 'diameter',
          optionValueId: '19',
        },
        {
          optionId: 'width',
          optionValueId: '8.5J',
        },
        {
          optionId: 'pcd',
          optionValueId: '5x112',
        },
      ])

    const second =
      createProductVariantOptionKey([
        {
          optionId: 'pcd',
          optionValueId: '5x112',
        },
        {
          optionId: 'diameter',
          optionValueId: '19',
        },
        {
          optionId: 'width',
          optionValueId: '8.5J',
        },
      ])

    expect(first).toBe(second)
  })

  test('combinações diferentes produzem chaves diferentes', () => {
    expect(
      createProductVariantOptionKey([
        {
          optionId: 'et',
          optionValueId: '35',
        },
      ]),
    ).not.toBe(
      createProductVariantOptionKey([
        {
          optionId: 'et',
          optionValueId: '40',
        },
      ]),
    )
  })

  test('rejeita dois valores para a mesma opção', () => {
    expect(() =>
      createProductVariantOptionKey([
        {
          optionId: 'diameter',
          optionValueId: '18',
        },
        {
          optionId: 'diameter',
          optionValueId: '19',
        },
      ]),
    ).toThrow(
      'Cada opção só pode ter um valor por variante',
    )
  })
})
