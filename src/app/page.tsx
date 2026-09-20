import Link from 'next/link'
import BrandCard from '@/components/storefront/brand-card'
import CategoryCard from '@/components/storefront/category-card'
import EditorialCard from '@/components/storefront/editorial-card'
import ProductCard from '@/components/storefront/product-card'
import SectionHeading from '@/components/storefront/section-heading'
import {
  listCatalogCategories,
  listCatalogProducts,
  type CatalogProduct,
} from '@/server/catalog'

export const dynamic =
  'force-dynamic'

function firstImage(
  products: CatalogProduct[],
) {
  return products
    .flatMap(
      (product) => product.images,
    )
    .find(Boolean)
}

export default async function Home() {
  const [products, categories] =
    await Promise.all([
      listCatalogProducts(),
      listCatalogCategories(),
    ])

  const heroImages = products
    .flatMap((product) =>
      product.images.map(
        (image) => ({
          image,
          product,
        }),
      ),
    )
    .slice(0, 3)

  const categoryCards =
    categories.slice(0, 8).map(
      (category) => {
        const categoryProducts =
          products.filter(
            (product) =>
              product.category.id ===
              category.id,
          )

        return {
          category,
          image:
            firstImage(
              categoryProducts,
            ) ?? null,
        }
      },
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
      <section className="relative overflow-hidden bg-[#101316] text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(239,91,42,0.17),transparent_28%),linear-gradient(120deg,#101316_0%,#171b1f_68%,#0e1012_100%)]"
        />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-20">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">
              Styling · Performance · Aftermarket
            </p>

            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
              Dá outra identidade
              <span className="block text-brand">
                ao teu carro.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg">
              Jantes, exterior,
              suspensão, iluminação e
              componentes para quem vive
              o automóvel para além do
              original.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/#categorias"
                className="rounded-xl bg-brand px-5 py-3 text-sm font-black text-white transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#101316]"
              >
                Comprar agora
              </Link>

              <Link
                href="/#produtos"
                className="rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#101316]"
              >
                Explorar produtos
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-[0.11em] text-white/45">
              <span>Aftermarket</span>
              <span>Styling</span>
              <span>Performance</span>
            </div>
          </div>

          <div className="relative min-h-[22rem] sm:min-h-[28rem]">
            {heroImages.length > 0 ? (
              <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-3">
                {heroImages[0] && (
                  <div
                    className="col-span-4 row-span-5 overflow-hidden rounded-3xl bg-white/5 bg-cover bg-center shadow-2xl shadow-black/25"
                    style={{
                      backgroundImage: `url("${heroImages[0].image}")`,
                    }}
                    role="img"
                    aria-label={
                      heroImages[0]
                        .product.name
                    }
                  />
                )}

                {heroImages[1] && (
                  <div
                    className="col-span-1 row-span-2 overflow-hidden rounded-2xl bg-white/5 bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${heroImages[1].image}")`,
                    }}
                    role="img"
                    aria-label={
                      heroImages[1]
                        .product.name
                    }
                  />
                )}

                {heroImages[2] && (
                  <div
                    className="col-span-1 row-span-3 overflow-hidden rounded-2xl bg-white/5 bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${heroImages[2].image}")`,
                    }}
                    role="img"
                    aria-label={
                      heroImages[2]
                        .product.name
                    }
                  />
                )}
              </div>
            ) : (
              <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_70%_22%,rgba(239,91,42,0.42),transparent_24%),linear-gradient(145deg,#2a3035_0%,#15181c_62%)] shadow-2xl shadow-black/25">
                <div
                  aria-hidden="true"
                  className="absolute -right-10 top-1/2 size-72 -translate-y-1/2 rounded-full border-[42px] border-white/8 shadow-[inset_0_0_0_12px_rgba(255,255,255,0.03)] sm:size-96 sm:border-[58px]"
                />

                <div className="absolute bottom-7 left-7 max-w-xs">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
                    PFAutoParts
                  </p>

                  <p className="mt-2 text-xl font-black leading-tight text-white/90">
                    A tua base para um
                    projeto com identidade.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section
          id="categorias"
          aria-labelledby="categories-heading"
          className="scroll-mt-28"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeading
              id="categories-heading"
              eyebrow="Shop the build"
              title="Compra por categoria"
              description="Explora as categorias que existem atualmente no catálogo PFAutoParts."
            />

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {editorialCategories.length >
        0 && (
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-2">
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

      <section
        id="produtos"
        aria-labelledby="products-heading"
        className="scroll-mt-28"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionHeading
            id="products-heading"
            eyebrow="PFAutoParts"
            title="Produtos do catálogo"
            description="Produtos reais atualmente disponíveis na loja, com preço e stock fornecidos pelo catálogo existente."
          />

          {products.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-line bg-surface p-12 text-center">
              <h3 className="text-xl font-black">
                Catálogo sem produtos
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Neste momento não existem
                produtos disponíveis.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </section>

      {brands.length > 0 && (
        <section
          id="marcas"
          aria-labelledby="brands-heading"
          className="scroll-mt-28 border-t border-line bg-surface"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <SectionHeading
              id="brands-heading"
              eyebrow="Brands"
              title="Marcas no catálogo"
              description="Fabricantes presentes nos produtos ativos da PFAutoParts."
            />

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
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
