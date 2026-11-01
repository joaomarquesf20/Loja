import { describe, expect, test } from 'vitest'

import { productCompatibilitySchema } from './product-compatibility-validation'

describe('product compatibility validation', () => {
  test('rejeita productId vazio', () => {
    expect(() =>
      productCompatibilitySchema.parse({
        productId: '',
        vehicleSpecId: 'spec-1',
      }),
    ).toThrow()
  })

  test('rejeita productId apenas com espaços', () => {
    expect(() =>
      productCompatibilitySchema.parse({
        productId: '   ',
        vehicleSpecId: 'spec-1',
      }),
    ).toThrow()
  })

  test('rejeita vehicleSpecId vazio', () => {
    expect(() =>
      productCompatibilitySchema.parse({
        productId: 'p-1',
        vehicleSpecId: '',
      }),
    ).toThrow()
  })

  test('rejeita vehicleSpecId apenas com espaços', () => {
    expect(() =>
      productCompatibilitySchema.parse({
        productId: 'p-1',
        vehicleSpecId: '   ',
      }),
    ).toThrow()
  })

  test('aceita dados válidos', () => {
    const result = productCompatibilitySchema.parse({
      productId: 'p-1',
      vehicleSpecId: 'spec-1',
    })

    expect(result).toEqual({
      productId: 'p-1',
      vehicleSpecId: 'spec-1',
      notes: null,
    })
  })

  test('remove espaços no início e fim', () => {
    const result = productCompatibilitySchema.parse({
      productId: ' p-1 ',
      vehicleSpecId: ' spec-1 ',
    })

    expect(result).toEqual({
      productId: 'p-1',
      vehicleSpecId: 'spec-1',
      notes: null,
    })
  })

  test('aceita notas opcionais e converte vazias em null', () => {
    const result = productCompatibilitySchema.parse({
      productId: 'p-1',
      vehicleSpecId: 'spec-1',
      notes: '  ',
    })

    expect(result.notes).toBeNull()

    const withNotes = productCompatibilitySchema.parse({
      productId: 'p-1',
      vehicleSpecId: 'spec-1',
      notes: 'requer apoios originais',
    })

    expect(withNotes.notes).toBe(
      'requer apoios originais',
    )
  })
})
