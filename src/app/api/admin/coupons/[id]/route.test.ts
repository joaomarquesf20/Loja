import { ZodError } from 'zod'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock(
  '@/server/admin-auth',
  () => {
    class UnauthorizedError extends Error {}
    class ForbiddenError extends Error {}

    return {
      UnauthorizedError,
      ForbiddenError,
      requireAdmin: vi.fn(),
    }
  },
)

vi.mock(
  '@/server/coupons',
  () => {
    class CouponAdminNotFoundError extends Error {}
    class CouponAdminValidationError extends Error {
      constructor(
        field: string,
        message: string,
      ) {
        super(message)
      }
    }
    class CouponCodeConflictError extends Error {}

    return {
      CouponAdminNotFoundError,
      CouponAdminValidationError,
      CouponCodeConflictError,
      updateAdminCoupon:
        vi.fn(),
      toggleAdminCouponStatus:
        vi.fn(),
    }
  },
)

vi.mock(
  '@/server/http-request',
  () => ({
    RequestPayloadTooLargeError:
      class RequestPayloadTooLargeError extends Error {},
    InvalidJsonBodyError:
      class InvalidJsonBodyError extends Error {},
    readJsonBody:
      vi.fn(),
  }),
)

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  CouponAdminNotFoundError,
  CouponAdminValidationError,
  updateAdminCoupon,
} from '@/server/coupons'
import {
  readJsonBody,
} from '@/server/http-request'
import {
  PATCH,
} from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockUpdateAdminCoupon =
  vi.mocked(updateAdminCoupon)

const mockReadJsonBody =
  vi.mocked(readJsonBody)

const routeContext = {
  params: Promise.resolve({
    id: 'coupon-1',
  }),
}

function createPatchRequest(
  body: unknown,
) {
  return new Request(
    'http://localhost/api/admin/coupons/coupon-1',
    {
      method: 'PATCH',
      headers: {
        'content-type':
          'application/json',
      },
      body:
        JSON.stringify(
          body,
        ),
    },
  )
}

function createCouponRow() {
  return {
    id: 'coupon-1',
    code: 'PROMO10',
    discountType:
      'PERCENTAGE',
    discountValue: 10,
    minOrderValue: null,
    maxUses: null,
    usedCount: 3,
    startsAt: null,
    expiresAt: null,
    isActive: false,
    status: 'INACTIVE',
  }
}

describe(
  'Admin Coupon Detail API',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mockReadJsonBody.mockImplementation(
        async (
          request: Request,
        ) =>
          JSON.parse(
            await request.text(),
          ),
      )

      mockRequireAdmin.mockResolvedValue(
        {
          user: {
            id: 'admin-test',
            role: 'ADMIN',
          },
        } as Awaited<
          ReturnType<
            typeof requireAdmin
          >
        >,
      )
    })

    test(
      'atualiza cupão com status 200',
      async () => {
        const coupon =
          createCouponRow()

        mockUpdateAdminCoupon.mockResolvedValue(
          coupon as never,
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(200)

        expect(
          await response.json(),
        ).toEqual(
          coupon,
        )

        expect(
          mockUpdateAdminCoupon,
        ).toHaveBeenCalledWith(
          'coupon-1',
          {
            isActive: false,
          },
        )
      },
    )

    test(
      'devolve 401 sem autenticação',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new UnauthorizedError(),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(401)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Não autenticado',
        })
      },
    )

    test(
      'devolve 403 sem autorização ADMIN',
      async () => {
        mockRequireAdmin.mockRejectedValue(
          new ForbiddenError(),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(403)
      },
    )

    test(
      'devolve 400 para ZodError com fieldErrors',
      async () => {
        mockUpdateAdminCoupon.mockRejectedValue(
          new ZodError([]),
        )

        const response =
          await PATCH(
            createPatchRequest({}),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Dados inválidos',
          fieldErrors:
            {},
        })
      },
    )

    test(
      'devolve 400 para validação de negócio',
      async () => {
        const validationError =
          new CouponAdminValidationError(
            'discountValue',
            'A percentagem de desconto não pode exceder 100%',
          )

        mockUpdateAdminCoupon.mockRejectedValue(
          validationError,
        )

        const response =
          await PATCH(
            createPatchRequest({
              discountValue:
                150,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(400)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'A percentagem de desconto não pode exceder 100%',
        })
      },
    )

    test(
      'devolve 404 para cupão inexistente',
      async () => {
        mockUpdateAdminCoupon.mockRejectedValue(
          new CouponAdminNotFoundError(
            'Cupão não encontrado',
          ),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(404)

        expect(
          await response.json(),
        ).toEqual({
          error:
            'Cupão não encontrado',
        })
      },
    )

    test(
      'devolve 500 em erro inesperado',
      async () => {
        mockUpdateAdminCoupon.mockRejectedValue(
          new Error(
            'Erro inesperado',
          ),
        )

        const response =
          await PATCH(
            createPatchRequest({
              isActive: false,
            }),
            routeContext,
          )

        expect(
          response.status,
        ).toBe(500)
      },
    )
  },
)
