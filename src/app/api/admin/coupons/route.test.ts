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
    class CouponCodeConflictError extends Error {}

    return {
      CouponCodeConflictError,
      listAdminCoupons:
        vi.fn(),
      createAdminCoupon:
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
  CouponCodeConflictError,
  createAdminCoupon,
  listAdminCoupons,
} from '@/server/coupons'
import {
  readJsonBody,
} from '@/server/http-request'
import {
  GET,
  POST,
} from './route'

const mockRequireAdmin =
  vi.mocked(requireAdmin)

const mockListAdminCoupons =
  vi.mocked(listAdminCoupons)

const mockCreateAdminCoupon =
  vi.mocked(createAdminCoupon)

const mockReadJsonBody =
  vi.mocked(readJsonBody)

function createCouponsPage() {
  return {
    coupons: [
      {
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
        isActive: true,
        status: 'ACTIVE',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    kpis: {
      totalCoupons: 1,
      activeCoupons: 1,
      totalUses: 3,
    },
  }
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
    usedCount: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    status: 'ACTIVE',
  }
}

describe(
  'Admin Coupons API',
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

    describe(
      'GET',
      () => {
        test(
          'devolve a página com KPIs',
          async () => {
            const page =
              createCouponsPage()

            mockListAdminCoupons.mockResolvedValue(
              page as never,
            )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/coupons',
                ),
              )

            expect(
              response.status,
            ).toBe(200)

            expect(
              await response.json(),
            ).toEqual(
              page,
            )

            expect(
              mockListAdminCoupons,
            ).toHaveBeenCalledWith(
              {
                search:
                  undefined,
                status:
                  undefined,
                page:
                  undefined,
                pageSize:
                  undefined,
              },
            )
          },
        )

        test(
          'propaga search/status/paginação da query',
          async () => {
            mockListAdminCoupons.mockResolvedValue(
              createCouponsPage() as never,
            )

            await GET(
              new Request(
                'http://localhost/api/admin/coupons?search=promo&status=ACTIVE&page=2&pageSize=10',
              ),
            )

            expect(
              mockListAdminCoupons,
            ).toHaveBeenCalledWith({
              search:
                'promo',
              status:
                'ACTIVE',
              page: '2',
              pageSize:
                '10',
            })
          },
        )

        test(
          'devolve 401 sem autenticação',
          async () => {
            mockRequireAdmin.mockRejectedValue(
              new UnauthorizedError(),
            )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/coupons',
                ),
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
              await GET(
                new Request(
                  'http://localhost/api/admin/coupons',
                ),
              )

            expect(
              response.status,
            ).toBe(403)
          },
        )

        test(
          'devolve 400 para ZodError',
          async () => {
            mockListAdminCoupons.mockRejectedValue(
              new ZodError([]),
            )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/coupons?status=WEIRD',
                ),
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
          'devolve 500 em erro inesperado',
          async () => {
            mockListAdminCoupons.mockRejectedValue(
              new Error(
                'Erro inesperado',
              ),
            )

            const response =
              await GET(
                new Request(
                  'http://localhost/api/admin/coupons',
                ),
              )

            expect(
              response.status,
            ).toBe(500)
          },
        )
      },
    )

    describe(
      'POST',
      () => {
        test(
          'cria cupão com status 201',
          async () => {
            const coupon =
              createCouponRow()

            mockCreateAdminCoupon.mockResolvedValue(
              coupon as never,
            )

            const request =
              new Request(
                'http://localhost/api/admin/coupons',
                {
                  method:
                    'POST',
                  headers:
                    {
                      'content-type':
                        'application/json',
                    },
                  body:
                    JSON.stringify(
                      {
                        code: 'promo10',
                        discountType:
                          'PERCENTAGE',
                        discountValue:
                          10,
                      },
                    ),
                },
              )

            const response =
              await POST(
                request,
              )

            expect(
              response.status,
            ).toBe(201)

            expect(
              await response.json(),
            ).toEqual(
              coupon,
            )

            expect(
              mockReadJsonBody,
            ).toHaveBeenCalledTimes(
              1,
            )

            expect(
              mockCreateAdminCoupon,
            ).toHaveBeenCalledWith(
              {
                code: 'promo10',
                discountType:
                  'PERCENTAGE',
                discountValue:
                  10,
              },
            )
          },
        )

        test(
          'devolve 400 para ZodError',
          async () => {
            mockCreateAdminCoupon.mockRejectedValue(
              new ZodError([]),
            )

            const response =
              await POST(
                new Request(
                  'http://localhost/api/admin/coupons',
                  {
                    method:
                      'POST',
                    body:
                      '{}',
                  },
                ),
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
          'devolve 409 em colisão de código',
          async () => {
            mockCreateAdminCoupon.mockRejectedValue(
              new CouponCodeConflictError(
                'Já existe um cupão com este código',
              ),
            )

            const response =
              await POST(
                new Request(
                  'http://localhost/api/admin/coupons',
                  {
                    method:
                      'POST',
                    body:
                      '{}',
                  },
                ),
              )

            expect(
              response.status,
            ).toBe(409)

            expect(
              await response.json(),
            ).toEqual({
              error:
                'Já existe um cupão com este código',
            })
          },
        )

        test(
          'devolve 401/403 conforme a autenticação',
          async () => {
            mockRequireAdmin.mockRejectedValue(
              new UnauthorizedError(),
            )

            const unauthorized =
              await POST(
                new Request(
                  'http://localhost/api/admin/coupons',
                  {
                    method:
                      'POST',
                    body:
                      '{}',
                  },
                ),
              )

            expect(
              unauthorized.status,
            ).toBe(401)

            mockRequireAdmin.mockRejectedValue(
              new ForbiddenError(),
            )

            const forbidden =
              await POST(
                new Request(
                  'http://localhost/api/admin/coupons',
                  {
                    method:
                      'POST',
                    body:
                      '{}',
                  },
                ),
              )

            expect(
              forbidden.status,
            ).toBe(403)
          },
        )

        test(
          'devolve 500 em erro inesperado',
          async () => {
            mockCreateAdminCoupon.mockRejectedValue(
              new Error(
                'Erro inesperado',
              ),
            )

            const response =
              await POST(
                new Request(
                  'http://localhost/api/admin/coupons',
                  {
                    method:
                      'POST',
                    body:
                      '{}',
                  },
                ),
              )

            expect(
              response.status,
            ).toBe(500)
          },
        )
      },
    )
  },
)
