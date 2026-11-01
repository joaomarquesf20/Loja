import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

vi.mock('./db', () => ({
  prisma: {},
}))

import { BrandingValidationError, getAdminStoreBranding, getPublicStoreBranding, updateStoreBranding, type BrandingSettingsClient } from './branding-settings'

function createClient() {
  const client = {
    storeSettings: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(),
    },
  } as unknown as BrandingSettingsClient & {
    storeSettings: {
      findUnique: ReturnType<typeof vi.fn>
      upsert: ReturnType<typeof vi.fn>
    }
  }

  return {
    client,
  }
}

const existingRecord = {
  storeName: 'Officine Rossi',
  contactEmail: 'geral@officine.example',
  contactPhone: '+351 210 000 000',
  nif: 'PT501234567',
  address: 'Rua das Oficinas 42, Porto',
  primaryColorHex: '#0f766e',
  logoUrl: '/brand/logo-horizontal.png',
}

describe('branding-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPublicStoreBranding', () => {
    test('devolve os defaults do template quando a linha não existe', async () => {
      const { client } = createClient()

      await expect(
        getPublicStoreBranding(client),
      ).resolves.toEqual({
        storeName: 'AutoParts',
        contactEmail: null,
        contactPhone: null,
        nif: null,
        address: null,
        primaryColorHex: '#ef5b2a',
        logoUrl: '/brand/logo-horizontal-dark.png',
        brandCssVariables:
          '--brand: #ef5b2a; --brand-strong: #d25025; --brand-soft: #f16f44;',
      })
    })

    test('devolve os defaults quando a base de dados falha (vitrine sempre renderiza)', async () => {
      const { client } = createClient()

      client.storeSettings.findUnique =
        vi.fn(async () => {
          throw new Error(
            'datastore em chamas',
          )
        })

      const branding =
        await getPublicStoreBranding(client)

      expect(branding.storeName).toBe(
        'AutoParts',
      )
      expect(branding.primaryColorHex).toBe(
        '#ef5b2a',
      )
    })

    test('resolve a linha existente e campos nulos caem no default', async () => {
      const { client } = createClient()

      client.storeSettings.findUnique =
        vi.fn(async () => ({
          storeName: 'Officine Rossi',
          contactEmail: null,
          contactPhone: null,
          nif: null,
          address: null,
          primaryColorHex: null,
          logoUrl: '   ',
        }))

      const branding =
        await getPublicStoreBranding(client)

      expect(branding.storeName).toBe(
        'Officine Rossi',
      )
      expect(branding.contactEmail).toBeNull()
      expect(branding.primaryColorHex).toBe(
        '#ef5b2a',
      )
      expect(branding.logoUrl).toBe(
        '/brand/logo-horizontal-dark.png',
      )
      expect(
        branding.brandCssVariables,
      ).toContain('--brand: #ef5b2a;')
    })
  })

  describe('getAdminStoreBranding', () => {
    test('devolve branding resolvido + valores cruais', async () => {
      const { client } = createClient()

      client.storeSettings.findUnique =
        vi.fn(async () => existingRecord)

      const { branding, raw } =
        await getAdminStoreBranding(
          client,
        )

      expect(branding.storeName).toBe(
        'Officine Rossi',
      )
      expect(branding.primaryColorHex).toBe(
        '#0f766e',
      )
      expect(branding.brandCssVariables).toBe(
        '--brand: #0f766e; --brand-strong: #0d6861; --brand-soft: #2c867f;',
      )
      expect(raw).toEqual(existingRecord)
    })
  })

  describe('updateStoreBranding', () => {
    test('grava campos fornecidos e preserva os ausentes via upsert', async () => {
      const { client } = createClient()

      client.storeSettings.upsert = vi.fn(
        async () => existingRecord,
      )

      const result =
        await updateStoreBranding(
          {
            storeName: 'Officine Rossi',
            contactEmail:
              'geral@officine.example',
          },
          client,
        )

      expect(
        client.storeSettings.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'store' },
          update: {
            storeName: 'Officine Rossi',
            contactEmail:
              'geral@officine.example',
          },
          create: {
            id: 'store',
            storeName: 'Officine Rossi',
            contactEmail:
              'geral@officine.example',
          },
        }),
      )

      expect(result.storeName).toBe(
        'Officine Rossi',
      )
    })

    test('string vazia limpa o campo (null)', async () => {
      const { client } = createClient()

      client.storeSettings.upsert = vi.fn(
        async () => existingRecord,
      )

      await updateStoreBranding(
        {
          storeName: 'Officine Rossi',
          contactEmail: '',
          nif: '   ',
        },
        client,
      )

      expect(
        client.storeSettings.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            storeName: 'Officine Rossi',
            contactEmail: null,
            nif: null,
          },
        }),
      )
    })

    test('rejeita nome vazio e cor fora de #RRGGBB', async () => {
      const { client } = createClient()

      await expect(
        updateStoreBranding(
          {
            storeName: '   ',
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        BrandingValidationError,
      )

      await expect(
        updateStoreBranding(
          {
            storeName: 'Loja',
            primaryColorHex: 'ef5b2a',
          },
          client,
        ),
      ).rejects.toThrow('#RRGGBB')

      // O cliente nunca é tocado quando a validação falha.
      expect(
        client.storeSettings.upsert,
      ).not.toHaveBeenCalled()
    })

    test('rejeita email inválido e campos desconhecidos', async () => {
      const { client } = createClient()

      await expect(
        updateStoreBranding(
          {
            storeName: 'Loja',
            contactEmail: 'não-é-email',
          },
          client,
        ),
      ).rejects.toThrow(
        'Email de contacto inválido',
      )

      await expect(
        updateStoreBranding(
          {
            storeName: 'Loja',
            modoEscuro: true,
          },
          client,
        ),
      ).rejects.toBeInstanceOf(
        BrandingValidationError,
      )
      expect(
        client.storeSettings.upsert,
      ).not.toHaveBeenCalled()
    })
  })
})
