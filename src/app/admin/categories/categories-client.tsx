'use client'

import { FormEvent, useEffect, useState } from 'react'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
}

interface CategoryForm {
  name: string
  slug: string
  description: string
  parentId: string
}

const emptyForm: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  parentId: '',
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

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newCategory, setNewCategory] =
    useState<CategoryForm>(emptyForm)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] =
    useState<CategoryForm>(emptyForm)

  async function loadCategories() {
  setLoading(true)

  try {
    const response = await fetch('/api/admin/categories', {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(await getErrorMessage(response))
    }

    const data = (await response.json()) as Category[]
    setCategories(data)
    setError(null)
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Erro ao carregar categorias',
    )
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  let cancelled = false

  async function loadInitialCategories() {
    try {
      const response = await fetch('/api/admin/categories', {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      const data = (await response.json()) as Category[]

      if (!cancelled) {
        setCategories(data)
        setError(null)
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : 'Erro ao carregar categorias',
        )
      }
    } finally {
      if (!cancelled) {
        setLoading(false)
      }
    }
  }

  void loadInitialCategories()

  return () => {
    cancelled = true
  }
}, [])

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCategory.name,
          slug: newCategory.slug,
          description: newCategory.description || undefined,
          parentId: newCategory.parentId || null,
        }),
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      setNewCategory(emptyForm)
      await loadCategories()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao criar categoria',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function startEditing(category: Category) {
    setEditingId(category.id)
    setEditingData({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
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
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingData.name,
          slug: editingData.slug,
          description: editingData.description || undefined,
          parentId: editingData.parentId || null,
        }),
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      cancelEditing()
      await loadCategories()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao atualizar categoria',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      'Tem a certeza de que pretende apagar esta categoria?',
    )

    if (!confirmed) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await getErrorMessage(response))
      }

      if (editingId === id) {
        cancelEditing()
      }

      await loadCategories()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao apagar categoria',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function getParentName(parentId: string | null) {
    if (!parentId) {
      return 'Sem categoria pai'
    }

    return (
      categories.find((category) => category.id === parentId)?.name ??
      'Categoria não encontrada'
    )
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
        <h2 className="text-lg font-semibold">Criar categoria</h2>

        <input
          type="text"
          placeholder="Nome"
          value={newCategory.name}
          onChange={(event) =>
            setNewCategory((current) => ({
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
          value={newCategory.slug}
          onChange={(event) =>
            setNewCategory((current) => ({
              ...current,
              slug: event.target.value,
            }))
          }
          required
          className="w-full rounded border p-2"
        />

        <textarea
          placeholder="Descrição (opcional)"
          value={newCategory.description}
          onChange={(event) =>
            setNewCategory((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          className="w-full rounded border p-2"
        />

        <select
          value={newCategory.parentId}
          onChange={(event) =>
            setNewCategory((current) => ({
              ...current,
              parentId: event.target.value,
            }))
          }
          className="w-full rounded border p-2"
        >
          <option value="">Sem categoria pai</option>

          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'A guardar...' : 'Criar categoria'}
        </button>
      </form>

      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Categorias existentes
        </h2>

        {loading ? (
          <p>A carregar categorias...</p>
        ) : categories.length === 0 ? (
          <p>Não existem categorias.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr>
                  <th className="border p-2 text-left">Nome</th>
                  <th className="border p-2 text-left">Slug</th>
                  <th className="border p-2 text-left">Descrição</th>
                  <th className="border p-2 text-left">
                    Categoria pai
                  </th>
                  <th className="border p-2 text-left">Ações</th>
                </tr>
              </thead>

              <tbody>
                {categories.map((category) => {
                  const isEditing = editingId === category.id

                  if (isEditing) {
                    return (
                      <tr key={category.id}>
                        <td colSpan={5} className="border p-3">
                          <form
                            onSubmit={(event) =>
                              handleEditSubmit(event, category.id)
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

                            <textarea
                              value={editingData.description}
                              onChange={(event) =>
                                setEditingData((current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              className="rounded border p-2"
                            />

                            <select
                              value={editingData.parentId}
                              onChange={(event) =>
                                setEditingData((current) => ({
                                  ...current,
                                  parentId: event.target.value,
                                }))
                              }
                              className="rounded border p-2"
                            >
                              <option value="">
                                Sem categoria pai
                              </option>

                              {categories
                                .filter(
                                  (option) =>
                                    option.id !== category.id,
                                )
                                .map((option) => (
                                  <option
                                    key={option.id}
                                    value={option.id}
                                  >
                                    {option.name}
                                  </option>
                                ))}
                            </select>

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
                    <tr key={category.id}>
                      <td className="border p-2">
                        {category.name}
                      </td>
                      <td className="border p-2">
                        {category.slug}
                      </td>
                      <td className="border p-2">
                        {category.description || '—'}
                      </td>
                      <td className="border p-2">
                        {getParentName(category.parentId)}
                      </td>
                      <td className="border p-2">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => startEditing(category)}
                            disabled={submitting}
                            className="underline"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(category.id)
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