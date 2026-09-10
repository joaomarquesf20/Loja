import { describe, expect, test } from 'vitest'
import {
  productSchema,
  productUpdateSchema,
} from './admin-validation'

const baseProduct = {
  name: 'Produto Teste',
  slug: 'produto-teste',
  sku: 'SKU-TESTE-001',
  price: 19.99,
  stockQuantity: 10,
  categoryId: 'category-test',
}

describe('product shipping validation', () => {
  test('exige classe de transporte num produto novo', () => {
    expect(
      productSchema.safeParse(baseProduct).success,
    ).toBe(false)
  })

  test('aceita STANDARD sem tarifa específica', () => {
    const result = productSchema.parse({
      ...baseProduct,
      shippingClass: 'STANDARD',
    })

    expect(result.shippingClass).toBe('STANDARD')
    expect(
      result.mainlandShippingCost,
    ).toBeUndefined()
  })

  test('rejeita UNASSIGNED num produto novo', () => {
    expect(
      productSchema.safeParse({
        ...baseProduct,
        shippingClass: 'UNASSIGNED',
      }).success,
    ).toBe(false)
  })

  test('exige tarifa específica para BULKY', () => {
    expect(
      productSchema.safeParse({
        ...baseProduct,
        shippingClass: 'BULKY',
      }).success,
    ).toBe(false)
  })

  test('aceita BULKY com tarifa específica', () => {
    const result = productSchema.parse({
      ...baseProduct,
      shippingClass: 'BULKY',
      mainlandShippingCost: 24.9,
    })

    expect(result.shippingClass).toBe('BULKY')
    expect(result.mainlandShippingCost).toBe(
      24.9,
    )
  })

  test('rejeita tarifa específica numa classe não volumosa', () => {
    expect(
      productSchema.safeParse({
        ...baseProduct,
        shippingClass: 'SMALL',
        mainlandShippingCost: 5.9,
      }).success,
    ).toBe(false)
  })

  test('update permite alterar apenas a classe', () => {
    const result = productUpdateSchema.parse({
      shippingClass: 'STANDARD',
    })

    expect(result).toEqual({
      shippingClass: 'STANDARD',
    })
  })

  test('update não permite atribuir UNASSIGNED', () => {
    expect(
      productUpdateSchema.safeParse({
        shippingClass: 'UNASSIGNED',
      }).success,
    ).toBe(false)
  })
})
