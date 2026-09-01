import { describe, expect, test } from 'vitest'

import { productCompatibilitySchema } from './product-compatibility-validation'

describe('product compatibility validation', () => {
  test('rejeita productId vazio', () => {
    expect(() =>
      productCompatibilitySchema.parse({
        productId: '',
        vehicleConfigurationId: 'vc-1',
      }),
    ).toThrow()
  })

  test('rejeita productId apenas com espaços', () => {
    expect(() =>
      productCompatibilitySchema.parse({
        productId: '   ',
        vehicleConfigurationId: 'vc-1',
      }),
    ).toThrow()
  })

  test('rejeita vehicleConfigurationId vazio', () => {
    expect(() =>
      productCompatibilitySchema.parse({
        productId: 'p-1',
        vehicleConfigurationId: '',
      }),
    ).toThrow()
  })

  test('rejeita vehicleConfigurationId apenas com espaços', () => {
    expect(() =>
      productCompatibilitySchema.parse({
        productId: 'p-1',
        vehicleConfigurationId: '   ',
      }),
    ).toThrow()
  })

  test('aceita dados válidos', () => {
    const result = productCompatibilitySchema.parse({
      productId: 'p-1',
      vehicleConfigurationId: 'vc-1',
    })

    expect(result).toEqual({
      productId: 'p-1',
      vehicleConfigurationId: 'vc-1',
    })
  })

  test('remove espaços no início e fim', () => {
    const result = productCompatibilitySchema.parse({
      productId: ' p-1 ',
      vehicleConfigurationId: ' vc-1 ',
    })

    expect(result).toEqual({
      productId: 'p-1',
      vehicleConfigurationId: 'vc-1',
    })
  })
})