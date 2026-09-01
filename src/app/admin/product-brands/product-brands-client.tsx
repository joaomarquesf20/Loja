'use client'

import { FormEvent, useEffect, useState } from 'react'

interface ProductBrand {
  id: string
  name: string
  slug: string
}

interface ProductBrandForm {
  name: string
  slug: string
}

const emptyForm: ProductBrandForm = {
  name: '',
  slug: '',
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string }

    if (typeof data.error === 'string' && data.error.length > 0) {
      return data.error
    }
  } catch {
    // A resposta pode não conter JSON válido.
  }

  return `Erro do servidor (${response.status})`
}

export default function ProductBrandsClient() {
  const [productBrands, setProductBrands] = useState<ProductBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newProductBrand, setNewProductBrand] =
    useState<ProductBrandForm>(emptyForm)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] =
    useState<ProductBrandForm>(emptyForm)

  async function loadProductBrands() {
    setLoading(true)

    try {
      const response = await fetch('/api/admin/product-brands', {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const data = (await response.json()) as ProductBrand[]
      setProductBrands(data)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao carregar marcas',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialProductBrands() {
      try {
        const response = await fetch('/api/admin/product-brands', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(await getErrorMessage(response))
        }

        const data = (await response.json()) as ProductBrand[]

        if (!cancelled) {
          setProductBrands(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Erro ao carregar marcas',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInitialProductBrands()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreateSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/product-brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProductBrand.name,
          slug: newProductBrand.slug,
        }),
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      setNewProductBrand(emptyForm)
      await loadProductBrands()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao criar marca',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function startEditing(productBrand: ProductBrand) {
    setEditingId(productBrand.id)
    setEditingData({
      name: productBrand.name,
      slug: productBrand.slug,
    })
    setError(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingData(emptyForm)
  }

  async function handleEditSubmit(
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/product-brands/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editingData.name,
            slug: editingData.slug,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      cancelEditing()
      await loadProductBrands()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao atualizar marca',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      'Tem a certeza de que pretende apagar esta marca?',
    )

    if (!confirmed) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/product-brands/${id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      if (editingId === id) {
        cancelEditing()
      }

      await loadProductBrands()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao apagar marca',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-8">
      {error && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-red-700"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreateSubmit}
        className="space-y-4 rounded border p-4"
      >
        <h2 className="text-lg font-semibold">
          Criar marca de produto
        </h2>

        <input
          type="text"
          placeholder="Nome"
          value={newProductBrand.name}
          onChange={(event) =>
            setNewProductBrand((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          required
          className="w-full rounded border p-2"
        />

        <input
          type="text"
          placeholder="Slug"
          value={newProductBrand.slug}
          onChange={(event) =>
            setNewProductBrand((current) => ({
              ...current,
              slug: event.target.value,
            }))
          }
          required
          className="w-full rounded border p-2"
        />

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'A guardar...' : 'Criar marca'}
        </button>
      </form>

      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Marcas existentes
        </h2>

        {loading ? (
          <p>A carregar marcas...</p>
        ) : productBrands.length === 0 ? (
          <p>Não existem marcas de produto.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr>
                  <th className="border p-2 text-left">Nome</th>
                  <th className="border p-2 text-left">Slug</th>
                  <th className="border p-2 text-left">Ações</th>
                </tr>
              </thead>

              <tbody>
                {productBrands.map((productBrand) => {
                  const isEditing = editingId === productBrand.id

                  if (isEditing) {
                    return (
                      <tr key={productBrand.id}>
                        <td colSpan={3} className="border p-3">
                          <form
                            onSubmit={(event) =>
                              handleEditSubmit(
                                event,
                                productBrand.id,
                              )
                            }
                            className="grid gap-3"
                          >
                            <input
                              type="text"
                              value={editingData.name}
                              onChange={(event) =>
                                setEditingData((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                              required
                              className="rounded border p-2"
                            />

                            <input
                              type="text"
                              value={editingData.slug}
                              onChange={(event) =>
                                setEditingData((current) => ({
                                  ...current,
                                  slug: event.target.value,
                                }))
                              }
                              required
                              className="rounded border p-2"
                            />

                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={submitting}
                                className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
                              >
                                Guardar
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={submitting}
                                className="rounded border px-3 py-2"
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={productBrand.id}>
                      <td className="border p-2">
                        {productBrand.name}
                      </td>
                      <td className="border p-2">
                        {productBrand.slug}
                      </td>
                      <td className="border p-2">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              startEditing(productBrand)
                            }
                            disabled={submitting}
                            className="underline"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(productBrand.id)
                            }
                            disabled={submitting}
                            className="text-red-600 underline"
                          >
                            Apagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}