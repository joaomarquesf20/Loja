import {
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest'
import { ZodError } from 'zod'

import {
  couponValidationSchema,
} from '@/server/coupons'
import {
  RequestPayloadTooLargeError,
} from '@/server/http-request'

const mocks = vi.hoisted(() => {
  class UnauthorizedUserError extends Error {
    constructor(message = 'Não autenticado') {
      super(message)
      this.name = 'UnauthorizedUserError'
    }
  }

  return {
    requireActiveUserId: vi.fn(),
    readCartSubtotalCents: vi.fn(),
    validateCouponCode: vi.fn(),
    UnauthorizedUserError,
  }
})

vi.mock('@/server/db', () => ({
  prisma: {},
}))

vi.mock('@/server/user-auth', () => ({
  requireActiveUserId: mocks.requireActiveUserId,
  UnauthorizedUserError: mocks.UnauthorizedUserError,
}))

vi.mock('@/server/coupons', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readCartSubtotalCents:
    mocks.readCartSubtotalCents,
  validateCouponCode:
    mocks.validateCouponCode,
}))

import { POST } from './route'

/**
 * Épico 7 — testes do endpoint de validação de cupões: autenticação,
 * subtotal calculado no servidor, EMPTY_CART, mapeamento ZodError → 400
 * e passthrough do resultado de negócio (200).
 */

function createRequest(
  body: string,
) {
  return new Request(
    'http://localhost/api/checkout/coupons/validate',
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/json',
      },
      body,
    },
  )
}

function makeZodError(): ZodError {
  try {
    couponValidationSchema.parse({
      code: '',
      cartTotal: 49.9,
    })
  } catch (error) {
    return error as ZodError
  }

  throw new Error('unreachable')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireActiveUserId.mockResolvedValue(
    'user-1',
  )
  mocks.readCartSubtotalCents.mockResolvedValue(
    {
      subtotalCents: 4990,
      itemCount: 2,
    },
  )
  mocks.validateCouponCode.mockResolvedValue(
    {
      valid: true,
      coupon: {
        id: 'coupon-1',
        code: 'PROMO10',
        discountType:
          'PERCENTAGE',
        discountValue: 10,
      },
      discount: 4.99,
      newTotal: 44.91,
    },
  )
})

test(
  'devolve 200 com o resultado válido do serviço',
  async () => {
    const response = await POST(
      createRequest(
        JSON.stringify({ code: 'promo10' }),
      ),
    )

    expect(
      response.status,
    ).toBe(200)
    await expect(
      response.json(),
    ).resolves.toEqual({
      valid: true,
      coupon: {
        id: 'coupon-1',
        code: 'PROMO10',
        discountType:
          'PERCENTAGE',
        discountValue: 10,
      },
      discount: 4.99,
      newTotal: 44.91,
    })

    expect(
      mocks.validateCouponCode,
    ).toHaveBeenCalledWith({
      code: 'promo10',
      cartTotal: 49.9,
    })
  },
)

test(
  'devolve 200 com resultado inválido (negócio, não erro)',
  async () => {
    mocks.validateCouponCode.mockResolvedValue(
      {
        valid: false,
        reason: 'EXPIRED',
        message:
          'Este cupão expirou.',
      },
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ code: 'PROMO10' }),
      ),
    )

    expect(
      response.status,
    ).toBe(200)
    await expect(
      response.json(),
    ).resolves.toEqual({
      valid: false,
      reason: 'EXPIRED',
      message:
        'Este cupão expirou.',
    })
  },
)

test(
  'carrinho vazio → EMPTY_CART sem chamar o serviço',
  async () => {
    mocks.readCartSubtotalCents.mockResolvedValue(
      {
        subtotalCents: 0,
        itemCount: 0,
      },
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ code: 'PROMO10' }),
      ),
    )

    expect(
      response.status,
    ).toBe(200)
    await expect(
      response.json(),
    ).resolves.toEqual({
      valid: false,
      reason: 'EMPTY_CART',
      message:
        'O carrinho está vazio. Adiciona produtos antes de aplicar um cupão.',
    })

    expect(
      mocks.validateCouponCode,
    ).not.toHaveBeenCalled()
  },
)

test(
  'não autenticado → 401',
  async () => {
    mocks.requireActiveUserId.mockRejectedValue(
      new mocks.UnauthorizedUserError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ code: 'PROMO10' }),
      ),
    )

    expect(
      response.status,
    ).toBe(401)
    await expect(
      response.json(),
    ).resolves.toEqual({
      error: 'Não autenticado',
      code: 'UNAUTHENTICATED',
    })
    expect(
      mocks.readCartSubtotalCents,
    ).not.toHaveBeenCalled()
  },
)

test(
  'JSON inválido → 400',
  async () => {
    const response = await POST(
      createRequest('{não é json'),
    )

    expect(
      response.status,
    ).toBe(400)
    await expect(
      response.json(),
    ).resolves.toEqual({
      error: 'JSON inválido',
      code: 'INVALID_JSON',
    })
  },
)

test(
  'corpo não objeto → passa code undefined ao serviço',
  async () => {
    const response = await POST(
      createRequest(
        JSON.stringify([1, 2, 3]),
      ),
    )

    expect(
      response.status,
    ).toBe(200)
    expect(
      mocks.validateCouponCode,
    ).toHaveBeenCalledWith({
      code: undefined,
      cartTotal: 49.9,
    })
  },
)

test(
  'payload demasiado grande → 413',
  async () => {
    mocks.readCartSubtotalCents.mockRejectedValue(
      new RequestPayloadTooLargeError(
        4096,
      ),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ code: 'PROMO10' }),
      ),
    )

    expect(
      response.status,
    ).toBe(413)
    await expect(
      response.json(),
    ).resolves.toEqual({
      error:
        'Pedido demasiado grande',
      code: 'PAYLOAD_TOO_LARGE',
    })
  },
)

test(
  'ZodError com issue do código → 400 com a mensagem do campo',
  async () => {
    mocks.validateCouponCode.mockRejectedValue(
      makeZodError(),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ code: '' }),
      ),
    )

    expect(
      response.status,
    ).toBe(400)
    await expect(
      response.json(),
    ).resolves.toEqual({
      error:
        'Introduz um código de cupão válido',
    })
  },
)

test(
  'erro inesperado → 500 genérico',
  async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    mocks.validateCouponCode.mockRejectedValue(
      new Error('Erro inesperado'),
    )

    const response = await POST(
      createRequest(
        JSON.stringify({ code: 'PROMO10' }),
      ),
    )

    expect(
      response.status,
    ).toBe(500)
    await expect(
      response.json(),
    ).resolves.toEqual({
      error: 'Erro interno do servidor',
    })

    consoleError.mockRestore()
  },
)
