import type { Metadata } from 'next'

/**
 * Nome da loja usado no título, no template e no Open Graph.
 */
export const SITE_NAME = 'PFAUTOPARTS'

/**
 * Descrição base da loja, reutilizada nos metadados de todas as
 * páginas de vitrine.
 */
export const SITE_DESCRIPTION =
  'Jantes premium, suspensões, body-kits e personalização automóvel.'

type PageMetadataInput = {
  title: string
  description: string
  /** Caminho canónico relativo (resolvido com metadataBase). */
  path?: string
  image?: string
  /**
   * Faz bypass do template `%s | PFAUTOPARTS` — usado na home,
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
      siteName: SITE_NAME,
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
