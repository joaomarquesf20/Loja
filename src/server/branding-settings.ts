import { z } from 'zod'

import { prisma } from './db'

import {
  DEFAULT_LOGO_URL_DARK,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_STORE_NAME,
} from '../lib/brand-defaults'
import {
  buildBrandCssVariables,
} from '../lib/brand-colors'

/**
 * Épico white-label — identidade da loja (Configurações do admin).
 * Reutiliza a linha singleton `StoreSettings` (`id = "store"`, que já
 * guarda as preferências comerciais): os campos nulos significam
 * "usar os defaults do template" (`src/lib/brand-defaults.ts`), de
 * modo que uma instalação nova é totalmente funcional sem config.
 */

const STORE_SETTINGS_ID = 'store'

type StoreBrandingRecord = {
  storeName: string | null
  contactEmail: string | null
  contactPhone: string | null
  nif: string | null
  address: string | null
  primaryColorHex: string | null
  logoUrl: string | null
}

type StoreBrandingWriteData = {
  storeName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  nif?: string | null
  address?: string | null
  primaryColorHex?: string | null
  logoUrl?: string | null
}

const brandingSelect = {
  storeName: true,
  contactEmail: true,
  contactPhone: true,
  nif: true,
  address: true,
  primaryColorHex: true,
  logoUrl: true,
} as const

export interface BrandingSettingsClient {
  storeSettings: {
    findUnique(args: {
      where: {
        id: string
      }
      select: typeof brandingSelect
    }): Promise<StoreBrandingRecord | null>

    upsert(args: {
      where: {
        id: string
      }
      update: StoreBrandingWriteData
      create: {
        id: string
      } & StoreBrandingWriteData
      select: typeof brandingSelect
    }): Promise<StoreBrandingRecord>
  }
}

export type StoreBranding = {
  storeName: string
  contactEmail: string | null
  contactPhone: string | null
  nif: string | null
  address: string | null
  /** Sempre resolvido — cai no default do template. */
  primaryColorHex: string
  /** Sempre resolvido — cai no logótipo do template. */
  logoUrl: string
  /** Bloco `:root { … }` derivado da cor, para injetar no layout. */
  brandCssVariables: string
}

export class BrandingValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BrandingValidationError'
  }
}

function getClient(
  client?: BrandingSettingsClient,
): BrandingSettingsClient {
  return (
    client ??
    (prisma as unknown as BrandingSettingsClient)
  )
}

/**
 * Campos de texto opcionais: `undefined` = manter; string vazia =
 * limpar (gravar `null`). Trim acontece sempre.
 */
const optionalTextField = (
  fieldName: string,
  maxLength: number,
) =>
  z
    .string()
    .trim()
    .max(maxLength, {
      message: `${fieldName} é longo demais (máx. ${maxLength})`,
    })
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : value || null,
    )

const brandingSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(1, {
        message:
          'O nome da loja é obrigatório',
      })
      .max(80, {
        message:
          'O nome da loja é longo demais (máx. 80)',
      })
      .optional(),
    contactEmail: z
      .union(
        [
          z
            .string()
            .trim()
            .email({
              message:
                'Email de contacto inválido',
            })
            .max(160),
          z.literal(''),
        ],
        {
          message:
            'Email de contacto inválido',
        },
      )
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined
        }

        return value || null
      }),
    contactPhone: optionalTextField(
      'Telefone de contacto',
      40,
    ),
    nif: optionalTextField('NIF', 20),
    address: optionalTextField(
      'Morada',
      200,
    ),
    /** Vazio = limpar; hex válido = gravar. */
    primaryColorHex: z
      .string()
      .trim()
      .refine(
        (value) =>
          /^#[0-9a-fA-F]{6}$/.test(value),
        {
          message:
            'A cor da loja deve ser um hex #RRGGBB',
        },
      )
      .optional()
      .transform((value) =>
        value === undefined
          ? undefined
          : value || null,
      ),
    logoUrl: z
      .string()
      .trim()
      .max(255, {
        message:
          'URL do logótipo é longo demais',
      })
      .refine(
        (value) =>
          value === ''
            ? true
            : /^\/|https?:\/\//.test(value),
        {
          message:
            'URL do logótipo inválido (caminho /… ou https://…)',
        },
      )
      .optional()
      .transform((value) =>
        value === undefined
          ? undefined
          : value || null,
      ),
  })
  .strict()

function mapStoreBranding(
  record: StoreBrandingRecord | null,
): StoreBranding {
  const primaryColorHex =
    record?.primaryColorHex?.trim() ||
    DEFAULT_PRIMARY_COLOR

  return {
    storeName:
      record?.storeName?.trim() ||
      DEFAULT_STORE_NAME,
    contactEmail:
      record?.contactEmail ?? null,
    contactPhone:
      record?.contactPhone ?? null,
    nif: record?.nif ?? null,
    address: record?.address ?? null,
    primaryColorHex,
    logoUrl:
      record?.logoUrl?.trim() ||
      DEFAULT_LOGO_URL_DARK,
    brandCssVariables:
      buildBrandCssVariables(
        primaryColorHex,
      ) ?? '',
  }
}

/**
 * Identidade pública da loja para o layout, SEO e emails. NUNCA
 * lançam: qualquer falha de base de dados cai nos defaults do
 * template — a vitrine tem de renderizar sempre.
 */
export async function getPublicStoreBranding(
  client?: BrandingSettingsClient,
): Promise<StoreBranding> {
  const db = getClient(client)

  try {
    const record =
      await db.storeSettings.findUnique({
        where: { id: STORE_SETTINGS_ID },
        select: brandingSelect,
      })

    return mapStoreBranding(record)
  } catch {
    return mapStoreBranding(null)
  }
}

/**
 * Leitura para a página de configurações: devolve também os valores
 * cruais (`null` = ainda não configurado) para pré preencher o form.
 */
export async function getAdminStoreBranding(
  client?: BrandingSettingsClient,
): Promise<{
  branding: StoreBranding
  raw: StoreBrandingRecord | null
}> {
  const db = getClient(client)

  const record =
    await db.storeSettings.findUnique({
      where: { id: STORE_SETTINGS_ID },
      select: brandingSelect,
    })

  return {
    branding: mapStoreBranding(record),
    raw: record,
  }
}

export async function updateStoreBranding(
  input: unknown,
  client?: BrandingSettingsClient,
): Promise<StoreBranding> {
  const db = getClient(client)

  const result =
    brandingSchema.safeParse(input)

  if (!result.success) {
    throw new BrandingValidationError(
      result.error.issues[0]?.message ??
        'Configuração da loja inválida',
    )
  }

  const data = result.data

  const record =
    await db.storeSettings.upsert({
      where: { id: STORE_SETTINGS_ID },
      update: data,
      create: {
        id: STORE_SETTINGS_ID,
        ...data,
      },
      select: brandingSelect,
    })

  return mapStoreBranding(record)
}
