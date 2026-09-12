import {
  describe,
  expect,
  test,
} from 'vitest'
import {
  emailSchema,
  idSchema,
  passwordSchema,
  quantitySchema,
} from './validation'

describe('emailSchema', () => {
  test('email válido passa', () => {
    const result =
      emailSchema.safeParse(
        'test@example.com',
      )

    expect(result.success).toBe(
      true,
    )
  })

  test('normaliza espaços e maiúsculas', () => {
    const result =
      emailSchema.safeParse(
        '  Cliente@Example.COM  ',
      )

    expect(result.success).toBe(
      true,
    )

    if (!result.success) {
      throw new Error(
        'Email deveria ser válido',
      )
    }

    expect(result.data).toBe(
      'cliente@example.com',
    )
  })

  test('email inválido falha', () => {
    const result =
      emailSchema.safeParse(
        'invalid-email',
      )

    expect(result.success).toBe(
      false,
    )
  })

  test('email demasiado longo falha', () => {
    const result =
      emailSchema.safeParse(
        `${'a'.repeat(
          245,
        )}@example.com`,
      )

    expect(result.success).toBe(
      false,
    )
  })
})

describe('passwordSchema', () => {
  test('8 ou mais caracteres passa', () => {
    const result =
      passwordSchema.safeParse(
        '12345678',
      )

    expect(result.success).toBe(
      true,
    )
  })

  test('menos de 8 falha', () => {
    const result =
      passwordSchema.safeParse(
        '1234567',
      )

    expect(result.success).toBe(
      false,
    )
  })

  test('72 bytes ASCII passam', () => {
    const result =
      passwordSchema.safeParse(
        'a'.repeat(72),
      )

    expect(result.success).toBe(
      true,
    )
  })

  test('mais de 72 bytes falha', () => {
    const result =
      passwordSchema.safeParse(
        'a'.repeat(73),
      )

    expect(result.success).toBe(
      false,
    )
  })

  test('limite usa bytes UTF-8', () => {
    const result =
      passwordSchema.safeParse(
        'á'.repeat(37),
      )

    expect(result.success).toBe(
      false,
    )
  })
})

describe('quantitySchema', () => {
  test('inteiro positivo passa', () => {
    const result =
      quantitySchema.safeParse(5)

    expect(result.success).toBe(
      true,
    )
  })

  test('0 falha', () => {
    const result =
      quantitySchema.safeParse(0)

    expect(result.success).toBe(
      false,
    )
  })

  test('negativo falha', () => {
    const result =
      quantitySchema.safeParse(-5)

    expect(result.success).toBe(
      false,
    )
  })

  test('decimal falha', () => {
    const result =
      quantitySchema.safeParse(1.5)

    expect(result.success).toBe(
      false,
    )
  })

  test('quantidade acima do limite falha', () => {
    const result =
      quantitySchema.safeParse(
        1001,
      )

    expect(result.success).toBe(
      false,
    )
  })
})

describe('idSchema', () => {
  test('string não vazia passa', () => {
    const result =
      idSchema.safeParse(
        'product-1',
      )

    expect(result.success).toBe(
      true,
    )
  })

  test('string vazia falha', () => {
    const result =
      idSchema.safeParse('')

    expect(result.success).toBe(
      false,
    )
  })

  test('string só com espaços falha', () => {
    const result =
      idSchema.safeParse('   ')

    expect(result.success).toBe(
      false,
    )
  })

  test('id demasiado longo falha', () => {
    const result =
      idSchema.safeParse(
        'a'.repeat(201),
      )

    expect(result.success).toBe(
      false,
    )
  })
})