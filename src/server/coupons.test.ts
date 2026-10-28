import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import {
  COUPON_CODE_MAX_LENGTH,
  applyCouponToOrder,
  couponAmountToCents,
  evaluateCoupon,
  incrementCouponUsage,
  readCartSubtotalCents,
  validateCouponCode,
  couponValidationSchema,
  CouponRejectedError,
  type CouponRecord,
} from './coupons'

vi.mock('./db', () => ({
  prisma: {},
}))

/**
 * Épico 7 — testes do motor de cupões: validação estrita (Zod),
 * verificações de negócio (janela temporal, limite, total mínimo),
 * cálculo do desconto com limites e o incremento atómico do uso.
 */

function createCouponRecord(
  overrides: Record<string, unknown> = {},
): CouponRecord {
  return {
    id: 'coupon-1',
    code: 'PROMO10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderValue: null,
    maxUses: null,
    usedCount: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    ...overrides,
  }
}

function createDbClient(
  coupon: CouponRecord | null = null,
) {
  return {
    coupon: {
      findUnique: vi.fn(
        async () => coupon,
      ),
    },
  }
}

function createTx(
  coupon: CouponRecord | null = null,
  updateCount = 1,
) {
  return {
    coupon: {
      findUnique: vi.fn(
        async () => coupon,
      ),
      updateMany: vi.fn(
        async () => ({
          count: updateCount,
        }),
      ),
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(
    new Date('2026-10-28T12:00:00.000Z'),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('couponValidationSchema', () => {
  test('normaliza o código: trim + maiúsculas', () => {
    const parsed =
      couponValidationSchema.parse({
        code: '  promo10  ',
        cartTotal: 49.9,
      })

    expect(parsed.code).toBe('PROMO10')
  })

  test('rejeita código vazio', () => {
    expect(() =>
      couponValidationSchema.parse({
        code: '   ',
        cartTotal: 49.9,
      }),
    ).toThrow(
      'Introduz um código de cupão válido',
    )
  })

  test('rejeita código acima do limite', () => {
    expect(() =>
      couponValidationSchema.parse({
        code: 'A'.repeat(
          COUPON_CODE_MAX_LENGTH + 1,
        ),
        cartTotal: 49.9,
      }),
    ).toThrow(
      'O código de cupão não pode exceder 40 caracteres',
    )
  })

  test('rejeita código não textual', () => {
    expect(() =>
      couponValidationSchema.parse({
        code: 42,
        cartTotal: 49.9,
      }),
    ).toThrow(
      'Introduz um código de cupão válido',
    )
  })

  test('coerção do total: texto numérico é aceite', () => {
    const parsed =
      couponValidationSchema.parse({
        code: 'PROMO10',
        cartTotal: '49.90',
      })

    expect(parsed.cartTotal).toBe(49.9)
  })

  test('rejeita total negativo', () => {
    expect(() =>
      couponValidationSchema.parse({
        code: 'PROMO10',
        cartTotal: -1,
      }),
    ).toThrow(
      'O total do carrinho não pode ser negativo',
    )
  })

  test('rejeita total não numérico', () => {
    expect(() =>
      couponValidationSchema.parse({
        code: 'PROMO10',
        cartTotal: 'muito',
      }),
    ).toThrow(
      'O total do carrinho deve ser um número',
    )
  })

  test('rejeita total acima do máximo', () => {
    expect(() =>
      couponValidationSchema.parse({
        code: 'PROMO10',
        cartTotal: 1000000,
      }),
    ).toThrow(
      'O total do carrinho excede o máximo suportado',
    )
  })
})

describe('validateCouponCode', () => {
  test('valida cupão PERCENTAGE com desconto e total atualizado', async () => {
    const db = createDbClient(
      createCouponRecord({
        discountType: 'PERCENTAGE',
        discountValue: 10,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'promo10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(result).toEqual({
      valid: true,
      coupon: {
        id: 'coupon-1',
        code: 'PROMO10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
      },
      discount: 4.99,
      newTotal: 44.91,
    })
  })

  test('valida cupão FIXED_AMOUNT', async () => {
    const db = createDbClient(
      createCouponRecord({
        discountType: 'FIXED_AMOUNT',
        discountValue: 5,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(result).toEqual({
      valid: true,
      coupon: expect.objectContaining({
        discountType:
          'FIXED_AMOUNT',
        discountValue: 5,
      }),
      discount: 5,
      newTotal: 44.9,
    })
  })

  test('código inexistente → NOT_FOUND (200, não erro)', async () => {
    const db = createDbClient(null)

    const result =
      await validateCouponCode(
        {
          code: 'NAOEXISTE',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(result).toEqual({
      valid: false,
      reason: 'NOT_FOUND',
      message:
        'Código de cupão não encontrado.',
    })
  })

  test('cupão inativo → INACTIVE', async () => {
    const db = createDbClient(
      createCouponRecord({
        isActive: false,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(result).toEqual({
      valid: false,
      reason: 'INACTIVE',
      message:
        'Este cupão não está ativo.',
    })
  })

  test('antes de startsAt → NOT_STARTED', async () => {
    const db = createDbClient(
      createCouponRecord({
        startsAt: new Date(
          '2026-10-28T12:00:01.000Z',
        ),
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(result).toEqual({
      valid: false,
      reason: 'NOT_STARTED',
      message:
        'Este cupão ainda não está ativo.',
    })
  })

  test('startsAt no instante atual é inclusivo', async () => {
    const db = createDbClient(
      createCouponRecord({
        startsAt: new Date(
          '2026-10-28T12:00:00.000Z',
        ),
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(
      result.valid,
    ).toBe(true)
  })

  test('depois de expiresAt → EXPIRED', async () => {
    const db = createDbClient(
      createCouponRecord({
        expiresAt: new Date(
          '2026-10-28T11:59:59.000Z',
        ),
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(result).toEqual({
      valid: false,
      reason: 'EXPIRED',
      message:
        'Este cupão expirou.',
    })
  })

  test('expiresAt no instante atual já expirou', async () => {
    const db = createDbClient(
      createCouponRecord({
        expiresAt: new Date(
          '2026-10-28T12:00:00.000Z',
        ),
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(
      result.valid,
    ).toBe(false)
    expect(
      (result as { reason: string })
        .reason,
    ).toBe('EXPIRED')
  })

  test('usedCount >= maxUses → LIMIT_REACHED', async () => {
    const db = createDbClient(
      createCouponRecord({
        maxUses: 5,
        usedCount: 5,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(result).toEqual({
      valid: false,
      reason: 'LIMIT_REACHED',
      message:
        'Este cupão já atingiu o limite de utilizações.',
    })
  })

  test('subtotal abaixo de minOrderValue → MIN_ORDER_NOT_MET', async () => {
    const db = createDbClient(
      createCouponRecord({
        minOrderValue: 20,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 19.99,
        },
        db as never,
      )

    expect(result).toEqual({
      valid: false,
      reason: 'MIN_ORDER_NOT_MET',
      message:
        'Este cupão exige um subtotal mínimo de 20.00 €.',
    })
  })

  test('subtotal exatamente igual a minOrderValue é válido', async () => {
    const db = createDbClient(
      createCouponRecord({
        minOrderValue: 20,
        discountType:
          'FIXED_AMOUNT',
        discountValue: 5,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 20,
        },
        db as never,
      )

    expect(
      result.valid,
    ).toBe(true)
  })

  test('fixo acima do carrinho é limitado ao total (newTotal 0)', async () => {
    const db = createDbClient(
      createCouponRecord({
        discountType:
          'FIXED_AMOUNT',
        discountValue: 100,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(
      result.valid,
    ).toBe(true)
    expect(
      (result as { discount: number })
        .discount,
    ).toBe(49.9)
    expect(
      (result as { newTotal: number })
        .newTotal,
    ).toBe(0)
  })

  test('percentagem > 100 é limitada ao carrinho', async () => {
    const db = createDbClient(
      createCouponRecord({
        discountValue: 150,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(
      result.valid,
    ).toBe(true)
    expect(
      (result as { discount: number })
        .discount,
    ).toBe(49.9)
    expect(
      (result as { newTotal: number })
        .newTotal,
    ).toBe(0)
  })

  test('entrada malformada → ZodError (antes de tocar a BD)', async () => {
    const db = createDbClient()

    await expect(
      validateCouponCode(
        {
          code: 42,
          cartTotal: 49.9,
        },
        db as never,
      ),
    ).rejects.toThrow()

    expect(
      db.coupon.findUnique,
    ).not.toHaveBeenCalled()
  })

  test('precedência: cupão inativo e expirado → INACTIVE', async () => {
    const db = createDbClient(
      createCouponRecord({
        isActive: false,
        expiresAt: new Date(
          '2026-10-01T00:00:00.000Z',
        ),
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(
      (result as { reason: string })
        .reason,
    ).toBe('INACTIVE')
  })

  test('precedência: expirado e limite atingido → EXPIRED', async () => {
    const db = createDbClient(
      createCouponRecord({
        expiresAt: new Date(
          '2026-10-01T00:00:00.000Z',
        ),
        maxUses: 1,
        usedCount: 1,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(
      (result as { reason: string })
        .reason,
    ).toBe('EXPIRED')
  })

  test('precedência: limite atingido e total insuficiente → LIMIT_REACHED', async () => {
    const db = createDbClient(
      createCouponRecord({
        maxUses: 1,
        usedCount: 1,
        minOrderValue: 100,
      }),
    )

    const result =
      await validateCouponCode(
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
        db as never,
      )

    expect(
      (result as { reason: string })
        .reason,
    ).toBe('LIMIT_REACHED')
  })

  test('é leitura pura: não escreve nada na BD', async () => {
    const db = createDbClient(
      createCouponRecord(),
    )

    await validateCouponCode(
      {
        code: 'PROMO10',
        cartTotal: 49.9,
      },
      db as never,
    )

    expect(
      db.coupon.findUnique,
    ).toHaveBeenCalledTimes(1)
    expect(
      Object.keys(db),
    ).toEqual(['coupon'])
  })
})

describe('couponAmountToCents', () => {
  test('converte euros para cêntimos inteiros', () => {
    expect(
      couponAmountToCents(4.99),
    ).toBe(499)
    expect(
      couponAmountToCents(49.9),
    ).toBe(4990)
    expect(
      couponAmountToCents(0.1),
    ).toBe(10)
    expect(
      couponAmountToCents(12.345),
    ).toBe(1235)
  })
})

describe('evaluateCoupon', () => {
  test('devolve avaliação completa com maxUses', async () => {
    const tx = createTx(
      createCouponRecord({
        maxUses: 10,
      }),
    )

    const evaluation =
      await evaluateCoupon(
        tx as never,
        {
          code: 'promo10',
          cartTotal: 49.9,
        },
      )

    expect(evaluation).toEqual({
      couponId: 'coupon-1',
      code: 'PROMO10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      discount: 4.99,
      newTotal: 44.91,
      maxUses: 10,
    })
    expect(
      tx.coupon.updateMany,
    ).not.toHaveBeenCalled()
  })

  test('recusa cupão inativo com CouponRejectedError', async () => {
    const tx = createTx(
      createCouponRecord({
        isActive: false,
      }),
    )

    await expect(
      evaluateCoupon(tx as never, {
        code: 'PROMO10',
        cartTotal: 49.9,
      }),
    ).rejects.toThrow(
      CouponRejectedError,
    )

    await expect(
      evaluateCoupon(tx as never, {
        code: 'PROMO10',
        cartTotal: 49.9,
      }),
    ).rejects.toMatchObject({
      reason: 'INACTIVE',
    })
  })

  test('código inexistente → CouponRejectedError NOT_FOUND', async () => {
    const tx = createTx(null)

    await expect(
      evaluateCoupon(tx as never, {
        code: 'NAOEXISTE',
        cartTotal: 49.9,
      }),
    ).rejects.toMatchObject({
      reason: 'NOT_FOUND',
    })
  })
})

describe('incrementCouponUsage', () => {
  test('sem maxUses: guard é apenas o id', async () => {
    const tx = createTx()

    await incrementCouponUsage(
      tx as never,
      {
        couponId: 'coupon-1',
        maxUses: null,
      },
    )

    expect(
      tx.coupon.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'coupon-1',
      },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    })
  })

  test('com maxUses: guard com usedCount < maxUses', async () => {
    const tx = createTx()

    await incrementCouponUsage(
      tx as never,
      {
        couponId: 'coupon-1',
        maxUses: 5,
      },
    )

    expect(
      tx.coupon.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'coupon-1',
        usedCount: {
          lt: 5,
        },
      },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    })
  })

  test('count !== 1 → CouponRejectedError LIMIT_REACHED', async () => {
    const tx = createTx(null, 0)

    await expect(
      incrementCouponUsage(
        tx as never,
        {
          couponId: 'coupon-1',
          maxUses: 5,
        },
      ),
    ).rejects.toMatchObject({
      reason: 'LIMIT_REACHED',
      message:
        'Este cupão já não está disponível.',
    })
  })
})

describe('applyCouponToOrder', () => {
  test('avalia e incrementa o uso atomicamente', async () => {
    const tx = createTx(
      createCouponRecord({
        discountType:
          'FIXED_AMOUNT',
        discountValue: 5,
        maxUses: 3,
        usedCount: 1,
      }),
    )

    const evaluation =
      await applyCouponToOrder(
        tx as never,
        {
          code: 'promo10',
          cartTotal: 49.9,
        },
      )

    expect(evaluation).toEqual(
      expect.objectContaining({
        couponId: 'coupon-1',
        code: 'PROMO10',
        discount: 5,
        newTotal: 44.9,
      }),
    )

    expect(
      tx.coupon.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'coupon-1',
        usedCount: { lt: 3 },
      },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    })
  })

  test('cupão recusado → não incrementa o uso', async () => {
    const tx = createTx(
      createCouponRecord({
        minOrderValue: 100,
      }),
    )

    await expect(
      applyCouponToOrder(
        tx as never,
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
      ),
    ).rejects.toMatchObject({
      reason: 'MIN_ORDER_NOT_MET',
    })

    expect(
      tx.coupon.updateMany,
    ).not.toHaveBeenCalled()
  })

  test('guard perde a corrida (count 0) → LIMIT_REACHED', async () => {
    const tx = createTx(
      createCouponRecord({
        maxUses: 1,
        usedCount: 0,
      }),
      0,
    )

    await expect(
      applyCouponToOrder(
        tx as never,
        {
          code: 'PROMO10',
          cartTotal: 49.9,
        },
      ),
    ).rejects.toMatchObject({
      reason: 'LIMIT_REACHED',
    })
  })
})

describe('readCartSubtotalCents', () => {
  test('soma apenas itens vendáveis em cêntimos', async () => {
    const client = {
      cartItem: {
        findMany: vi.fn(
          async () => [
            {
              quantity: 2,
              variant: {
                isActive: true,
                price: {
                  toString: () =>
                    '49.90',
                },
              },
              product: {
                isActive: true,
              },
            },
            {
              quantity: 1,
              variant: {
                isActive: false,
                price: {
                  toString: () =>
                    '10.00',
                },
              },
              product: {
                isActive: true,
              },
            },
            {
              quantity: 3,
              variant: {
                isActive: true,
                price: {
                  toString: () =>
                    '7.50',
                },
              },
              product: {
                isActive: false,
              },
            },
          ],
        ),
      },
    }

    const record =
      await readCartSubtotalCents(
        'user-1',
        client as never,
      )

    expect(
      record.subtotalCents,
    ).toBe(9980)
    expect(
      record.itemCount,
    ).toBe(3)
    expect(
      client.cartItem.findMany,
    ).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
      orderBy: {
        id: 'asc',
      },
      select: expect.anything(),
    })
  })

  test('carrinho vazio → itemCount 0', async () => {
    const client = {
      cartItem: {
        findMany: vi.fn(
          async () => [],
        ),
      },
    }

    const record =
      await readCartSubtotalCents(
        'user-1',
        client as never,
      )

    expect(record).toEqual({
      subtotalCents: 0,
      itemCount: 0,
    })
  })

  test('userId vazio → sem consultar a BD', async () => {
    const client = {
      cartItem: {
        findMany: vi.fn(),
      },
    }

    const record =
      await readCartSubtotalCents(
        '  ',
        client as never,
      )

    expect(record).toEqual({
      subtotalCents: 0,
      itemCount: 0,
    })
    expect(
      client.cartItem.findMany,
    ).not.toHaveBeenCalled()
  })
})
