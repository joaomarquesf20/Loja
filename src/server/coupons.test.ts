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
  DEFAULT_ADMIN_COUPON_PAGE_SIZE,
  MAX_ADMIN_COUPON_PAGE_SIZE,
  adminCouponStatusFrom,
  applyCouponToOrder,
  couponAmountToCents,
  couponCreateSchema,
  createAdminCoupon,
  decrementCouponUsage,
  evaluateCoupon,
  incrementCouponUsage,
  listAdminCoupons,
  readCartSubtotalCents,
  toggleAdminCouponStatus,
  updateAdminCoupon,
  validateCouponCode,
  couponValidationSchema,
  CouponAdminNotFoundError,
  CouponCodeConflictError,
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

// ===========================================================================
// Épico 7 — etapa 2: reversão do uso + gestão admin
// ===========================================================================

describe(
  'decrementCouponUsage',
  () => {
    function createReversalTx(
      orderCount = 1,
      couponCount = 1,
    ) {
      return {
        order: {
          updateMany: vi.fn(
            async () => ({
              count: orderCount,
            }),
          ),
        },
        coupon: {
          updateMany: vi.fn(
            async () => ({
              count: couponCount,
            }),
          ),
        },
      }
    }

    test(
      'encomenda sem cupão → no-op sem tocar nos delegates',
      async () => {
        for (const couponCode of [
          null,
          undefined,
          '   ',
        ]) {
          const tx =
            createReversalTx()

          await expect(
            decrementCouponUsage(
              tx as never,
              {
                orderId:
                  'order-1',
                couponCode:
                  couponCode as
                    | null
                    | undefined,
              },
            ),
          ).resolves.toBe(
            false,
          )

          expect(
            tx.order.updateMany,
          ).not.toHaveBeenCalled()

          expect(
            tx.coupon
              .updateMany,
          ).not.toHaveBeenCalled()
        }
      },
    )

    test(
      'reverte o uso: marca a encomenda e decrementa o cupão',
      async () => {
        const tx =
          createReversalTx()

        const now =
          new Date(
            '2026-10-28T12:00:00.000Z',
          )

        await expect(
          decrementCouponUsage(
            tx as never,
            {
              orderId:
                'order-1',
              couponCode:
                'PROMO10',
              now,
            },
          ),
        ).resolves.toBe(true)

        expect(
          tx.order.updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 'order-1',
            couponReversedAt:
              null,
          },
          data: {
            couponReversedAt:
              now,
          },
        })

        expect(
          tx.coupon.updateMany,
        ).toHaveBeenCalledWith({
          where: {
            code: 'PROMO10',
            usedCount: {
              gt: 0,
            },
          },
          data: {
            usedCount: {
              decrement: 1,
            },
          },
        })

        // A marca precede o decremento: sem marca
        // escrita não há devolução de uso.
        expect(
          tx.order.updateMany.mock
            .invocationCallOrder[0],
        ).toBeLessThan(
          tx.coupon.updateMany.mock
            .invocationCallOrder[0],
        )
      },
    )

    test(
      'normaliza o código (trim + maiúsculas)',
      async () => {
        const tx =
          createReversalTx()

        await decrementCouponUsage(
          tx as never,
          {
            orderId:
              'order-1',
            couponCode:
              '  promo10  ',
          },
        )

        expect(
          tx.coupon.updateMany,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              expect.objectContaining(
                {
                  code: 'PROMO10',
                },
              ),
          }),
        )
      },
    )

    test(
      'uso já revertido → não decrementa outra vez',
      async () => {
        const tx =
          createReversalTx(0)

        await expect(
          decrementCouponUsage(
            tx as never,
            {
              orderId:
                'order-1',
              couponCode:
                'PROMO10',
            },
          ),
        ).resolves.toBe(false)

        expect(
          tx.coupon
            .updateMany,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'cupão eliminado → não lança e mantém a marca',
      async () => {
        const tx =
          createReversalTx(
            1,
            0,
          )

        await expect(
          decrementCouponUsage(
            tx as never,
            {
              orderId:
                'order-1',
              couponCode:
                'PROMO10',
            },
          ),
        ).resolves.toBe(false)

        expect(
          tx.order.updateMany,
        ).toHaveBeenCalledTimes(
          1,
        )
      },
    )
  },
)

describe(
  'adminCouponStatusFrom',
  () => {
    test(
      'cupão ativo sem limites → ACTIVE',
      () => {
        expect(
          adminCouponStatusFrom(
            createCouponRecord(),
          ),
        ).toBe('ACTIVE')
      },
    )

    test(
      'desativado tem precedência sobre expirado e limite',
      () => {
        expect(
          adminCouponStatusFrom(
            createCouponRecord({
              isActive: false,
              expiresAt:
                new Date(
                  '2026-10-01T00:00:00.000Z',
                ),
              maxUses: 2,
              usedCount: 2,
            }),
          ),
        ).toBe(
          'INACTIVE',
        )
      },
    )

    test(
      'expira na hora (expiresAt exclusivo)',
      () => {
        expect(
          adminCouponStatusFrom(
            createCouponRecord({
              expiresAt:
                new Date(
                  '2026-10-28T12:00:00.000Z',
                ),
            }),
          ),
        ).toBe('EXPIRED')
      },
    )

    test(
      'limite atingido → LIMIT_REACHED',
      () => {
        expect(
          adminCouponStatusFrom(
            createCouponRecord({
              maxUses: 5,
              usedCount: 5,
            }),
          ),
        ).toBe(
          'LIMIT_REACHED',
        )

        expect(
          adminCouponStatusFrom(
            createCouponRecord({
              maxUses: 5,
              usedCount: 4,
            }),
          ),
        ).toBe('ACTIVE')
      },
    )
  },
)

describe(
  'listAdminCoupons',
  () => {
    function createAdminDbClient(
      records: CouponRecord[],
    ) {
      const coupon = {
        findMany: vi.fn(
          async () =>
            records,
        ),
        findUnique:
          vi.fn(
            async () =>
              records[0] ??
              null,
          ),
        create: vi.fn(
          async ({
            data,
          }: {
            data: Record<
              string,
              unknown
            >
          }) =>
            createCouponRecord(
              data,
            ),
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: {
              id: string
            }
            data: Record<
              string,
              unknown
            >
          }) => {
            const base =
              records.find(
                (record) =>
                  record.id ===
                  where.id,
              )

            if (!base) {
              throw new Error(
                'fake update sem registo base',
              )
            }

            return createCouponRecord(
              {
                ...base,
                ...data,
              },
            )
          },
        ),
      }

      const client = {
        coupon,
        $transaction: vi.fn(
          async (
            callback: (
              transaction: unknown,
            ) => unknown,
          ) =>
            callback(
              client as never,
            ),
        ),
      }

      return client
    }

    function adminListRecords(): CouponRecord[] {
      return [
        createCouponRecord({
          id: 'coupon-1',
          code: 'PROMO10',
          usedCount: 3,
        }),
        createCouponRecord({
          id: 'coupon-2',
          code: 'OLD5',
          discountType:
            'FIXED_AMOUNT',
          discountValue: 5,
          isActive: false,
          usedCount: 2,
        }),
        createCouponRecord({
          id: 'coupon-3',
          code: 'EXPIRED10',
          expiresAt:
            new Date(
              '2026-10-01T00:00:00.000Z',
            ),
          usedCount: 1,
        }),
        createCouponRecord({
          id: 'coupon-4',
          code: 'LIMITED5',
          maxUses: 2,
          usedCount: 2,
        }),
      ]
    }

    test(
      'devolve todas as linhas com estado derivado + KPIs globais',
      async () => {
        const client =
          createAdminDbClient(
            adminListRecords(),
          )

        await expect(
          listAdminCoupons(
            undefined,
            client as never,
          ),
        ).resolves.toEqual({
          coupons: [
            expect.objectContaining(
              {
                code: 'PROMO10',
                status:
                  'ACTIVE',
              },
            ),
            expect.objectContaining(
              {
                code: 'OLD5',
                status:
                  'INACTIVE',
              },
            ),
            expect.objectContaining(
              {
                code: 'EXPIRED10',
                status:
                  'EXPIRED',
              },
            ),
            expect.objectContaining(
              {
                code: 'LIMITED5',
                status:
                  'LIMIT_REACHED',
              },
            ),
          ],
          total: 4,
          page: 1,
          pageSize:
            DEFAULT_ADMIN_COUPON_PAGE_SIZE,
          totalPages: 1,
          kpis: {
            totalCoupons: 4,
            activeCoupons: 1,
            totalUses: 8,
          },
        })
      },
    )

    test(
      'filtra por estado sem alterar os KPIs globais',
      async () => {
        const client =
          createAdminDbClient(
            adminListRecords(),
          )

        const page =
          await listAdminCoupons(
            {
              status: 'ACTIVE',
            },
            client as never,
          )

        expect(
          page.coupons.map(
            (row) =>
              row.code,
          ),
        ).toEqual(['PROMO10'])

        expect(
          page.total,
        ).toBe(1)

        expect(
          page.kpis,
        ).toEqual({
          totalCoupons: 4,
          activeCoupons: 1,
          totalUses: 8,
        })
      },
    )

    test(
      'pesquisa por código sem sensibilidade a maiúsculas',
      async () => {
        const client =
          createAdminDbClient(
            adminListRecords(),
          )

        const page =
          await listAdminCoupons(
            {
              search: 'promo',
            },
            client as never,
          )

        expect(
          page.coupons.map(
            (row) =>
              row.code,
          ),
        ).toEqual(['PROMO10'])
      },
    )

    test(
      'pagina com a última página real como teto',
      async () => {
        const client =
          createAdminDbClient(
            adminListRecords(),
          )

        const page =
          await listAdminCoupons(
            {
              page: 5,
              pageSize: 2,
            },
            client as never,
          )

        expect(
          page.page,
        ).toBe(2)

        expect(
          page.totalPages,
        ).toBe(2)

        expect(
          page.coupons.map(
            (row) =>
              row.code,
          ),
        ).toEqual([
          'EXPIRED10',
          'LIMITED5',
        ])
      },
    )

    test(
      'rejeita query inválida com ZodError',
      async () => {
        const client =
          createAdminDbClient([])

        await expect(
          listAdminCoupons(
            {
              page: 0,
            },
            client as never,
          ),
        ).rejects.toBeInstanceOf(
          Error,
        )

        await expect(
          listAdminCoupons(
            {
              pageSize:
                MAX_ADMIN_COUPON_PAGE_SIZE +
                1,
            },
            client as never,
          ),
        ).rejects.toBeInstanceOf(
          Error,
        )

        await expect(
          listAdminCoupons(
            {
              status: 'WEIRD',
            },
            client as never,
          ),
        ).rejects.toBeInstanceOf(
          Error,
        )
      },
    )

    test(
      'aceita o teto de pageSize',
      async () => {
        const client =
          createAdminDbClient(
            adminListRecords(),
          )

        const page =
          await listAdminCoupons(
            {
              pageSize:
                MAX_ADMIN_COUPON_PAGE_SIZE,
            },
            client as never,
          )

        expect(
          page.totalPages,
        ).toBe(1)
      },
    )
  },
)

describe(
  'couponCreateSchema',
  () => {
    test(
      'normaliza o código e aplica defaults',
      () => {
        const parsed =
          couponCreateSchema.parse(
            {
              code: ' promo10 ',
              discountType:
                'PERCENTAGE',
              discountValue:
                '10',
            },
          )

        expect(
          parsed.code,
        ).toBe('PROMO10')

        expect(
          parsed.discountValue,
        ).toBe(10)

        expect(
          parsed.isActive,
        ).toBe(true)

        expect(
          parsed.minOrderValue,
        ).toBeUndefined()

        expect(
          parsed.maxUses,
        ).toBeUndefined()
      },
    )

    test(
      'recusa percentagem acima de 100',
      () => {
        const result =
          couponCreateSchema.safeParse(
            {
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue: 101,
            },
          )

        expect(
          result.success,
        ).toBe(false)

        if (!result.success) {
          expect(
            result.error.issues[0]
              .path,
          ).toEqual([
            'discountValue',
          ])
        }
      },
    )

    test(
      'recusa valor zero e texto não numérico',
      () => {
        expect(
          couponCreateSchema.safeParse(
            {
              code: 'PROMO10',
              discountType:
                'FIXED_AMOUNT',
              discountValue: 0,
            },
          ).success,
        ).toBe(false)

        expect(
          couponCreateSchema.safeParse(
            {
              code: 'PROMO10',
              discountType:
                'FIXED_AMOUNT',
              discountValue:
                'muito',
            },
          ).success,
        ).toBe(false)
      },
    )

    test(
      'recusa janela temporal invertida',
      () => {
        const result =
          couponCreateSchema.safeParse(
            {
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue: 10,
              startsAt:
                '2026-11-01T00:00:00.000Z',
              expiresAt:
                '2026-10-01T00:00:00.000Z',
            },
          )

        expect(
          result.success,
        ).toBe(false)

        if (!result.success) {
          expect(
            result.error.issues[0]
              .path,
          ).toEqual(['expiresAt'])
        }
      },
    )

    test(
      'recusa maxUses inválido e datas malformadas',
      () => {
        expect(
          couponCreateSchema.safeParse(
            {
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue: 10,
              maxUses: 0,
            },
          ).success,
        ).toBe(false)

        expect(
          couponCreateSchema.safeParse(
            {
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue: 10,
              startsAt: 'banana',
            },
          ).success,
        ).toBe(false)
      },
    )

    test(
      'valor fixo acima de 100 é permitido',
      () => {
        const parsed =
          couponCreateSchema.parse(
            {
              code: 'GRANDE',
              discountType:
                'FIXED_AMOUNT',
              discountValue: 150,
            },
          )

        expect(
          parsed.discountValue,
        ).toBe(150)
      },
    )
  },
)

describe(
  'createAdminCoupon',
  () => {
    function createAdminDbClient(
      records: CouponRecord[],
      createImplementation?: (
        args: {
          data: Record<
            string,
            unknown
          >
        },
      ) => Promise<CouponRecord>,
    ) {
      const coupon = {
        findMany: vi.fn(
          async () =>
            records,
        ),
        findUnique:
          vi.fn(
            async () =>
              records[0] ??
              null,
          ),
        create: vi.fn(
          createImplementation ??
            (async ({
              data,
            }) =>
              createCouponRecord(
                data,
              )),
        ),
        update: vi.fn(),
      }

      return {
        coupon,
        $transaction: vi.fn(),
      }
    }

    test(
      'cria cupão com dados normalizados',
      async () => {
        const client =
          createAdminDbClient([])

        const row =
          await createAdminCoupon(
            {
              code: ' promo10 ',
              discountType:
                'PERCENTAGE',
              discountValue: 10,
            },
            client as never,
          )

        expect(
          client.coupon.create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue: 10,
              minOrderValue:
                null,
              maxUses: null,
              startsAt: null,
              expiresAt: null,
              isActive: true,
            },
          }),
        )

        expect(row).toEqual(
          expect.objectContaining(
            {
              code: 'PROMO10',
              status: 'ACTIVE',
              startsAt: null,
              expiresAt: null,
            },
          ),
        )
      },
    )

    test(
      'campos vazios tornam-se null',
      async () => {
        const client =
          createAdminDbClient([])

        await createAdminCoupon(
          {
            code: 'PROMO10',
            discountType:
              'PERCENTAGE',
            discountValue: 10,
            minOrderValue: '',
            maxUses: null,
          },
          client as never,
        )

        expect(
          client.coupon.create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining(
                {
                  minOrderValue:
                    null,
                  maxUses: null,
                },
              ),
          }),
        )
      },
    )

    test(
      'cupão criado inativo → INACTIVE',
      async () => {
        const client =
          createAdminDbClient([])

        const row =
          await createAdminCoupon(
            {
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue: 10,
              isActive: false,
            },
            client as never,
          )

        expect(
          row.status,
        ).toBe('INACTIVE')
      },
    )

    test(
      'colisão de código → CouponCodeConflictError',
      async () => {
        const p2002 =
          Object.assign(
            new Error(
              'Unique constraint failed',
            ),
            { code: 'P2002' },
          )

        const client =
          createAdminDbClient(
            [],
            async () => {
              throw p2002
            },
          )

        await expect(
          createAdminCoupon(
            {
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue: 10,
            },
            client as never,
          ),
        ).rejects.toBeInstanceOf(
          CouponCodeConflictError,
        )
      },
    )

    test(
      'erro inesperado propaga sem conversão',
      async () => {
        const client =
          createAdminDbClient(
            [],
            async () => {
              throw new Error(
                'boom',
              )
            },
          )

        await expect(
          createAdminCoupon(
            {
              code: 'PROMO10',
              discountType:
                'PERCENTAGE',
              discountValue: 10,
            },
            client as never,
          ),
        ).rejects.toThrow('boom')
      },
    )
  },
)

describe(
  'updateAdminCoupon + toggleAdminCouponStatus',
  () => {
    function createAdminDbClient(
      records: CouponRecord[],
    ) {
      const coupon = {
        findMany: vi.fn(
          async () =>
            records,
        ),
        findUnique:
          vi.fn(
            async ({
              where,
            }: {
              where: {
                id: string
              }
            }) =>
              records.find(
                (record) =>
                  record.id ===
                  where.id,
              ) ?? null,
          ),
        create: vi.fn(),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: {
              id: string
            }
            data: Record<
              string,
              unknown
            >
          }) => {
            const base =
              records.find(
                (record) =>
                  record.id ===
                  where.id,
              )

            if (!base) {
              throw new Error(
                'fake update sem registo base',
              )
            }

            return createCouponRecord(
              {
                ...base,
                ...data,
              },
            )
          },
        ),
      }

      const client = {
        coupon,
        $transaction: vi.fn(
          async (
            callback: (
              transaction: unknown,
            ) => unknown,
          ) =>
            callback(
              client as never,
            ),
        ),
      }

      return client
    }

    test(
      'toggle isActive para inativo',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord(),
          ])

        const row =
          await updateAdminCoupon(
            'coupon-1',
            {
              isActive: false,
            },
            client as never,
          )

        expect(
          client.coupon.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: 'coupon-1',
            },
            data: {
              isActive: false,
            },
          }),
        )

        expect(
          row.status,
        ).toBe('INACTIVE')
      },
    )

    test(
      'edita limites mantendo code/discountType imutáveis',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord(),
          ])

        const row =
          await updateAdminCoupon(
            'coupon-1',
            {
              discountValue: 20,
              maxUses: 10,
            },
            client as never,
          )

        expect(
          client.coupon.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.not.objectContaining(
                {
                  code:
                    expect.anything(),
                  discountType:
                    expect.anything(),
                },
              ),
          }),
        )

        expect(
          row.discountValue,
        ).toBe(20)

        expect(
          row.maxUses,
        ).toBe(10)
      },
    )

    test(
      'null limpa os limites anuláveis',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord({
              minOrderValue: 50,
              maxUses: 5,
              startsAt:
                new Date(
                  '2026-10-01T00:00:00.000Z',
                ),
              expiresAt:
                new Date(
                  '2026-11-01T00:00:00.000Z',
                ),
            }),
          ])

        const row =
          await updateAdminCoupon(
            'coupon-1',
            {
              minOrderValue:
                null,
              maxUses: null,
              startsAt: null,
              expiresAt: null,
            },
            client as never,
          )

        expect(
          client.coupon.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              minOrderValue:
                null,
              maxUses: null,
              startsAt: null,
              expiresAt: null,
            },
          }),
        )

        expect(
          row.minOrderValue,
        ).toBeNull()

        expect(
          row.maxUses,
        ).toBeNull()
      },
    )

    test(
      'cupão inexistente → CouponAdminNotFoundError',
      async () => {
        const client =
          createAdminDbClient([])

        await expect(
          updateAdminCoupon(
            'coupon-404',
            {
              isActive: false,
            },
            client as never,
          ),
        ).rejects.toBeInstanceOf(
          CouponAdminNotFoundError,
        )
      },
    )

    test(
      'id inválido → CouponAdminNotFoundError sem tocar na BD',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord(),
          ])

        await expect(
          updateAdminCoupon(
            '   ',
            {
              isActive: false,
            },
            client as never,
          ),
        ).rejects.toBeInstanceOf(
          CouponAdminNotFoundError,
        )

        expect(
          client.coupon
            .findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'percentagem acima de 100 no tipo atual → CouponAdminValidationError',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord({
              discountType:
                'PERCENTAGE',
            }),
          ])

        await expect(
          updateAdminCoupon(
            'coupon-1',
            {
              discountValue: 150,
            },
            client as never,
          ),
        ).rejects.toMatchObject({
          name: 'CouponAdminValidationError',
          field: 'discountValue',
        })
      },
    )

    test(
      'valor fixo acima de 100 é permitido',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord({
              discountType:
                'FIXED_AMOUNT',
            }),
          ])

        const row =
          await updateAdminCoupon(
            'coupon-1',
            {
              discountValue: 150,
            },
            client as never,
          )

        expect(
          row.discountValue,
        ).toBe(150)
      },
    )

    test(
      'janela temporal mesclada inválida → CouponAdminValidationError',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord(),
          ])

        await expect(
          updateAdminCoupon(
            'coupon-1',
            {
              startsAt:
                '2026-12-01T00:00:00.000Z',
              expiresAt:
                '2026-11-01T00:00:00.000Z',
            },
            client as never,
          ),
        ).rejects.toMatchObject({
          name: 'CouponAdminValidationError',
          field: 'expiresAt',
        })

        // Patch isolado (só expiresAt) contra o startsAt
        // atual também é apanhado.
        const client2 =
          createAdminDbClient([
            createCouponRecord({
              startsAt:
                new Date(
                  '2026-11-01T00:00:00.000Z',
                ),
            }),
          ])

        await expect(
          updateAdminCoupon(
            'coupon-1',
            {
              expiresAt:
                '2026-10-01T00:00:00.000Z',
            },
            client2 as never,
          ),
        ).rejects.toMatchObject({
          field: 'expiresAt',
        })
      },
    )

    test(
      'corpo vazio → ZodError',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord(),
          ])

        await expect(
          updateAdminCoupon(
            'coupon-1',
            {},
            client as never,
          ),
        ).rejects.toBeInstanceOf(
          Error,
        )

        expect(
          client.coupon
            .findUnique,
        ).not.toHaveBeenCalled()
      },
    )

    test(
      'toggleAdminCouponStatus exige booleano e delega na atualização',
      async () => {
        const client =
          createAdminDbClient([
            createCouponRecord({
              isActive: false,
            }),
          ])

        await expect(
          toggleAdminCouponStatus(
            {
              id: 'coupon-1',
            },
            client as never,
          ),
        ).rejects.toMatchObject({
          field: 'isActive',
        })

        const row =
          await toggleAdminCouponStatus(
            {
              id: 'coupon-1',
              isActive: true,
            },
            client as never,
          )

        expect(
          client.coupon.update,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              isActive: true,
            },
          }),
        )

        expect(
          row.status,
        ).toBe('ACTIVE')
      },
    )
  },
)
