import CatalogClient from './catalog-client'

export default function CatalogPage() {
  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef5b2a]">
          Organização da loja
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          Catálogo
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687078]">
          Mantém as categorias comerciais e os
          fabricantes usados nos produtos
          organizados.
        </p>
      </header>

      <CatalogClient />
    </main>
  )
}
