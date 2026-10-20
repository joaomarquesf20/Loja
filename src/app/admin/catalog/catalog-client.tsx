'use client'

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react'

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
}

type Manufacturer = {
  id: string
  name: string
  slug: string
}

async function getErrorMessage(
  response: Response,
) {
  try {
    const data = (await response.json()) as {
      error?: string
    }
    return (
      data.error ??
      `Erro HTTP ${response.status}`
    )
  } catch {
    return `Erro HTTP ${response.status}`
  }
}

export default function CatalogClient() {
  const [categories, setCategories] =
    useState<Category[]>([])
  const [manufacturers, setManufacturers] =
    useState<Manufacturer[]>([])
  const [categoryName, setCategoryName] =
    useState('')
  const [categoryDescription, setCategoryDescription] =
    useState('')
  const [categoryParentId, setCategoryParentId] =
    useState('')
  const [manufacturerName, setManufacturerName] =
    useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] =
    useState(false)
  const [error, setError] = useState<string | null>(
    null,
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [categoryResponse, brandResponse] =
        await Promise.all([
          fetch('/api/admin/categories', {
            cache: 'no-store',
          }),
          fetch('/api/admin/product-brands', {
            cache: 'no-store',
          }),
        ])

      if (!categoryResponse.ok) {
        throw new Error(
          await getErrorMessage(categoryResponse),
        )
      }
      if (!brandResponse.ok) {
        throw new Error(
          await getErrorMessage(brandResponse),
        )
      }

      setCategories(
        (await categoryResponse.json()) as Category[],
      )
      setManufacturers(
        (await brandResponse.json()) as Manufacturer[],
      )
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o catálogo',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  async function createCategory(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        '/api/admin/categories',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: categoryName,
            slug: categoryName,
            description:
              categoryDescription || null,
            parentId:
              categoryParentId || null,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }

      setCategoryName('')
      setCategoryDescription('')
      setCategoryParentId('')
      await load()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível criar a categoria',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function createManufacturer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        '/api/admin/product-brands',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: manufacturerName,
            slug: manufacturerName,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }

      setManufacturerName('')
      await load()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível criar o fabricante',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function renameCategory(
    category: Category,
  ) {
    const name = window.prompt(
      'Novo nome da categoria',
      category.name,
    )?.trim()
    if (!name || name === category.name) {
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/admin/categories/${category.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name,
            slug: name,
          }),
        },
      )
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }
      await load()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível atualizar a categoria',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function renameManufacturer(
    manufacturer: Manufacturer,
  ) {
    const name = window.prompt(
      'Novo nome do fabricante',
      manufacturer.name,
    )?.trim()
    if (
      !name ||
      name === manufacturer.name
    ) {
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/admin/product-brands/${manufacturer.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name,
            slug: name,
          }),
        },
      )
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }
      await load()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível atualizar o fabricante',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function removeCategory(
    category: Category,
  ) {
    if (
      !window.confirm(
        `Apagar a categoria “${category.name}”?`,
      )
    ) {
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/admin/categories/${category.id}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }
      await load()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível apagar a categoria',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function removeManufacturer(
    manufacturer: Manufacturer,
  ) {
    if (
      !window.confirm(
        `Apagar o fabricante “${manufacturer.name}”?`,
      )
    ) {
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/admin/product-brands/${manufacturer.id}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }
      await load()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível apagar o fabricante',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p>A carregar catálogo...</p>
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">
            Categorias comerciais
          </h2>
          <p className="mt-1 text-sm text-[#687078]">
            Os tipos de produto que os clientes
            veem na loja.
          </p>

          <form
            onSubmit={createCategory}
            className="mt-5 grid gap-3 rounded-lg bg-[#f4f4f2] p-4"
          >
            <label className="grid gap-1 text-sm font-semibold">
              Nome da categoria
              <input
                required
                value={categoryName}
                onChange={(event) =>
                  setCategoryName(event.target.value)
                }
                className="rounded-md border bg-white px-3 py-2 font-normal"
                placeholder="Ex.: Jantes"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Descrição
              <input
                value={categoryDescription}
                onChange={(event) =>
                  setCategoryDescription(
                    event.target.value,
                  )
                }
                className="rounded-md border bg-white px-3 py-2 font-normal"
                placeholder="Opcional"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Categoria superior
              <select
                value={categoryParentId}
                onChange={(event) =>
                  setCategoryParentId(
                    event.target.value,
                  )
                }
                className="rounded-md border bg-white px-3 py-2 font-normal"
              >
                <option value="">
                  Nenhuma
                </option>
                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={submitting}
              className="justify-self-start rounded-md bg-[#171a1d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              + Criar categoria
            </button>
          </form>

          <div className="mt-4 divide-y">
            {categories.length === 0 ? (
              <p className="py-5 text-sm text-[#687078]">
                Ainda não existem categorias.
              </p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {category.name}
                    </p>
                    <p className="text-xs text-[#687078]">
                      {category.description ||
                        'Sem descrição'}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() =>
                        void renameCategory(category)
                      }
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void removeCategory(category)
                      }
                      className="text-red-700"
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">
            Fabricantes
          </h2>
          <p className="mt-1 text-sm text-[#687078]">
            Marcas usadas para filtrar e
            identificar produtos.
          </p>

          <form
            onSubmit={createManufacturer}
            className="mt-5 flex gap-3 rounded-lg bg-[#f4f4f2] p-4"
          >
            <label className="grid flex-1 gap-1 text-sm font-semibold">
              Nome do fabricante
              <input
                required
                value={manufacturerName}
                onChange={(event) =>
                  setManufacturerName(
                    event.target.value,
                  )
                }
                className="rounded-md border bg-white px-3 py-2 font-normal"
                placeholder="Ex.: BBS"
              />
            </label>
            <button
              disabled={submitting}
              className="self-end rounded-md bg-[#171a1d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              + Criar
            </button>
          </form>

          <div className="mt-4 divide-y">
            {manufacturers.length === 0 ? (
              <p className="py-5 text-sm text-[#687078]">
                Ainda não existem fabricantes.
              </p>
            ) : (
              manufacturers.map((manufacturer) => (
                <div
                  key={manufacturer.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <p className="font-semibold">
                    {manufacturer.name}
                  </p>
                  <div className="flex gap-3 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() =>
                        void renameManufacturer(
                          manufacturer,
                        )
                      }
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void removeManufacturer(
                          manufacturer,
                        )
                      }
                      className="text-red-700"
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
