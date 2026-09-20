import type { Metadata } from 'next'
import {
  Geist,
  Geist_Mono,
} from 'next/font/google'
import './globals.css'
import Providers from './providers'
import SiteHeader from './site-header'
import { listCatalogCategories } from '@/server/catalog'

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

export default async function RootLayout({
  children,
}: LayoutProps<'/'>) {
  const headerCategories =
    await getHeaderCategories()

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
          />
          {children}
        </Providers>
      </body>
    </html>
  )
}
