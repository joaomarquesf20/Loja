import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '')

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api',
        '/conta',
        '/checkout',
        '/carrinho',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
