'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { getCategoryFilterProfile } from '@/lib/storefront-category-profile'
import type {
  AdminProduct,
  AdminProductImage,
  AdminProductResponseShippingClass,
} from '@/server/admin-products'
import ProductImageManager from './product-image-manager'
import ProductVariantEditor, {
  createVariantDraft,
  type AdminVariantDraft,
} from './product-variant-editor'
import ProductVehicleCompatibilityEditor, {
  createDraft,
  type ProductCompatibilityDraft,
} from './product-vehicle-compatibility-editor'

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

type ShippingClass =
  | 'SMALL'
  | 'STANDARD'
  | 'BULKY'
  | 'HEAVY'
  | 'QUOTE_REQUIRED'

type Props = {
  productId?: string
}

const shippingLabels: Record<
  AdminProductResponseShippingClass,
  string
> = {
  UNASSIGNED: 'Por classificar',
  SMALL: 'Pequeno',
  STANDARD: 'Normal',
  BULKY: 'Volumoso',
  HEAVY: 'Pesado',
  QUOTE_REQUIRED: 'Sob consulta',
}

async function getResponseBody(
  response: Response,
): Promise<{
  error?: string
  fieldErrors?: Record<string, string[]>
}> {
  try {
    const data = (await response.json()) as {
      error?: string
      fieldErrors?: Record<string, string[]>
    }
    return data
  } catch {
    return {
      error: `Erro HTTP ${response.status}`,
    }
  }
}

/**
 * Converte chaves de erro (ex.: "variants.1.sku") em rótulos
 * legíveis para o resumo de problemas no topo do formulário.
 */
function getFieldLabel(key: string) {
  const parts = key.split('.')

  if (
    parts[0] === 'variants' &&
    parts.length >= 3
  ) {
    const variantNumber = Number(parts[1]) + 1
    const fieldLabels: Record<string, string> = {
      sku: 'SKU',
      price: 'Preço',
      stockQuantity: 'Stock',
      isActive: 'Ativa',
      selections: 'Especificações',
    }
    const selectionLabels: Record<string, string> =
      {
        diameter: 'Diâmetro',
        width: 'Largura',
        pcd: 'PCD',
        offset: 'ET',
        centre_bore: 'CB',
        finish: 'Acabamento',
        front_drop_mm: 'Rebaixo dianteiro',
        rear_drop_mm: 'Rebaixo traseiro',
      }

    const fieldLabel =
      parts[2] === 'selections'
        ? parts.length >= 4
          ? (selectionLabels[parts[3]] ??
              parts[3])
          : 'Especificações'
        : (fieldLabels[parts[2] ?? ''] ??
            parts[2])

    return `Variante ${variantNumber} · ${fieldLabel ?? 'campo'}`
  }

  if (parts[0] === 'variants') {
    return 'Variantes'
  }

  if (
    parts[0] === 'compatibilities' &&
    parts.length >= 2
  ) {
    return `Aplicação ${Number(parts[1]) + 1}`
  }

  if (parts[0] === 'compatibilities') {
    return 'Aplicações de veículo'
  }

  const topLevelLabels: Record<string, string> = {
    name: 'Nome',
    categoryId: 'Categoria',
    productSku: 'SKU do produto',
    description: 'Descrição',
    defaultFinish: 'Acabamento de catálogo',
    shippingClass: 'Classe de transporte',
    mainlandShippingCost:
      'Portes de Portugal Continental',
    imageMetadata: 'Imagens',
    _form: 'Formulário',
  }

  return topLevelLabels[key] ?? key
}

async function getErrorMessage(
  response: Response,
) {
  const body = await getResponseBody(response)

  return (
    body.error ?? `Erro HTTP ${response.status}`
  )
}

/** Lê "169,90" / "169.90" devolvendo 169.9, ou null. */
function parseDecimalInput(
  value: string,
): number | null {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed)
    ? parsed
    : null
}

/**
 * Devolve, por índice de variante, a mensagem de conflito quando outra
 * linha repete exatamente as especificações e o acabamento.
 */
export function computeVariantConflicts(
  variants: AdminVariantDraft[],
): Record<number, string> {
  const conflicts: Record<number, string> = {}
  const firstVariantByKey = new Map<
    string,
    number
  >()

  for (const [
    index,
    variant,
  ] of variants.entries()) {
    if (
      Object.values(variant.selections).some(
        (value) => !value.trim(),
      )
    ) {
      continue
    }

    const key = Object.entries(
      variant.selections,
    )
      .sort(
        ([left], [right]) =>
          left.localeCompare(right),
      )
      .map(
        ([code, value]) =>
          `${code}=${value.trim().toLocaleLowerCase('pt-PT')}`,
      )
      .join('\u0000')

    const firstIndex =
      firstVariantByKey.get(key)

    if (firstIndex === undefined) {
      firstVariantByKey.set(key, index)
      continue
    }

    conflicts[index] =
      `Variante ${index + 1} repete a combinação da variante ${firstIndex + 1}.`
    conflicts[firstIndex] =
      `Variante ${firstIndex + 1} repete a combinação da variante ${index + 1}.`
  }

  return conflicts
}

function toSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('pt-PT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function numberOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(
    trimmed.replace(',', '.'),
  )
  return Number.isFinite(parsed)
    ? parsed
    : null
}

function productToVariantDrafts(
  product: AdminProduct,
): AdminVariantDraft[] {
  if (product.variants.length === 0) {
    return [createVariantDraft()]
  }

  return product.variants.map((variant) =>
    createVariantDraft({
      id: variant.id,
      sku: variant.sku,
      price: variant.price,
      stockQuantity:
        String(variant.stockQuantity),
      isActive: variant.isActive,
      selections: Object.fromEntries(
        variant.options.map((option) => [
          option.code,
          option.value,
        ]),
      ),
      specifications:
        variant.specifications.map(
          (specification) => ({
            ...specification,
          }),
        ),
    }),
  )
}

function productToCompatibilityDrafts(
  product: AdminProduct,
): ProductCompatibilityDraft[] {
  return product.compatibilities.map(
    (compatibility) =>
      createDraft({
        vehicleBrandId:
          compatibility.vehicleBrandId,
        vehicleModelId:
          compatibility.vehicleModelId,
        vehicleGenerationId:
          compatibility.vehicleGenerationId ??
          '',
        vehicleConfigurationId:
          compatibility.vehicleConfigurationId ??
          '',
        yearMin:
          compatibility.yearMin === null
            ? ''
            : String(
                compatibility.yearMin,
              ),
        yearMax:
          compatibility.yearMax === null
            ? ''
            : String(
                compatibility.yearMax,
              ),
      }),
  )
}

function productImagesToDrafts(
  product: AdminProduct,
): AdminProductImage[] {
  if (
    product.imageMetadata &&
    product.imageMetadata.length > 0
  ) {
    return product.imageMetadata
  }

  return product.images.map(
    (url, index) => ({
      id: `legacy-${index}`,
      url,
      altText: null,
      sortOrder: index,
      isPrimary: index === 0,
      finish: null,
      finishValueId: null,
    }),
  )
}

export default function ProductEditorClient({
  productId,
}: Props) {
  const isEditing = Boolean(productId)
  const [step, setStep] = useState<
    'type' | 'details'
  >(isEditing ? 'details' : 'type')
  const [product, setProduct] =
    useState<AdminProduct | null>(null)
  const [categories, setCategories] =
    useState<Category[]>([])
  const [manufacturers, setManufacturers] =
    useState<Manufacturer[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [manufacturerId, setManufacturerId] =
    useState('')
  const [name, setName] = useState('')
  const [description, setDescription] =
    useState('')
  const [imageMetadata, setImageMetadata] =
    useState<AdminProductImage[]>([])
  const [defaultFinish, setDefaultFinish] =
    useState<string | null>(null)
  const [variants, setVariants] = useState<
    AdminVariantDraft[]
  >([createVariantDraft()])
  const [compatibilities, setCompatibilities] =
    useState<ProductCompatibilityDraft[]>([])
  const [shippingClass, setShippingClass] =
    useState<
      | ShippingClass
      | 'UNASSIGNED'
    >('STANDARD')
  const [mainlandShippingCost, setMainlandShippingCost] =
    useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] =
    useState(false)
  const [duplicating, setDuplicating] =
    useState(false)
  const [error, setError] = useState<string | null>(
    null,
  )
  const [fieldErrors, setFieldErrors] =
    useState<Record<string, string[]>>({})
  const [dirty, setDirty] = useState(false)
  const [creatingCategory, setCreatingCategory] =
    useState(false)
  const [newCategoryName, setNewCategoryName] =
    useState('')
  const [creatingManufacturer, setCreatingManufacturer] =
    useState(false)
  const [newManufacturerName, setNewManufacturerName] =
    useState('')
  const router = useRouter()

  const selectedCategory =
    categories.find(
      (category) => category.id === categoryId,
    ) ?? null
  const profile = useMemo(
    () =>
      selectedCategory
        ? getCategoryFilterProfile(
            selectedCategory,
          )
        : 'generic',
    [selectedCategory],
  )
  const finishes = useMemo(
    () =>
      profile === 'wheels'
        ? Array.from(
            new Set(
              variants
                .map(
                  (variant) =>
                    variant.selections.finish?.trim(),
                )
                .filter(
                  (finish): finish is string =>
                    Boolean(finish),
                ),
            ),
          )
        : [],
    [profile, variants],
  )

  const markDirty = useCallback(() => {
    setDirty(true)
    // Qualquer edição limpa erros anteriores: os campos
    // válidos nunca permanecem marcados como inválidos.
    setFieldErrors({})
  }, [])

  /**
   * Espelha a regra do servidor para marcar visualmente TODAS as
   * linhas duplicadas: uma variante só colide com outra quando todas
   * as especificações e o acabamento são iguais; acabamentos
   * diferentes são variantes distintas válidas.
   */
  const variantConflicts = useMemo(
    () =>
      computeVariantConflicts(variants),
    [variants],
  )

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const requests: Array<Promise<Response>> = [
        fetch('/api/admin/categories', {
          cache: 'no-store',
        }),
        fetch('/api/admin/product-brands', {
          cache: 'no-store',
        }),
      ]

      if (productId) {
        requests.push(
          fetch(
            `/api/admin/products/${productId}/manage`,
            { cache: 'no-store' },
          ),
        )
      }

      const responses = await Promise.all(
        requests,
      )
      const categoriesResponse =
        responses[0]
      const manufacturersResponse =
        responses[1]

      if (!categoriesResponse.ok) {
        throw new Error(
          await getErrorMessage(
            categoriesResponse,
          ),
        )
      }
      if (!manufacturersResponse.ok) {
        throw new Error(
          await getErrorMessage(
            manufacturersResponse,
          ),
        )
      }

      const nextCategories =
        (await categoriesResponse.json()) as Category[]
      const nextManufacturers =
        (await manufacturersResponse.json()) as Manufacturer[]
      setCategories(nextCategories)
      setManufacturers(nextManufacturers)

      if (productId) {
        const productResponse = responses[2]
        if (!productResponse.ok) {
          throw new Error(
            await getErrorMessage(
              productResponse,
            ),
          )
        }
        const nextProduct =
          (await productResponse.json()) as AdminProduct
        setProduct(nextProduct)
        setCategoryId(
          nextProduct.category.id,
        )
        setManufacturerId(
          nextProduct.brand?.id ?? '',
        )
        setName(nextProduct.name)
        setDescription(
          nextProduct.description ?? '',
        )
        setImageMetadata(
          productImagesToDrafts(
            nextProduct,
          ),
        )
        setDefaultFinish(
          nextProduct.defaultFinish ?? null,
        )
        setVariants(
          productToVariantDrafts(
            nextProduct,
          ),
        )
        setCompatibilities(
          productToCompatibilityDrafts(
            nextProduct,
          ),
        )
        setShippingClass(
          nextProduct.shippingClass,
        )
        setMainlandShippingCost(
          nextProduct.mainlandShippingCost ??
            '',
        )
        setIsActive(nextProduct.isActive)
      }

      setDirty(false)
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o produto',
      )
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  useEffect(() => {
    if (!dirty) {
      return
    }

    const warnBeforeLeaving =
      (event: BeforeUnloadEvent) => {
        event.preventDefault()
        event.returnValue = ''
      }

    window.addEventListener(
      'beforeunload',
      warnBeforeLeaving,
    )
    return () =>
      window.removeEventListener(
        'beforeunload',
        warnBeforeLeaving,
      )
  }, [dirty])

  function chooseCategory(id: string) {
    setCategoryId(id)
    setStep('details')
    setDirty(true)
    setError(null)
  }

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
            name: newCategoryName,
            slug: toSlug(newCategoryName),
          }),
        },
      )
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }
      const created =
        (await response.json()) as Category
      setCategories((current) =>
        [...current, created].sort(
          (left, right) =>
            left.name.localeCompare(
              right.name,
              'pt-PT',
            ),
        ),
      )
      setNewCategoryName('')
      setCreatingCategory(false)
      chooseCategory(created.id)
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
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
            name: newManufacturerName,
            slug: toSlug(newManufacturerName),
          }),
        },
      )
      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response),
        )
      }
      const created =
        (await response.json()) as Manufacturer
      setManufacturers((current) =>
        [...current, created].sort(
          (left, right) =>
            left.name.localeCompare(
              right.name,
              'pt-PT',
            ),
        ),
      )
      setManufacturerId(created.id)
      setNewManufacturerName('')
      setCreatingManufacturer(false)
      setDirty(true)
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Não foi possível criar o fabricante',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const formRef = useRef<HTMLDivElement>(null)

  /** Coloca o primeiro campo inválido visível e focado. */
  function focusField(key: string) {
    const parts = key.split('.')
    let selector: string | null = null

    if (parts[0] === 'variants') {
      const variantIndex = Number(parts[1]) + 1

      if (parts[2] === 'selections') {
        if (parts.length >= 4) {
          const labels: Record<
            string,
            string
          > = {
            diameter: 'Diâmetro',
            width: 'Largura',
            pcd: 'PCD',
            offset: 'ET',
            centre_bore: 'CB',
            finish: 'Acabamento',
            front_drop_mm:
              'Rebaixo dianteiro',
            rear_drop_mm:
              'Rebaixo traseiro',
          }
          selector = `[aria-label="${labels[parts[3]] ?? ''} da variante ${variantIndex}"]`
        } else {
          // Erro de linha inteira (ex.: combinação
          // duplicada): foca a primeira especificação.
          selector = `[aria-label="Diâmetro da variante ${variantIndex}"]`
        }
      } else {
        const labels: Record<string, string> = {
          sku: 'SKU',
          price: 'Preço',
          stockQuantity: 'Stock',
        }
        selector = `[aria-label="${labels[parts[2] ?? ''] ?? ''} da variante ${variantIndex}"]`
      }
    } else {
      const labels: Record<string, string> = {
        name: 'Nome',
      }
      selector = labels[parts[0]]
        ? `[aria-label="${labels[parts[0]]}"]`
        : null
    }

    const element = selector
      ? formRef.current?.querySelector<HTMLInputElement>(
          selector,
        )
      : null

    if (element) {
      element.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      })
      element.focus({ preventScroll: true })
    } else {
      formRef.current?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  /**
   * Validação client-side que produz erros por campo. Não substitui a
   * validação do servidor: espelha-a para dar feedback imediato.
   * O SKU já não é exigido aqui — é gerado automaticamente quando fica
   * em branco.
   */
  function validate(): Record<
    string,
    string[]
  > | null {
    const errors: Record<string, string[]> = {}

    const addError = (
      key: string,
      message: string,
    ) => {
      errors[key] ??= []
      errors[key].push(message)
    }

    if (!name.trim()) {
      addError(
        'name',
        'Indica o nome do produto.',
      )
    }
    if (!categoryId) {
      addError(
        'categoryId',
        'Escolhe a categoria do produto.',
      )
    }
    if (variants.length === 0) {
      addError(
        'variants',
        'Adiciona pelo menos uma variante.',
      )
    }

    const variantSkus = new Set<string>()
    for (const [
      index,
      variant,
    ] of variants.entries()) {
      const sku = variant.sku.trim()

      if (sku) {
        if (
          variantSkus.has(sku)
        ) {
          addError(
            `variants.${index}.sku`,
            'O SKU está duplicado noutra variante.',
          )
        }
        variantSkus.add(sku)
      }

      const price = parseDecimalInput(
        variant.price,
      )
      if (price === null || price < 0) {
        addError(
          `variants.${index}.price`,
          'Indica um preço válido (ex.: 169,90).',
        )
      }

      const stock = parseDecimalInput(
        variant.stockQuantity,
      )
      if (
        stock === null ||
        stock < 0 ||
        !Number.isInteger(stock)
      ) {
        addError(
          `variants.${index}.stockQuantity`,
          'Indica um stock inteiro válido (ex.: 8).',
        )
      }
    }

    /**
     * Espelha a regra do servidor: duas variantes colidem só quando
     * TODAS as especificações E o acabamento coincidem (ignorando
     * maiúsculas e espaços). Acabamentos diferentes são variantes
     * distintas válidas mesmo com o mesmo conjunto de eixos; preço,
     * stock e SKU nunca entram na identidade.
     */
    const selectionKey = (
      selections: Record<string, string>,
    ) =>
      Object.entries(selections)
        .sort(
          ([left], [right]) =>
            left.localeCompare(right),
        )
        .map(
          ([code, value]) =>
            `${code}=${value.trim().toLocaleLowerCase('pt-PT')}`,
        )
        .join('\u0000')

    const firstVariantByKey = new Map<
      string,
      number
    >()
    for (const [
      index,
      variant,
    ] of variants.entries()) {
      if (
        Object.values(variant.selections)
          .some(
            (value) =>
              !value.trim(),
          )
      ) {
        // Linhas incompletas já são assinaladas por
        // "Preenche esta especificação"; não as
        // comparar como duplicados.
        continue
      }

      const key = selectionKey(
        variant.selections,
      )
      const firstIndex =
        firstVariantByKey.get(key)

      if (firstIndex === undefined) {
        firstVariantByKey.set(key, index)
        continue
      }

      addError(
        `variants.${index}.selections`,
        `Repete a combinação da variante ${firstIndex + 1}.`,
      )
      addError(
        `variants.${firstIndex}.selections`,
        `Repete a combinação da variante ${index + 1}.`,
      )
    }

    if (
      profile === 'wheels' ||
      profile === 'suspension'
    ) {
      const requiredCodes =
        profile === 'wheels'
          ? [
              'diameter',
              'width',
              'pcd',
              'offset',
              'centre_bore',
              'finish',
            ]
          : [
              'front_drop_mm',
              'rear_drop_mm',
            ]

      for (const [
        index,
        variant,
      ] of variants.entries()) {
        requiredCodes.forEach((code) => {
          if (!variant.selections[code]?.trim()) {
            addError(
              `variants.${index}.selections.${code}`
              ,
              'Preenche esta especificação.',
            )
          }
        })
      }
    }

    if (
      profile === 'suspension' &&
      compatibilities.length === 0
    ) {
      addError(
        'compatibilities',
        'Adiciona uma aplicação de veículo à suspensão.',
      )
    }

    for (const [
      index,
      compatibility,
    ] of compatibilities.entries()) {
      if (
        !compatibility.vehicleBrandId ||
        !compatibility.vehicleModelId
      ) {
        addError(
          `compatibilities.${index}`,
          'Completa a marca e o modelo da aplicação.',
        )
      }

      const yearMin = numberOrNull(
        compatibility.yearMin,
      )
      const yearMax = numberOrNull(
        compatibility.yearMax,
      )
      if (
        yearMin !== null &&
        yearMax !== null &&
        yearMax < yearMin
      ) {
        addError(
          `compatibilities.${index}.yearMax`,
          'O ano final tem de ser posterior ao inicial.',
        )
      }
    }

    if (
      shippingClass === 'BULKY' &&
      parseDecimalInput(
        mainlandShippingCost,
      ) === null
    ) {
      addError(
        'mainlandShippingCost',
        'Indica os portes de Portugal Continental para um produto volumoso.',
      )
    }

    if (
      shippingClass === 'UNASSIGNED'
    ) {
      addError(
        'shippingClass',
        'Escolhe uma classe de transporte válida.',
      )
    }

    return Object.keys(errors).length > 0
      ? errors
      : null
  }

  async function save(
    continueEditing: boolean,
  ) {
    const validationErrors = validate()

    if (validationErrors) {
      setFieldErrors(validationErrors)
      setError(
        'Alguns campos precisam de correção antes de guardar.',
      )
      focusField(
        Object.keys(validationErrors)[0],
      )
      return
    }

    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    const payload = {
      name: name.trim(),
      slug: product?.slug,
      productSku: product?.sku,
      categoryId,
      productBrandId:
        manufacturerId || null,
      description:
        description.trim() || null,
      images: imageMetadata
        .filter(
          (image) => !image.finish,
        )
        .map((image) => image.url),
      imageMetadata:
        imageMetadata.map(
          (image) => ({
            ...(image.id.startsWith(
              'draft-',
            )
              ? {}
              : { id: image.id }),
            url: image.url,
            altText:
              image.altText,
            sortOrder:
              image.sortOrder,
            isPrimary:
              image.isPrimary,
            finish:
              image.finish,
          }),
        ),
      defaultFinish:
        profile === 'wheels'
          ? defaultFinish
          : null,
      shippingClass,
      mainlandShippingCost:
        shippingClass === 'BULKY'
          ? parseDecimalInput(
              mainlandShippingCost,
            )
          : null,
      isActive,
      variants: variants.map((variant) => ({
        id: variant.id,
        // SKU em branco é gerado automaticamente no servidor.
        sku: variant.sku.trim(),
        price:
          parseDecimalInput(variant.price) ?? 0,
        stockQuantity: Math.round(
          parseDecimalInput(
            variant.stockQuantity,
          ) ?? 0,
        ),
        isActive: variant.isActive,
        selections: variant.selections,
        specifications:
          variant.specifications,
      })),
      compatibilities:
        compatibilities.map((compatibility) => ({
          vehicleBrandId:
            compatibility.vehicleBrandId,
          vehicleModelId:
            compatibility.vehicleModelId,
          vehicleGenerationId:
            compatibility.vehicleGenerationId ||
            null,
          vehicleConfigurationId:
            compatibility.vehicleConfigurationId ||
            null,
          yearMin: numberOrNull(
            compatibility.yearMin,
          ),
          yearMax: numberOrNull(
            compatibility.yearMax,
          ),
        })),
    }

    try {
      const response = await fetch(
        productId
          ? `/api/admin/products/${productId}/manage`
          : '/api/admin/products/manage',
        {
          method: productId
            ? 'PUT'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        const body =
          await getResponseBody(response)

        if (body.fieldErrors) {
          setFieldErrors(body.fieldErrors)
          focusField(
            Object.keys(
              body.fieldErrors,
            )[0] ?? '',
          )
        }

        throw new Error(
          body.error ??
            `Erro HTTP ${response.status}`,
        )
      }

      const saved =
        (await response.json()) as AdminProduct
      setDirty(false)

      if (!productId) {
        router.push(
          continueEditing
            ? `/admin/products/${saved.id}`
            : '/admin/products',
        )
        return
      }

      setProduct(saved)
      setImageMetadata(
        productImagesToDrafts(saved),
      )
      setDefaultFinish(
        saved.defaultFinish ?? null,
      )
      setError(null)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível guardar o produto',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function duplicateProduct() {
    if (!productId || !product) {
      return
    }
    if (
      !window.confirm(
        `Duplicar “${product.name}” como uma cópia inativa?`,
      )
    ) {
      return
    }

    setDuplicating(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/products/${productId}/duplicate`,
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
      setDuplicating(false)
    }
  }

  function leavePage(
    href: string,
  ) {
    if (
      dirty &&
      !window.confirm(
        'Existem alterações por guardar. Queres sair mesmo assim?',
      )
    ) {
      return
    }
    router.push(href)
  }

  if (loading) {
    return (
      <p className="rounded-lg border border-black/8 bg-white p-5 text-sm text-[#687078]">
        A carregar produto...
      </p>
    )
  }

  if (isEditing && !product) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
        {error ?? 'Produto não encontrado.'}
      </div>
    )
  }

  if (!isEditing && step === 'type') {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ef5b2a]">
            Novo produto · Passo 1 de 2
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Que tipo de produto vais vender?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687078]">
            A categoria define os campos e a
            variante que aparecem a seguir.
          </p>
        </header>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {categories.map((category) => {
            const categoryProfile =
              getCategoryFilterProfile(category)
            const descriptions = {
              wheels:
                'Diâmetro, largura, PCD, ET, CB, acabamento e variantes.',
              suspension:
                'Rebaixo e aplicações por make, modelo, geração e motor.',
              exterior:
                'Produto, variantes e compatibilidade veicular.',
              generic:
                'Produto, variantes, SKU, preço e stock.',
            }

            return (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  chooseCategory(category.id)
                }
                className="group min-h-44 rounded-xl border border-black/8 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#ef5b2a] hover:shadow-md"
              >
                <span className="text-xs font-black uppercase tracking-[0.1em] text-[#ef5b2a]">
                  {categoryProfile === 'wheels'
                    ? 'Jantes'
                    : categoryProfile === 'suspension'
                      ? 'Suspensão'
                      : categoryProfile === 'exterior'
                        ? 'Exterior'
                        : 'Produto'}
                </span>
                <span className="mt-2 block text-xl font-black">
                  {category.name}
                </span>
                <span className="mt-2 block text-sm leading-5 text-[#687078]">
                  {
                    descriptions[
                      categoryProfile
                    ]
                  }
                </span>
              </button>
            )
          })}
        </div>

        {categories.length === 0 && (
          <div className="rounded-xl border border-dashed border-black/20 bg-white p-6">
            <h2 className="font-black">
              Ainda não existem categorias
            </h2>
            <p className="mt-1 text-sm text-[#687078]">
              Cria a primeira categoria sem sair
              deste assistente.
            </p>
          </div>
        )}

        {creatingCategory ? (
          <form
            onSubmit={createCategory}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-[#ef5b2a]/30 bg-[#fff7f3] p-4"
          >
            <label className="grid flex-1 gap-1 text-xs font-bold">
              Nome da categoria
              <input
                autoFocus
                required
                value={newCategoryName}
                onChange={(event) =>
                  setNewCategoryName(
                    event.target.value,
                  )
                }
                className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <button
              disabled={submitting}
              className="rounded-md bg-[#171a1d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Criar e continuar
            </button>
            <button
              type="button"
              onClick={() =>
                setCreatingCategory(false)
              }
              className="rounded-md border px-4 py-2 text-sm font-bold"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() =>
              setCreatingCategory(true)
            }
            className="rounded-lg border border-dashed border-black/20 bg-white px-5 py-3 text-sm font-black text-[#ef5b2a]"
          >
            + Criar categoria
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={formRef} className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link
            href="/admin/products"
            onClick={(event) => {
              if (
                dirty &&
                !window.confirm(
                  'Existem alterações por guardar. Queres sair mesmo assim?',
                )
              ) {
                event.preventDefault()
              }
            }}
            className="text-sm font-bold text-[#687078] hover:text-black"
          >
            ← Voltar aos produtos
          </Link>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-[#ef5b2a]">
            {isEditing
              ? 'Editar produto'
              : 'Novo produto · Passo 2 de 2'}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            {isEditing
              ? product?.name
              : 'Detalhes e variantes'}
          </h1>
          {selectedCategory && (
            <p className="mt-2 text-sm text-[#687078]">
              Tipo: {selectedCategory.name}
              {profile === 'wheels'
                ? ' · compatibilidade por especificações'
                : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {product && (
            <>
              <button
                type="button"
                disabled={duplicating}
                onClick={() =>
                  void duplicateProduct()
                }
                className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                {duplicating
                  ? 'A duplicar...'
                  : 'Duplicar'}
              </button>
              <a
                href={`/produtos/${product.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-bold"
              >
                Preview ↗
              </a>
            </>
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={() => void save(false)}
            className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void save(true)}
            className="rounded-md bg-[#ef5b2a] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {submitting
              ? 'A guardar...'
              : isEditing
                ? 'Guardar e continuar'
                : 'Criar e continuar'}
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p className="font-black">
            {error}
          </p>

          {Object.keys(fieldErrors).length > 0 && (
            <>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-red-700">
                Corrige os campos seguintes:
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {Object.entries(
                  fieldErrors,
                ).map(([key, messages]) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() =>
                        focusField(key)
                      }
                      className="text-left font-semibold underline decoration-red-300 underline-offset-2 hover:text-red-950"
                    >
                      {getFieldLabel(key)}
                      {': '}
                      {messages.join(' ')}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-black">
              Informação do produto
            </h2>
            <p className="mt-1 text-sm text-[#687078]">
              Uma jante, um modelo de suspensão
              ou uma referência de exterior é um
              único produto.
            </p>
          </div>

          <label className="grid gap-1 text-sm font-bold">
            Nome
            <input
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                markDirty()
              }}
              className="rounded-md border px-3 py-2 font-normal"
              placeholder="Ex.: Japan Racing JR11"
            />
          </label>

          <label className="grid gap-1 text-sm font-bold">
            Fabricante
            <select
              value={manufacturerId}
              onChange={(event) => {
                setManufacturerId(
                  event.target.value,
                )
                markDirty()
              }}
              className="rounded-md border bg-white px-3 py-2 font-normal"
            >
              <option value="">
                Sem fabricante
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

          {creatingManufacturer ? (
            <form
              onSubmit={createManufacturer}
              className="flex items-end gap-2 rounded-lg border border-[#ef5b2a]/30 bg-[#fff7f3] p-3"
            >
              <label className="grid flex-1 gap-1 text-xs font-bold">
                Novo fabricante
                <input
                  autoFocus
                  required
                  value={newManufacturerName}
                  onChange={(event) =>
                    setNewManufacturerName(
                      event.target.value,
                    )
                  }
                  className="rounded-md border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <button
                disabled={submitting}
                className="rounded-md bg-[#171a1d] px-3 py-2 text-xs font-bold text-white"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() =>
                  setCreatingManufacturer(
                    false,
                  )
                }
                className="px-2 text-xs font-bold"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() =>
                setCreatingManufacturer(true)
              }
              className="justify-self-start text-xs font-bold text-[#ef5b2a]"
            >
              + Criar fabricante
            </button>
          )}

          <label className="grid gap-1 text-sm font-bold">
            Descrição
            <textarea
              rows={5}
              value={description}
              onChange={(event) => {
                setDescription(
                  event.target.value,
                )
                markDirty()
              }}
              className="rounded-md border px-3 py-2 font-normal"
              placeholder="Descrição curta baseada nas especificações"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => {
                setIsActive(
                  event.target.checked,
                )
                markDirty()
              }}
            />
            Produto ativo na loja
          </label>
        </div>

        <details className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-black">
            Envio e logística
          </summary>
          <p className="mt-2 text-sm text-[#687078]">
            Define como o artigo entra no
            checkout. É uma configuração
            operacional, não um campo do
            produto.
          </p>

          <label className="mt-4 grid gap-1 text-sm font-bold">
            Classe de transporte
            <select
              value={shippingClass}
              onChange={(event) => {
                setShippingClass(
                  event.target.value as
                    | ShippingClass
                    | 'UNASSIGNED',
                )
                markDirty()
              }}
              className="rounded-md border bg-white px-3 py-2 font-normal"
            >
              {(
                Object.entries(
                  shippingLabels,
                ) as Array<
                  [
                    AdminProductResponseShippingClass,
                    string,
                  ]
                >
              ).map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                  disabled={
                    value === 'UNASSIGNED'
                  }
                >
                  {label}
                </option>
              ))}
            </select>
          </label>

          {shippingClass === 'BULKY' && (
            <label className="mt-4 grid gap-1 text-sm font-bold">
              Portes — Portugal Continental (€)
              <input
                type="text"
                inputMode="decimal"
                min="0"
                value={mainlandShippingCost}
                onChange={(event) => {
                  setMainlandShippingCost(
                    event.target.value,
                  )
                  markDirty()
                }}
                className="rounded-md border px-3 py-2 font-normal"
              />
            </label>
          )}
        </details>
      </section>

      <section className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
        <ProductImageManager
          images={imageMetadata}
          finishes={finishes}
          defaultFinish={defaultFinish}
          onDefaultFinishChange={(value) => {
            setDefaultFinish(value)
            markDirty()
          }}
          onChange={(nextImages) => {
            setImageMetadata(nextImages)
            markDirty()
          }}
        />
      </section>

      <section className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
        <ProductVariantEditor
          profile={profile}
          variants={variants}
          conflicts={variantConflicts}
          onChange={(nextVariants) => {
            setVariants(nextVariants)
            markDirty()
          }}
        />
      </section>

      {(profile === 'suspension' ||
        profile === 'exterior') && (
        <section className="rounded-xl border border-black/8 bg-white p-5 shadow-sm">
          <ProductVehicleCompatibilityEditor
            value={compatibilities}
            onChange={(next) => {
              setCompatibilities(next)
              markDirty()
            }}
            required={profile === 'suspension'}
          />
        </section>
      )}

      {profile === 'wheels' && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Compatibilidade por especificação.</strong>{' '}
          Não são necessárias. As jantes não mantêm
          listas de veículos: a adequação resulta
          de PCD, CB, diâmetro, largura e ET.
        </section>
      )}

      <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-2 rounded-xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          type="button"
          disabled={submitting}
          onClick={() =>
            leavePage('/admin/products')
          }
          className="rounded-md border border-black/12 px-4 py-2 text-sm font-bold"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void save(false)}
          className="rounded-md border border-black/12 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void save(true)}
          className="rounded-md bg-[#ef5b2a] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
        >
          {submitting
            ? 'A guardar...'
            : isEditing
              ? 'Guardar e continuar'
              : 'Criar e continuar'}
        </button>
      </div>
    </div>
  )
}
