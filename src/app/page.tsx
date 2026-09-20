import Link from 'next/link'
import BrandCard from '@/components/storefront/brand-card'
import CategoryCard from '@/components/storefront/category-card'
import EditorialCard from '@/components/storefront/editorial-card'
import ProductCard from '@/components/storefront/product-card'
import SectionHeading from '@/components/storefront/section-heading'
import {
  listCatalogCategories,
  listCatalogProducts,
  type CatalogCategory,
  type CatalogProduct,
} from '@/server/catalog'

export const dynamic =
  'force-dynamic'

type HomeProps = {
  searchParams: Promise<{
    q?: string | string[]
  }>
}

const CURATED_CATEGORY_IMAGES = [
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80',
]

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1800&q=85'

function firstProductImage(
  products: CatalogProduct[],
) {
  return products
    .flatMap(
      (product) => product.images,
    )
    .find(Boolean)
}

function getCategoryImage(
  category: CatalogCategory,
  products: CatalogProduct[],
  index: number,
) {
  const ownProductImage =
    firstProductImage(
      products.filter(
        (product) =>
          product.category.id ===
          category.id,
      ),
    )

  return (
    ownProductImage ??
    CURATED_CATEGORY_IMAGES[
      index %
        CURATED_CATEGORY_IMAGES.length
    ]
  )
}

function normalizeSearchQuery(
  rawQuery: string | string[] | undefined,
) {
  const value = Array.isArray(rawQuery)
    ? rawQuery[0]
    : rawQuery

  return value?.trim().toLocaleLowerCase(
    'pt-PT',
  ) ?? ''
}

function matchesSearch(
  product: CatalogProduct,
  query: string,
) {
  if (!query) {
    return true
  }

  const searchableValues = [
    product.name,
    product.brand?.name ?? '',
    product.category.name,
  ]

  return searchableValues.some(
    (value) =>
      value
        .toLocaleLowerCase('pt-PT')
        .includes(query),
  )
}

export default async function Home({
  searchParams,
}: HomeProps) {
  const [{ q }, products, categories] =
    await Promise.all([
      searchParams,
      listCatalogProducts(),
      listCatalogCategories(),
    ])

  const normalizedQuery =
    normalizeSearchQuery(q)

  const visibleProducts =
    products.filter((product) =>
      matchesSearch(
        product,
        normalizedQuery,
      ),
    )

  const categoryCards =
    categories.slice(0, 8).map(
      (category, index) => ({
        category,
        image: getCategoryImage(
          category,
          products,
          index,
        ),
      }),
    )

  const editorialCategories =
    categoryCards.slice(0, 3)

  const brandsById = new Map<
    string,
    NonNullable<
      CatalogProduct['brand']
    >
  >()

  for (const product of products) {
    if (product.brand) {
      brandsById.set(
        product.brand.id,
        product.brand,
      )
    }
  }

  const brands = Array.from(
    brandsById.values(),
  ).sort((first, second) =>
    first.name.localeCompare(
      second.name,
    ),
  )

  return (
    <main className="flex-1 bg-background text-foreground">
      <section className="relative isolate overflow-hidden bg-[#101316] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url("${HERO_IMAGE}")`,
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,12,14,0.95)_0%,rgba(10,12,14,0.82)_38%,rgba(10,12,14,0.35)_70%,rgba(10,12,14,0.2)_100%)]"
        />

        <div className="relative mx-auto flex min-h-[24rem] max-w-7xl items-center px-4 py-10 sm:px-6 lg:min-h-[27rem] lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">
              Styling · Performance · Aftermarket
            </p>

            <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Constrói o carro
              <span className="block text-brand">
                à tua maneira.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
              Peças e acessórios para
              transformar presença,
              comportamento e carácter.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/#categorias"
                className="rounded-xl bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Comprar agora
              </Link>

              <Link
                href="/#produtos"
                className="rounded-xl border border-white/25 bg-black/20 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Ver produtos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section
          id="categorias"
          aria-labelledby="categories-heading"
          className="scroll-mt-36"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <SectionHeading
              id="categories-heading"
              eyebrow="Explorar"
              title="Compra por categoria"
              description="Entra diretamente nas categorias disponíveis no catálogo PFAutoParts."
            />

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categoryCards.map(
                ({
                  category,
                  image,
                }) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    image={image}
                  />
                ),
              )}
            </div>
          </div>
        </section>
      )}

      <section
        id="produtos"
        aria-labelledby="products-heading"
        className="scroll-mt-36 border-y border-line bg-surface"
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <SectionHeading
            id="products-heading"
            eyebrow="Catálogo"
            title={
              normalizedQuery
                ? 'Resultados da pesquisa'
                : 'Produtos para o próximo upgrade'
            }
            description={
              normalizedQuery
                ? `Resultados encontrados para “${Array.isArray(q) ? q[0] : q}”.`
                : 'Produtos reais atualmente disponíveis no catálogo, com marca, preço e disponibilidade.'
            }
            aside={
              normalizedQuery ? (
                <Link
                  href="/#produtos"
                  className="text-sm font-black text-brand hover:underline hover:underline-offset-4"
                >
                  Limpar pesquisa
                </Link>
              ) : undefined
            }
          />

          {visibleProducts.length ===
          0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-line bg-background p-10 text-center sm:p-14">
              <h3 className="text-xl font-black">
                Nenhum produto encontrado
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Experimenta pesquisar por
                outro nome, marca ou
                categoria.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleProducts
                .slice(0, 8)
                .map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}
            </div>
          )}
        </div>
      </section>

      {editorialCategories.length >
        0 && (
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeading
              eyebrow="Build inspiration"
              title="Muda a presença. Muda a experiência."
              description="Explora algumas das áreas do catálogo e encontra a próxima direção para o teu projeto."
            />

            <div className="mt-8 grid gap-4 lg:grid-cols-2 lg:grid-rows-2">
              {editorialCategories.map(
                (
                  {
                    category,
                    image,
                  },
                  index,
                ) => (
                  <EditorialCard
                    key={category.id}
                    category={category}
                    image={image}
                    featured={
                      index === 0
                    }
                  />
                ),
              )}
            </div>
          </div>
        </section>
      )}

      {brands.length > 0 && (
        <section
          id="marcas"
          aria-labelledby="brands-heading"
          className="scroll-mt-36 border-t border-line bg-surface"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <SectionHeading
              id="brands-heading"
              eyebrow="Marcas"
              title="Escolhe pelo fabricante"
              description="Marcas presentes nos produtos ativos da loja."
            />

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {brands
                .slice(0, 10)
                .map((brand) => (
                  <BrandCard
                    key={brand.id}
                    name={brand.name}
                  />
                ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-9 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
              PFAutoParts
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              O próximo upgrade começa aqui.
            </h2>
          </div>

          <Link
            href="/#categorias"
            className="inline-flex w-fit rounded-xl bg-white px-5 py-3 text-sm font-black text-brand transition hover:bg-black hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Explorar categorias
          </Link>
        </div>
      </section>
    </main>
  )
}
