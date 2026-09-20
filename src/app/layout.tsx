import type { Metadata } from 'next'
import {
  Geist,
  Geist_Mono,
} from 'next/font/google'
import './globals.css'
import Providers from './providers'
import SiteHeader from './site-header'
import { listCatalogCategories } from '@/server/catalog'
import { getCommercialSettings } from '@/server/commercial-settings'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'PFAUTOPARTS',
  description:
    'Aftermarket automóvel, styling, performance e acessórios.',
}

async function getHeaderCategories() {
  try {
    const categories =
      await listCatalogCategories()

    const topLevel =
      categories.filter(
        (category) =>
          category.parentId === null,
      )

    return (
      topLevel.length > 0
        ? topLevel
        : categories
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
}: LayoutProps<'/'>) {
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
