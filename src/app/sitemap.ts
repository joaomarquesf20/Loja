import type { MetadataRoute } from 'next'

import {
  listCatalogCategories,
  listCatalogProducts,
} from '@/server/catalog'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<
  MetadataRoute.Sitemap
> {
  const baseUrl = (
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '')

  const [categories, products] =
    await Promise.all([
      listCatalogCategories(),
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
}
