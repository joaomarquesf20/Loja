import type { MetadataRoute } from 'next'

import { listCatalogProducts } from '@/server/catalog'
import { getCatalogCategories } from '@/server/catalog-request'

/**
 * Sitemap com ISR de hora a hora (`revalidate = 3600`): os URLs
 * mudam quando o catálogo muda, mas não justificam uma consulta à
 * base de dados por request (antes era `force-dynamic`). Em build
 * sem base de dados a geração degrada de forma controlada para a
 * entrada da home, sem falhar o build.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<
  MetadataRoute.Sitemap
> {
  const baseUrl = (
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '')

  try {
    const [categories, products] =
      await Promise.all([
        getCatalogCategories(),
        listCatalogProducts(),
      ])

    return [
      {
        url: baseUrl,
        changeFrequency: 'daily',
        priority: 1,
      },
      ...categories.map((category) => ({
        url: `${baseUrl}/categorias/${encodeURIComponent(category.slug)}`,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
      ...products.map((product) => ({
        url: `${baseUrl}/produtos/${encodeURIComponent(product.slug)}`,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]
  } catch (error) {
    console.error(
      'Falha ao gerar o sitemap:',
      error,
    )

    return [
      {
        url: baseUrl,
        changeFrequency: 'daily',
        priority: 1,
      },
    ]
  }
}
