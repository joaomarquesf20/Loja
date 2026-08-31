import { describe, expect, test } from 'vitest'
import {
  emailSchema,
  passwordSchema,
  quantitySchema,
  idSchema,
} from './validation'

describe('emailSchema', () => {
  test('email válido passa', () => {
    const result = emailSchema.safeParse('test@example.com')
    expect(result.success).toBe(true)
  })

  test('email inválido falha', () => {
    const result = emailSchema.safeParse('invalid-email')
    expect(result.success).toBe(false)
  })
})

describe('passwordSchema', () => {
  test('8 ou mais caracteres passa', () => {
    const result = passwordSchema.safeParse('12345678')
    expect(result.success).toBe(true)
  })

  test('menos de 8 falha', () => {
    const result = passwordSchema.safeParse('1234567')
    expect(result.success).toBe(false)
  })
})

describe('quantitySchema', () => {
  test('inteiro positivo passa', () => {
    const result = quantitySchema.safeParse(5)
    expect(result.success).toBe(true)
  })

  test('0 falha', () => {
    const result = quantitySchema.safeParse(0)
    expect(result.success).toBe(false)
  })

  test('negativo falha', () => {
    const result = quantitySchema.safeParse(-5)
    expect(result.success).toBe(false)
  })

  test('decimal falha', () => {
    const result = quantitySchema.safeParse(1.5)
    expect(result.success).toBe(false)
  })
})

describe('idSchema', () => {
  test('string não vazia passa', () => {
    const result = idSchema.safeParse('product-1')
    expect(result.success).toBe(true)
  })

  test('string vazia falha', () => {
    const result = idSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  test('string só com espaços falha', () => {
    const result = idSchema.safeParse('   ')
    expect(result.success).toBe(false)
  })
})