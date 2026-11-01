import type { Metadata } from 'next'

import {
  DEFAULT_STORE_DESCRIPTION,
  DEFAULT_STORE_NAME,
} from '../lib/brand-defaults'

/**
 * Nome da loja usado como fallback neu­tro do template (o valor
 * real é dinâmico via `StoreSettings` — ver `getPublicStoreBranding`).
 */
export const SITE_NAME = DEFAULT_STORE_NAME

/**
 * Descrição base da loja, reutilizada nos metadados de todas as
 * páginas de vitrine.
 */
export const SITE_DESCRIPTION =
  DEFAULT_STORE_DESCRIPTION

type PageMetadataInput = {
  title: string
  description: string
  /** Caminho canónico relativo (resolvido com metadataBase). */
  path?: string
  image?: string
  /** Nome da loja resolvido do backoffice (default do template). */
  storeName?: string
  /**
   * Faz bypass do template `%s | storeName` — usado na home,
   * cujo título já inclui o nome da loja.
   */
  absoluteTitle?: boolean
}

/**
 * Metadados coerentes por página (título, descrição, canonical e
 * Open Graph). O card do Twitter herda do Open Graph resolvido.
 */
export function buildPageMetadata(
  input: PageMetadataInput,
): Metadata {
  const storeName =
    input.storeName?.trim() ||
    DEFAULT_STORE_NAME

  return {
    title: input.absoluteTitle
      ? {
          absolute: input.title,
        }
      : input.title,
    description: input.description,
    ...(input.path
      ? {
          alternates: {
            canonical: input.path,
          },
        }
      : {}),
    openGraph: {
      type: 'website',
      locale: 'pt_PT',
      siteName: storeName,
      title: input.title,
      description: input.description,
      ...(input.path ? { url: input.path } : {}),
      ...(input.image
        ? {
            images: [
              {
                url: input.image,
              },
            ],
          }
        : {}),
    },
  }
}
