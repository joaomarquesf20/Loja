import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  Geist,
  Geist_Mono,
} from 'next/font/google'
import './globals.css'
import Providers from './providers'
import SiteHeader from './site-header'
import {
  SITE_DESCRIPTION,
  SITE_NAME,
} from './seo'
import { getCatalogCategories } from '@/server/catalog-request'
import { getCommercialSettings } from '@/server/commercial-settings'
import {
  isStorefrontCategoryVisible,
  sortStorefrontCategories,
} from '@/lib/storefront-category-media'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/**
 * Base de URLs para metadataBase (Open Graph, canonical) a partir do
 * NEXTAUTH_URL — a mesma convenção de robots.ts/sitemap.ts. O try/
 * catch evita que um valor inválido no env rebente com o build.
 */
function getMetadataBaseUrl() {
  try {
    return new URL(
      (
        process.env.NEXTAUTH_URL ??
        'http://localhost:3000'
      ).replace(/\/+$/, ''),
    )
  } catch {
    return new URL('http://localhost:3000')
  }
}

/**
 * SEO base: título com template ('%s | PFAUTOPARTS' nas páginas
 * filho), descrição e defaults de Open Graph/Twitter. Páginas com
 * metadados próprios substituem o openGraph — os cards do Twitter
 * herdam do Open Graph resolvido.
 */
export const metadata: Metadata = {
  metadataBase: getMetadataBaseUrl(),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

async function getHeaderCategories() {
  try {
    const categories =
      await getCatalogCategories()

    const commercialCategories =
      sortStorefrontCategories(
        categories.filter(
          isStorefrontCategoryVisible,
        ),
      )

    const topLevel =
      commercialCategories.filter(
        (category) =>
          category.parentId === null,
      )

    return (
      topLevel.length > 0
        ? topLevel
        : commercialCategories
    )
      .slice(0, 7)
      .map((category) => ({
        name: category.name,
        slug: category.slug,
      }))
  } catch {
    return []
  }
}

function formatMoney(
  value: string,
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    },
  ).format(Number(value))
}

async function getCommercialMessage() {
  try {
    const settings =
      await getCommercialSettings()

    const mainland =
      settings.regions.find(
        (region) =>
          region.region ===
          'PORTUGAL_MAINLAND',
      )

    if (!mainland?.checkoutEnabled) {
      return null
    }

    const thresholds =
      mainland.shippingRules
        .filter(
          (rule) =>
            rule.checkoutEnabled &&
            rule.freeShippingThreshold !==
              null,
        )
        .map((rule) =>
          Number(
            rule.freeShippingThreshold,
          ),
        )
        .filter(Number.isFinite)

    if (thresholds.length > 0) {
      const threshold = Math.min(
        ...thresholds,
      )

      return `Portes grátis em artigos elegíveis a partir de ${formatMoney(
        String(threshold),
      )}`
    }

    return 'Entregas disponíveis em Portugal Continental'
  } catch {
    return null
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const [
    headerCategories,
    commercialMessage,
  ] = await Promise.all([
    getHeaderCategories(),
    getCommercialMessage(),
  ])

  return (
    <html
      lang="pt-PT"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <SiteHeader
            categories={
              headerCategories
            }
            commercialMessage={
              commercialMessage
            }
          />
          {children}
        </Providers>
      </body>
    </html>
  )
}
