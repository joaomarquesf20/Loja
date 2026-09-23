'use client'

import {
  FormEvent,
  useEffect,
  useState,
} from 'react'
import ProductCompatibilitiesClient from './product-compatibilities-client'

type ProductShippingClass =
  | 'UNASSIGNED'
  | 'SMALL'
  | 'STANDARD'
  | 'BULKY'
  | 'HEAVY'
  | 'QUOTE_REQUIRED'

type AssignableProductShippingClass =
  Exclude<
    ProductShippingClass,
    'UNASSIGNED'
  >

type Product = {
  id: string
  categoryId: string
  productBrandId: string | null
  name: string
  slug: string
  sku: string
  description: string | null
  price: number | string
  stockQuantity: number
  isActive: boolean
  shippingClass: ProductShippingClass
  mainlandShippingCost:
    | string
    | null
}

type Category = {
  id: string
  name: string
}

type ProductBrand = {
  id: string
  name: string
}

type ProductForm = {
  name: string
  slug: string
  sku: string
  description: string
  price: string
  stockQuantity: string
  categoryId: string
  productBrandId: string
  isActive: boolean
  shippingClass:
    | ProductShippingClass
    | ''
  mainlandShippingCost: string
}

const assignableShippingClasses: Array<{
  value: AssignableProductShippingClass
  label: string
}> = [
  {
    value: 'SMALL',
    label: 'Pequeno',
  },
  {
    value: 'STANDARD',
    label: 'Normal',
  },
  {
    value: 'BULKY',
    label: 'Volumoso',
  },
  {
    value: 'HEAVY',
    label: 'Pesado',
  },
  {
    value: 'QUOTE_REQUIRED',
    label: 'Sob consulta',
  },
]

const shippingClassLabels:
  Record<ProductShippingClass, string> = {
  UNASSIGNED: 'Por classificar',
  SMALL: 'Pequeno',
  STANDARD: 'Normal',
  BULKY: 'Volumoso',
  HEAVY: 'Pesado',
  QUOTE_REQUIRED: 'Sob consulta',
}

const emptyForm: ProductForm = {
  name: '',
  slug: '',
  sku: '',
  description: '',
  price: '',
  stockQuantity: '0',
  categoryId: '',
  productBrandId: '',
  isActive: true,
  shippingClass: '',
  mainlandShippingCost: '',
}

function isAssignableShippingClass(
  value: ProductForm['shippingClass'],
): value is AssignableProductShippingClass {
  return (
    value === 'SMALL' ||
    value === 'STANDARD' ||
    value === 'BULKY' ||
    value === 'HEAVY' ||
    value === 'QUOTE_REQUIRED'
  )
}

function getShippingDescription(
  shippingClass:
    ProductForm['shippingClass'],
) {
  switch (shippingClass) {
    case 'SMALL':
      return 'Usa a tarifa global configurada para artigos pequenos.'

    case 'STANDARD':
      return 'Usa a tarifa global configurada para artigos de dimensão normal.'

    case 'BULKY':
      return 'Requer uma tarifa específica para Portugal Continental. O valor é validado pelos limites da configuração comercial e não beneficia de portes grátis.'

    case 'HEAVY':
      return 'Classe reservada a artigos pesados. O checkout automático permanece indisponível enquanto não existir uma regra comercial ativa.'

    case 'QUOTE_REQUIRED':
      return 'O transporte deste produto fica sujeito a consulta e não usa checkout automático.'

    case 'UNASSIGNED':
      return 'Este produto histórico ainda precisa de uma classificação de transporte.'

    default:
      return null
  }
}

function formatProductShipping(
  product: Product,
) {
  const label =
    shippingClassLabels[
      product.shippingClass
    ]

  if (
    product.shippingClass !==
    'BULKY'
  ) {
    return label
  }

  if (
    product.mainlandShippingCost ===
    null
  ) {
    return `${label} — tarifa em falta`
  }

  const cost = Number(
    product.mainlandShippingCost,
  )

  if (!Number.isFinite(cost)) {
    return `${label} — tarifa inválida`
  }

  return `${label} — ${cost.toFixed(
    2,
  )} €`
}

async function getErrorMessage(
  response: Response,
) {
  try {
    const data =
      (await response.json()) as {
        error?: string
      }

    return (
      data.error ??
      'Ocorreu um erro inesperado'
    )
  } catch {
    return 'Ocorreu um erro inesperado'
  }
}

export default function ProductsClient() {
  const [products, setProducts] =
    useState<Product[]>([])

  const [categories, setCategories] =
    useState<Category[]>([])

  const [
    productBrands,
    setProductBrands,
  ] = useState<ProductBrand[]>([])

  const [form, setForm] =
    useState<ProductForm>(emptyForm)

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null)

  const [
    compatibilityProductId,
    setCompatibilityProductId,
  ] = useState<string | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const compatibilityProduct =
    compatibilityProductId === null
      ? null
      : products.find(
          (product) =>
            product.id ===
            compatibilityProductId,
        ) ?? null

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true)
        setError(null)

        const [
          productsResponse,
          categoriesResponse,
          brandsResponse,
        ] = await Promise.all([
          fetch(
            '/api/admin/products',
          ),
          fetch(
            '/api/admin/categories',
          ),
          fetch(
            '/api/admin/product-brands',
          ),
        ])

        if (!productsResponse.ok) {
          throw new Error(
            await getErrorMessage(
              productsResponse,
            ),
          )
        }

        if (!categoriesResponse.ok) {
          throw new Error(
            await getErrorMessage(
              categoriesResponse,
            ),
          )
        }

        if (!brandsResponse.ok) {
          throw new Error(
            await getErrorMessage(
              brandsResponse,
            ),
          )
        }

        const productsData =
          (await productsResponse.json()) as Product[]

        const categoriesData =
          (await categoriesResponse.json()) as Category[]

        const brandsData =
          (await brandsResponse.json()) as ProductBrand[]

        setProducts(productsData)
        setCategories(categoriesData)
        setProductBrands(brandsData)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar os dados',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadInitialData()
  }, [])

  async function reloadProducts() {
    const response = await fetch(
      '/api/admin/products',
    )

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response),
      )
    }

    const data =
      (await response.json()) as Product[]

    setProducts(data)
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setEditingProduct(null)
  }

  function startEditing(
    product: Product,
  ) {
    setEditingId(product.id)
    setEditingProduct(product)

    setForm({
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      description:
        product.description ?? '',
      price: String(product.price),
      stockQuantity: String(
        product.stockQuantity,
      ),
      categoryId:
        product.categoryId,
      productBrandId:
        product.productBrandId ?? '',
      isActive: product.isActive,
      shippingClass:
        product.shippingClass,
      mainlandShippingCost:
        product.mainlandShippingCost ??
        '',
    })

    setError(null)
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (submitting) {
      return
    }

    if (!form.categoryId) {
      setError(
        'Seleciona uma categoria válida',
      )
      return
    }

    if (
      !isAssignableShippingClass(
        form.shippingClass,
      )
    ) {
      setError(
        'Seleciona uma classe de transporte válida',
      )
      return
    }

    const price =
      Number(form.price)

    const stockQuantity =
      Number(form.stockQuantity)

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      setError(
        'O preço tem de ser um número igual ou superior a zero',
      )
      return
    }

    if (
      !Number.isInteger(
        stockQuantity,
      ) ||
      stockQuantity < 0
    ) {
      setError(
        'O stock tem de ser um número inteiro igual ou superior a zero',
      )
      return
    }

    let mainlandShippingCost:
      | number
      | null = null

    if (
      form.shippingClass ===
      'BULKY'
    ) {
      if (
        !form.mainlandShippingCost.trim()
      ) {
        setError(
          'Indica os portes específicos do artigo volumoso',
        )
        return
      }

      const parsedShippingCost =
        Number(
          form.mainlandShippingCost,
        )

      if (
        !Number.isFinite(
          parsedShippingCost,
        ) ||
        parsedShippingCost < 0
      ) {
        setError(
          'Os portes específicos têm de ser um número igual ou superior a zero',
        )
        return
      }

      const scaled =
        parsedShippingCost * 100

      if (
        Math.abs(
          scaled -
            Math.round(scaled),
        ) > 0.000001
      ) {
        setError(
          'Os portes específicos só podem ter duas casas decimais',
        )
        return
      }

      mainlandShippingCost =
        parsedShippingCost
    }

    const payload = {
      name: form.name,
      slug: form.slug,
      sku: form.sku,
      description:
        form.description,
      price,
      stockQuantity,
      categoryId:
        form.categoryId,
      productBrandId:
        form.productBrandId ||
        null,
      isActive: form.isActive,
      shippingClass:
        form.shippingClass,
      mainlandShippingCost,
    }

    const requestPayload =
      editingId && editingProduct
        ? {
            name: payload.name,
            slug: payload.slug,
            description: payload.description,
            categoryId: payload.categoryId,
            productBrandId: payload.productBrandId,
            shippingClass: payload.shippingClass,
            mainlandShippingCost:
              payload.mainlandShippingCost,
            ...(payload.sku !== editingProduct.sku
              ? { sku: payload.sku }
              : {}),
            ...(payload.price !==
            Number(editingProduct.price)
              ? { price: payload.price }
              : {}),
            ...(payload.stockQuantity !==
            editingProduct.stockQuantity
              ? {
                  stockQuantity:
                    payload.stockQuantity,
                }
              : {}),
            ...(payload.isActive !==
            editingProduct.isActive
              ? { isActive: payload.isActive }
              : {}),
          }
        : payload

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch(
        editingId
          ? `/api/admin/products/${editingId}`
          : '/api/admin/products',
        {
          method: editingId
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(
            requestPayload,
          ),
        },
      )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
          ),
        )
      }

      await reloadProducts()
      resetForm()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível guardar o produto',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(
    product: Product,
  ) {
    if (submitting) {
      return
    }

    const confirmed =
      window.confirm(
        `Tens a certeza de que queres apagar "${product.name}"?`,
      )

    if (!confirmed) {
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch(
        `/api/admin/products/${product.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
          ),
        )
      }

      await reloadProducts()

      if (
        editingId === product.id
      ) {
        resetForm()
      }

      if (
        compatibilityProductId ===
        product.id
      ) {
        setCompatibilityProductId(
          null,
        )
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível apagar o produto',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <p>A carregar produtos...</p>
    )
  }

  const shippingDescription =
    getShippingDescription(
      form.shippingClass,
    )

  return (
    <div className="space-y-8">
      {error && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-red-800"
        >
          {error}
        </div>
      )}

      <section className="rounded border p-4">
        <h2 className="mb-4 text-xl font-semibold">
          {editingId
            ? 'Editar produto'
            : 'Novo produto'}
        </h2>

        {categories.length === 0 && (
          <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
            Não existem categorias
            disponíveis. Cria primeiro uma
            categoria antes de adicionar
            produtos.
          </p>
        )}

        {editingId &&
          form.shippingClass ===
            'UNASSIGNED' && (
            <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
              Este produto histórico ainda
              está por classificar. Escolhe
              uma classe de transporte antes
              de guardar.
            </p>
          )}

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-2"
        >
          <label className="flex flex-col gap-1">
            <span>Nome</span>
            <input
              required
              type="text"
              value={form.name}
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    name:
                      event.target
                        .value,
                  }),
                )
              }
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span>Slug</span>
            <input
              required
              type="text"
              value={form.slug}
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    slug:
                      event.target
                        .value,
                  }),
                )
              }
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span>SKU</span>
            <input
              required
              type="text"
              value={form.sku}
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    sku:
                      event.target
                        .value,
                  }),
                )
              }
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span>Preço (€)</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    price:
                      event.target
                        .value,
                  }),
                )
              }
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span>Stock</span>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={
                form.stockQuantity
              }
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    stockQuantity:
                      event.target
                        .value,
                  }),
                )
              }
              className="rounded border px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span>Categoria</span>
            <select
              required
              value={form.categoryId}
              disabled={
                submitting ||
                categories.length === 0
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    categoryId:
                      event.target
                        .value,
                  }),
                )
              }
              className="rounded border px-3 py-2"
            >
              <option value="">
                Selecionar categoria
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={
                      category.id
                    }
                  >
                    {category.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span>Marca</span>
            <select
              value={
                form.productBrandId
              }
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    productBrandId:
                      event.target
                        .value,
                  }),
                )
              }
              className="rounded border px-3 py-2"
            >
              <option value="">
                Sem marca
              </option>

              {productBrands.map(
                (brand) => (
                  <option
                    key={brand.id}
                    value={brand.id}
                  >
                    {brand.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span>
              Classe de transporte
            </span>

            <select
              required
              aria-label="Classe de transporte"
              value={
                form.shippingClass
              }
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    shippingClass:
                      event.target
                        .value as ProductForm['shippingClass'],
                    mainlandShippingCost:
                      event.target
                        .value ===
                      'BULKY'
                        ? current.mainlandShippingCost
                        : '',
                  }),
                )
              }
              className="rounded border px-3 py-2"
            >
              <option value="">
                Selecionar classe
              </option>

              {form.shippingClass ===
                'UNASSIGNED' && (
                <option
                  value="UNASSIGNED"
                  disabled
                >
                  Por classificar —
                  corrigir
                </option>
              )}

              {assignableShippingClasses.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>

            {shippingDescription && (
              <span className="text-sm text-neutral-600">
                {
                  shippingDescription
                }
              </span>
            )}
          </label>

          {form.shippingClass ===
            'BULKY' && (
            <label className="flex flex-col gap-1">
              <span>
                Portes específicos —
                Portugal Continental (€)
              </span>

              <input
                required
                aria-label="Portes específicos — Portugal Continental (€)"
                type="number"
                min="0"
                step="0.01"
                value={
                  form.mainlandShippingCost
                }
                disabled={submitting}
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      mainlandShippingCost:
                        event.target
                          .value,
                    }),
                  )
                }
                className="rounded border px-3 py-2"
              />

              <span className="text-sm text-neutral-600">
                O servidor valida este
                valor pelos limites
                atualmente definidos na
                configuração comercial.
              </span>
            </label>
          )}

          <label className="flex items-center gap-2 self-end py-2">
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    isActive:
                      event.target
                        .checked,
                  }),
                )
              }
            />

            <span>Produto ativo</span>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span>Descrição</span>
            <textarea
              value={
                form.description
              }
              disabled={submitting}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    description:
                      event.target
                        .value,
                  }),
                )
              }
              rows={4}
              className="rounded border px-3 py-2"
            />
          </label>

          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={
                submitting ||
                categories.length === 0
              }
              className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'A guardar...'
                : editingId
                  ? 'Guardar alterações'
                  : 'Criar produto'}
            </button>

            {editingId && (
              <button
                type="button"
                disabled={submitting}
                onClick={resetForm}
                className="rounded border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Produtos
        </h2>

        {products.length === 0 ? (
          <p>
            Não existem produtos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr>
                  <th className="border p-2 text-left">
                    Nome
                  </th>

                  <th className="border p-2 text-left">
                    SKU
                  </th>

                  <th className="border p-2 text-left">
                    Slug
                  </th>

                  <th className="border p-2 text-right">
                    Preço
                  </th>

                  <th className="border p-2 text-right">
                    Stock
                  </th>

                  <th className="border p-2 text-left">
                    Transporte
                  </th>

                  <th className="border p-2 text-left">
                    Estado
                  </th>

                  <th className="border p-2 text-left">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {products.map(
                  (product) => (
                    <tr
                      key={
                        product.id
                      }
                    >
                      <td className="border p-2">
                        {
                          product.name
                        }
                      </td>

                      <td className="border p-2">
                        {
                          product.sku
                        }
                      </td>

                      <td className="border p-2">
                        {
                          product.slug
                        }
                      </td>

                      <td className="border p-2 text-right">
                        {Number(
                          product.price,
                        ).toFixed(2)}{' '}
                        €
                      </td>

                      <td className="border p-2 text-right">
                        {
                          product.stockQuantity
                        }
                      </td>

                      <td className="border p-2">
                        {formatProductShipping(
                          product,
                        )}
                      </td>

                      <td className="border p-2">
                        {product.isActive
                          ? 'Ativo'
                          : 'Inativo'}
                      </td>

                      <td className="border p-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              submitting
                            }
                            onClick={() =>
                              startEditing(
                                product,
                              )
                            }
                            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            disabled={
                              submitting
                            }
                            onClick={() => {
                              setCompatibilityProductId(
                                product.id,
                              )
                              setError(
                                null,
                              )
                            }}
                            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Compatibilidades
                          </button>

                          <button
                            type="button"
                            disabled={
                              submitting
                            }
                            onClick={() => {
                              void handleDelete(
                                product,
                              )
                            }}
                            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Apagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {compatibilityProduct && (
        <ProductCompatibilitiesClient
          key={
            compatibilityProduct.id
          }
          productId={
            compatibilityProduct.id
          }
          productName={
            compatibilityProduct.name
          }
          onClose={() =>
            setCompatibilityProductId(
              null,
            )
          }
        />
      )}
    </div>
  )
}
