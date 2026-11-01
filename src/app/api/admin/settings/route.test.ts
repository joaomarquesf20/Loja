import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/admin-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}

  return {
    UnauthorizedError,
    ForbiddenError,
    requireAdmin: vi.fn(),
  }
})

vi.mock('@/server/branding-settings', () => {
  class BrandingValidationError extends Error {}

  return {
    BrandingValidationError,
    getAdminStoreBranding: vi.fn(),
    updateStoreBranding: vi.fn(),
  }
})

import {
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from '@/server/admin-auth'
import {
  BrandingValidationError,
  getAdminStoreBranding,
  updateStoreBranding,
} from '@/server/branding-settings'

import { GET, PATCH } from './route'

const brandingResult = {
  storeName: 'Officine Rossi',
  contactEmail: 'geral@officine.example',
  contactPhone: null,
  nif: null,
  address: null,
  primaryColorHex: '#0f766e',
  logoUrl: '/brand/logo-horizontal.png',
  brandCssVariables: '',
}

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockGetAdminStoreBranding = vi.mocked(
  getAdminStoreBranding,
)
const mockUpdateStoreBranding = vi.mocked(
  updateStoreBranding,
)

function patchRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/admin/settings',
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}

describe('/api/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockRequireAdmin.mockResolvedValue({
      user: {
        id: 'admin-test',
        role: 'ADMIN',
      },
    } as Awaited<ReturnType<typeof requireAdmin>>)
  })

  describe('GET', () => {
    test('devolve branding + valores cruais com status 200', async () => {
      mockGetAdminStoreBranding.mockResolvedValue(
        {
          branding: brandingResult,
          raw: {
            storeName: 'Officine Rossi',
            contactEmail: null,
            contactPhone: null,
            nif: null,
            address: null,
            primaryColorHex: null,
            logoUrl: null,
          },
        },
      )

      const response = await GET()

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual({
        branding: brandingResult,
        raw: {
          storeName: 'Officine Rossi',
          contactEmail: null,
          contactPhone: null,
          nif: null,
          address: null,
          primaryColorHex: null,
          logoUrl: null,
        },
      })
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await GET()

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        error: 'Não autenticado',
      })

      expect(
        mockGetAdminStoreBranding,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(
        new ForbiddenError(),
      )

      const response = await GET()

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        error: 'Sem autorização',
      })
    })
  })

  describe('PATCH', () => {
    test('grava a identidade e devolve 200', async () => {
      mockUpdateStoreBranding.mockResolvedValue(
        brandingResult,
      )

      const body = {
        storeName: 'Officine Rossi',
        primaryColorHex: '#0f766e',
      }

      const response = await PATCH(
        patchRequest(body),
      )

      expect(response.status).toBe(200)

      await expect(
        response.json(),
      ).resolves.toEqual({
        branding: brandingResult,
      })

      expect(
        mockUpdateStoreBranding,
      ).toHaveBeenCalledWith(body)
    })

    test('devolve 400 com a mensagem de validação', async () => {
      mockUpdateStoreBranding.mockRejectedValue(
        new BrandingValidationError(
          'A cor da loja deve ser um hex #RRGGBB',
        ),
      )

      const response = await PATCH(
        patchRequest({
          storeName: 'Loja',
          primaryColorHex: 'cor',
        }),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error:
          'A cor da loja deve ser um hex #RRGGBB',
      })
    })

    test('devolve 400 com corpo JSON inválido', async () => {
      const response = await PATCH(
        new NextRequest(
          'http://localhost/api/admin/settings',
          {
            method: 'PATCH',
            body: 'not-json',
          },
        ),
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Dados inválidos',
      })

      expect(
        mockUpdateStoreBranding,
      ).not.toHaveBeenCalled()
    })

    test('devolve 401 sem autenticação', async () => {
      mockRequireAdmin.mockRejectedValue(
        new UnauthorizedError(),
      )

      const response = await PATCH(
        patchRequest({
          storeName: 'Loja',
        }),
      )

      expect(response.status).toBe(401)
      expect(
        mockUpdateStoreBranding,
      ).not.toHaveBeenCalled()
    })

    test('devolve 403 sem autorização ADMIN', async () => {
      mockRequireAdmin.mockRejectedValue(
        new ForbiddenError(),
      )

      const response = await PATCH(
        patchRequest({
          storeName: 'Loja',
        }),
      )

      expect(response.status).toBe(403)
    })

    test('devolve 500 em erro inesperado', async () => {
      mockUpdateStoreBranding.mockRejectedValue(
        new Error('Erro inesperado'),
      )

      const response = await PATCH(
        patchRequest({
          storeName: 'Loja',
        }),
      )

      expect(response.status).toBe(500)
    })
  })
})
