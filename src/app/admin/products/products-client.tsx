'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  AdminProduct,
  AdminProductBulkResult,
  AdminProductDeleteResult,
} from '@/server/admin-products'

import ProductsRowMenu from './products-row-menu'

type Category = {
  id: string
  name: string
  slug: string
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

    if (response.status >= 500) {
      return 'Não foi possível concluir a operação. Tenta novamente.'
    }

    return (
      data.error ??
      `Erro HTTP ${response.status}`
    )
  } catch {
    return response.status >= 500
      ? 'Não foi possível concluir a operação. Tenta novamente.'
      : `Erro HTTP ${response.status}`
  }
}

function stockSummary(
  product: AdminProduct,
) {
  const total = product.variants.reduce(
    (sum, variant) =>
      sum + variant.stockQuantity,
    0,
  )
  const outOfStock =
    product.variants.filter(
      (variant) =>
        variant.stockQuantity === 0,
    ).length

  if (total === 0) {
    return 'Sem stock'
  }

  return `${total} em stock${
    outOfStock > 0
      ? ` · ${outOfStock} variante${outOfStock === 1 ? '' : 's'} esgotada${outOfStock === 1 ? '' : 's'}`
      : ''
  }`
}

export default function ProductsClient() {
  const [products, setProducts] =
    useState<AdminProduct[]>([])
  const [categories, setCategories] =
    useState<Category[]>([])
  const [manufacturers, setManufacturers] =
    useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(
    null,
  )
  const [busyId, setBusyId] =
    useState<string | null>(null)
<<<<<<< HEAD

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null)

  const [
    compatibilityProductId,
    setCompatibilityProductId,
  ] = useState<string | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [submitting, setSubmitting] =
=======
  const [bulkBusy, setBulkBusy] =
>>>>>>> 8f2dc5e (Move storefront, cart, checkout and admin catalog onto the variant model)
    useState(false)
  const [selectedIds, setSelectedIds] =
    useState<string[]>([])
  const [success, setSuccess] =
    useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] =
    useState('')
  const [manufacturerId, setManufacturerId] =
    useState('')
  const [status, setStatus] = useState(
    'all',
  )
  const selectAllRef =
    useRef<HTMLInputElement>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [
        productsResponse,
        categoriesResponse,
        manufacturersResponse,
      ] = await Promise.all([
        fetch('/api/admin/products/manage', {
          cache: 'no-store',
        }),
        fetch('/api/admin/categories', {
          cache: 'no-store',
        }),
        fetch('/api/admin/product-brands', {
          cache: 'no-store',
        }),
      ])

      for (const response of [
        productsResponse,
        categoriesResponse,
        manufacturersResponse,
      ]) {
        if (!response.ok) {
          throw new Error(
            await getErrorMessage(response),
          )
        }
      }

      setProducts(
        (await productsResponse.json()) as AdminProduct[],
      )
      setCategories(
        (await categoriesResponse.json()) as Category[],
      )
      setManufacturers(
        (await manufacturersResponse.json()) as Manufacturer[],
      )
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar os produtos',
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

  const filteredProducts = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase('pt-PT')

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [
          product.name,
          product.sku,
          product.brand?.name ?? '',
          product.category.name,
        ].some((value) =>
          value
            .toLocaleLowerCase('pt-PT')
            .includes(query),
        )
      const matchesCategory =
        !categoryId ||
        product.category.id === categoryId
      const matchesManufacturer =
        !manufacturerId ||
        product.brand?.id === manufacturerId
      const matchesStatus =
        status === 'all' ||
        (status === 'active' &&
          product.isActive) ||
        (status === 'inactive' &&
          !product.isActive)

      return (
        matchesSearch &&
        matchesCategory &&
        matchesManufacturer &&
        matchesStatus
      )
<<<<<<< HEAD
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
=======
>>>>>>> 8f2dc5e (Move storefront, cart, checkout and admin catalog onto the variant model)
    })
  }, [
    categoryId,
    manufacturerId,
    products,
    search,
    status,
  ])

  const visibleProductIds = useMemo(
    () =>
      filteredProducts.map(
        (product) => product.id,
      ),
    [filteredProducts],
  )
  const activeSelectedIds = useMemo(
    () => {
      const visible = new Set(
        visibleProductIds,
      )
      return selectedIds.filter((id) =>
        visible.has(id),
      )
    },
    [selectedIds, visibleProductIds],
  )
  const allVisibleSelected =
    visibleProductIds.length > 0 &&
    activeSelectedIds.length ===
      visibleProductIds.length
  const someVisibleSelected =
    activeSelectedIds.length > 0

  // A filter change must not leave a previous selection active for a later
  // destructive action. The header therefore always operates on the current
  // filtered result set, never on the complete catalogue.

  useEffect(() => {
    if (!selectAllRef.current) {
      return
    }

    selectAllRef.current.indeterminate =
      someVisibleSelected &&
      !allVisibleSelected
  }, [
    allVisibleSelected,
    someVisibleSelected,
  ])

  function applyDeleteResult(
    result: AdminProductDeleteResult,
  ) {
    setProducts((current) => {
      if (result.status === 'deleted') {
        return current.filter(
          (product) =>
            product.id !== result.id,
        )
      }

      return current.map((product) =>
        product.id === result.id
          ? {
              ...product,
              isActive: false,
            }
          : product,
      )
    })
    setSelectedIds((current) =>
      current.filter((id) => id !== result.id),
    )
  }

  function pluralizeProducts(
    count: number,
  ) {
    return count === 1
      ? 'produto'
      : 'produtos'
  }

  function countedProducts(
    count: number,
    singular: string,
    plural: string,
  ) {
    return `${count} ${pluralizeProducts(
      count,
    )} ${count === 1 ? singular : plural}`
  }

  function bulkSummary(
    result: AdminProductBulkResult,
  ) {
    const parts: string[] = []
    const {
      deleted,
      archived,
      updated,
      failed,
    } = result

    if (deleted.length > 0) {
      parts.push(
        countedProducts(
          deleted.length,
          'eliminado',
          'eliminados',
        ),
      )
    }
    if (archived.length > 0) {
      parts.push(
        `${countedProducts(
          archived.length,
          'arquivado',
          'arquivados',
        )} para preservar o histórico`,
      )
    }
    if (updated.length > 0) {
      const actionLabel =
        result.action === 'activate'
          ? ['ativado', 'ativados']
          : ['desativado', 'desativados']
      parts.push(
        countedProducts(
          updated.length,
          actionLabel[0],
          actionLabel[1],
        ),
      )
    }
    if (failed.length === 0) {
      return parts.join(' · ')
    }

    return parts.length > 0
      ? `${parts.join(' · ')}; ${failed.length} ${pluralizeProducts(
          failed.length,
        )} sem alteração`
      : `${failed.length} ${pluralizeProducts(
          failed.length,
        )} sem alteração`
  }

  async function toggleProduct(
    product: AdminProduct,
  ) {
    setBusyId(product.id)
    setError(null)
    setSuccess(null)

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
      const response = await fetch(
        `/api/admin/products/${product.id}/manage`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
<<<<<<< HEAD
          body: JSON.stringify(
            requestPayload,
          ),
=======
          body: JSON.stringify({
            isActive: !product.isActive,
          }),
>>>>>>> 8f2dc5e (Move storefront, cart, checkout and admin catalog onto the variant model)
        },
      )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }

      await load()
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : 'Não foi possível alterar o estado do produto',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function deleteProduct(
    product: AdminProduct,
  ) {
    const confirmed = window.confirm(
      `Eliminar “${product.name}”?\n\nO produto será removido permanentemente quando não estiver associado a encomendas ou histórico. As variantes, imagens e restantes registos específicos do produto também serão removidos apenas quando for seguro. Se existir histórico, o produto será arquivado para preservar as encomendas e pagamentos. Esta ação não pode ser anulada.`,
    )

    if (!confirmed) {
      return
    }

    setBusyId(product.id)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        `/api/admin/products/${product.id}/manage`,
        { method: 'DELETE' },
      )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }

      const result =
        (await response.json()) as AdminProductDeleteResult
      applyDeleteResult(result)
      setSuccess(
        result.status === 'deleted'
          ? `${result.name} eliminado.`
          : `${result.name}: ${result.message}`,
      )
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Não foi possível eliminar o produto',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function runBulkAction(
    action: 'activate' | 'deactivate' | 'delete',
  ) {
    const ids = [...activeSelectedIds]
    if (ids.length === 0) {
      return
    }

    if (action === 'delete') {
      const selectedProducts =
        products.filter((product) =>
          ids.includes(product.id),
        )
      const names = selectedProducts
        .slice(0, 8)
        .map((product) => product.name)
      const remaining =
        selectedProducts.length - names.length
      const nameList =
        names.join(', ') +
        (remaining > 0
          ? ` e mais ${remaining}`
          : '')
      const confirmed = window.confirm(
        `Eliminar ${ids.length} ${pluralizeProducts(
          ids.length,
        )}?\n\nProdutos: ${nameList}.\n\nOs produtos sem referências serão eliminados permanentemente, incluindo os seus registos específicos quando for seguro. Os que tiverem histórico ou carrinhos associados serão arquivados para preservar encomendas e pagamentos. Esta ação não pode ser anulada.`,
      )

      if (!confirmed) {
        return
      }
    }

    setBulkBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        '/api/admin/products/bulk',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ids,
            action,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }

      const result =
        (await response.json()) as AdminProductBulkResult
      const deletedIds = new Set(
        result.deleted.map((item) => item.id),
      )
      const archivedIds = new Set(
        result.archived.map((item) => item.id),
      )
      const updatedById = new Map(
        result.updated.map((item) => [
          item.id,
          item.isActive,
        ]),
      )

      setProducts((current) =>
        current
          .filter(
            (product) =>
              !deletedIds.has(product.id),
          )
          .map((product) => {
            if (archivedIds.has(product.id)) {
              return {
                ...product,
                isActive: false,
              }
            }

            const isActive = updatedById.get(
              product.id,
            )
            return isActive === undefined
              ? product
              : {
                  ...product,
                  isActive,
                }
          }),
      )
      setSelectedIds([])

      const summary = bulkSummary(result)
      if (
        result.deleted.length > 0 ||
        result.archived.length > 0 ||
        result.updated.length > 0
      ) {
        setSuccess(`${summary}.`)
      }

      if (result.failed.length > 0) {
        const failureDetails =
          result.failed
            .map((failure) => {
              const product = products.find(
                (item) =>
                  item.id === failure.id,
              )
              return `${product?.name ?? failure.id}: ${failure.error}`
            })
            .join(' ')
        setError(
          `${result.failed.length} ${pluralizeProducts(
            result.failed.length,
          )} ${result.failed.length === 1 ? 'não pôde' : 'não puderam'} ser processado${result.failed.length === 1 ? '' : 's'}. ${failureDetails}`,
        )
      }
    } catch (bulkError) {
      setError(
        bulkError instanceof Error
          ? bulkError.message
          : 'Não foi possível concluir a operação em massa',
      )
      if (action === 'delete') {
        setSelectedIds([])
      }
    } finally {
      setBulkBusy(false)
    }
  }

  async function duplicateProduct(
    product: AdminProduct,
  ) {
    if (
      !window.confirm(
        `Duplicar “${product.name}” como uma cópia inativa?`,
      )
    ) {
      return
    }

    setBusyId(product.id)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(
        `/api/admin/products/${product.id}/duplicate`,
        { method: 'POST' },
      )

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }

      const copy =
        (await response.json()) as AdminProduct
      router.push(`/admin/products/${copy.id}`)
    } catch (duplicateError) {
      setError(
        duplicateError instanceof Error
          ? duplicateError.message
          : 'Não foi possível duplicar o produto',
      )
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <p className="rounded-lg border border-black/8 bg-white p-5 text-sm text-[#687078]">
        A carregar produtos...
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {success}
        </p>
      )}

      <section className="grid gap-3 rounded-xl border border-black/8 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(160px,220px))]">
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
          Pesquisar
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setSelectedIds([])
            }}
            placeholder="Nome, SKU ou marca"
            className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#121417]"
          />
        </label>

        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
          Categoria
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value)
              setSelectedIds([])
            }}
            className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#121417]"
          >
            <option value="">
              Todas
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

        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
          Fabricante
          <select
            value={manufacturerId}
            onChange={(event) => {
              setManufacturerId(
                event.target.value,
              )
              setSelectedIds([])
            }}
            className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#121417]"
          >
            <option value="">
              Todos
            </option>
            {manufacturers.map(
              (manufacturer) => (
                <option
                  key={manufacturer.id}
                  value={manufacturer.id}
                >
                  {manufacturer.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-[#687078]">
          Estado
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setSelectedIds([])
            }}
            className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#121417]"
          >
            <option value="all">
              Todos
            </option>
            <option value="active">
              Ativos
            </option>
            <option value="inactive">
              Inativos
            </option>
          </select>
        </label>
      </section>

      <section className="overflow-hidden rounded-xl border border-black/8 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-5 py-4">
          <div>
            <h2 className="font-black">
              Todos os produtos
            </h2>
            <p className="mt-0.5 text-xs text-[#687078]">
              {filteredProducts.length} de {products.length} produtos
            </p>
          </div>
          <Link
            href="/admin/products/new"
            className="rounded-lg bg-[#ef5b2a] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#d94a1b]"
          >
            + Novo produto
          </Link>
        </div>

        {activeSelectedIds.length > 0 && (
          <div
            role="toolbar"
            aria-label="Ações em massa"
            className="flex flex-wrap items-center gap-2 border-b border-black/8 bg-[#fff8f4] px-5 py-3"
          >
            <span className="mr-auto text-sm font-bold">
              {activeSelectedIds.length}{' '}
              {pluralizeProducts(
                activeSelectedIds.length,
              )}{' '}
              selecionado{activeSelectedIds.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() =>
                void runBulkAction('activate')
              }
              className="rounded-md border border-black/12 bg-white px-3 py-1.5 text-sm font-bold hover:border-black/30 disabled:opacity-50"
            >
              Ativar selecionados
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() =>
                void runBulkAction('deactivate')
              }
              className="rounded-md border border-black/12 bg-white px-3 py-1.5 text-sm font-bold hover:border-black/30 disabled:opacity-50"
            >
              Desativar / Arquivar selecionados
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() =>
                void runBulkAction('delete')
              }
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-bold text-red-700 hover:border-red-400 disabled:opacity-50"
            >
              Eliminar permanentemente
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() =>
                setSelectedIds([])
              }
              className="rounded-md px-3 py-1.5 text-sm font-bold text-[#ef5b2a] underline disabled:opacity-50"
            >
              Limpar seleção
            </button>
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold">
              Nenhum produto corresponde aos filtros
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setCategoryId('')
                setManufacturerId('')
                setStatus('all')
                setSelectedIds([])
              }}
              className="mt-2 text-sm font-bold text-[#ef5b2a] underline"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-[#f4f4f2] text-xs uppercase tracking-[0.06em] text-[#687078]">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={
                        visibleProductIds.length === 0 ||
                        bulkBusy
                      }
                      onChange={() =>
                        setSelectedIds(
                          allVisibleSelected
                            ? []
                            : visibleProductIds,
                        )
                      }
                      aria-label="Selecionar todos os produtos visíveis"
                      className="h-4 w-4 accent-[#ef5b2a]"
                    />
                  </th>
                  <th className="px-4 py-3 font-black">
                    Produto
                  </th>
                  <th className="px-4 py-3 font-black">
                    Fabricante
                  </th>
                  <th className="px-4 py-3 font-black">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-center font-black">
                    Variantes
                  </th>
                  <th className="px-4 py-3 font-black">
                    Stock
                  </th>
                  <th className="px-4 py-3 font-black">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right font-black">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={activeSelectedIds.includes(
                          product.id,
                        )}
                        disabled={bulkBusy}
                        onChange={() =>
                          setSelectedIds(
                            (current) =>
                              current.includes(
                                product.id,
                              )
                                ? current.filter(
                                    (id) =>
                                      id !==
                                      product.id,
                                  )
                                : [
                                    ...current,
                                    product.id,
                                  ],
                          )
                        }
                        aria-label={`Selecionar ${product.name}`}
                        className="h-4 w-4 accent-[#ef5b2a]"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-black hover:text-[#ef5b2a]"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-[#687078]">
                        {product.sku}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {product.brand?.name ?? '—'}
                    </td>
                    <td className="px-4 py-4">
                      {product.category.name}
                    </td>
                    <td className="px-4 py-4 text-center font-semibold">
                      {product.variants.length}
                    </td>
                    <td className="px-4 py-4">
                      {stockSummary(product)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                          product.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-200 text-neutral-700'
                        }`}
                      >
                        {product.isActive
                          ? 'Ativo'
                          : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <ProductsRowMenu
                        product={product}
                        busy={
                          busyId === product.id || bulkBusy
                        }
                        onToggleActive={(target) =>
                          void toggleProduct(target)
                        }
                        onDuplicate={(target) =>
                          void duplicateProduct(target)
                        }
                        onDelete={(target) =>
                          void deleteProduct(target)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
