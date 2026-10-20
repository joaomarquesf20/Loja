export type ProductImageMetadata = {
  id: string
  url: string
  altText?: string | null
  sortOrder?: number | null
  isPrimary?: boolean
  /**
   * The finish/colour value shared by the wheel variants.
   * Null or omitted means a general product image.
   */
  finish?: string | null
  /**
   * Stable database identifier of the finish value
   * (ProductOptionValue.id). Present when the image row
   * is linked to a real variant finish; legacy metadata
   * may omit it.
   */
  finishValueId?: string | null
}

/**
 * Chave canónica de acabamento. "Gloss Black", "GLOSS BLACK" e
 * "gloss-black" têm de ser o MESMO acabamento — as imagens são
 * associadas por esta chave (e, na base de dados, pelo
 * finishValueId estável), nunca pela etiqueta de exibição.
 */
export function normalizeFinishKey(
  finish: string | null | undefined,
): string {
  return (finish ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-PT')
}

export type ProductImageSource = {
  images?: string[]
  imageMetadata?: ProductImageMetadata[]
  defaultFinish?: string | null
}

function cleanUrl(value: string) {
  return value.trim()
}

function compareImages(
  first: ProductImageMetadata,
  second: ProductImageMetadata,
) {
  return (
    Number(second.isPrimary ?? false) -
      Number(first.isPrimary ?? false) ||
    (first.sortOrder ?? 0) - (second.sortOrder ?? 0) ||
    first.id.localeCompare(second.id)
  )
}

function uniqueImages(
  images: ProductImageMetadata[],
) {
  const seen = new Set<string>()
  return images.filter((image) => {
    const url = cleanUrl(image.url)
    const key = `${normalizeFinishKey(image.finish)}\u0000${url}`
    if (!url || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Chave de deduplicação de imagens importadas:
 * produto + acabamento normalizado + URL normalizado.
 * Usada pelo motor (dry-run) e pelo serviço (commit) —
 * uma só implementação, zero drift.
 */
export function importImageDedupeKey(
  finish: string | null | undefined,
  url: string,
): string {
  return `${normalizeFinishKey(finish)}\u0000${url
    .trim()
    .toLowerCase()}`
}

/**
 * Returns metadata rows in display order. Older products may not have
 * ProductImage rows yet, so their legacy URL array is adapted lazily.
 */
export function getProductImageMetadata(
  source: ProductImageSource,
): ProductImageMetadata[] {
  const metadata = (source.imageMetadata ?? [])
    .map((image, index) => ({
      ...image,
      url: cleanUrl(image.url),
      altText: image.altText?.trim() || null,
      finish: image.finish?.trim() || null,
      sortOrder: image.sortOrder ?? index,
    }))
    .filter((image) => image.url.length > 0)

  if (metadata.length > 0) {
    return uniqueImages(metadata).sort(compareImages)
  }

  return uniqueImages(
    (source.images ?? [])
      .map((url, index) => ({
        id: `legacy-${index}`,
        url,
        sortOrder: index,
        isPrimary: index === 0,
        finish: null,
      }))
      .map((image) => ({
        ...image,
        url: cleanUrl(image.url),
      })),
  ).sort(compareImages)
}

export function getGeneralProductImages(
  source: ProductImageSource,
) {
  return getProductImageMetadata(source).filter(
    (image) => !image.finish,
  )
}

export function getFinishProductImages(
  source: ProductImageSource,
  finish: string | null | undefined,
) {
  const normalizedFinish =
    normalizeFinishKey(finish)
  if (!normalizedFinish) {
    return []
  }

  return getProductImageMetadata(source).filter(
    (image) =>
      normalizeFinishKey(image.finish) ===
      normalizedFinish,
  )
}

/**
 * Chooses the gallery for a finish. The gallery follows the selected
 * finish strictly: finish images when the finish has its own gallery,
 * otherwise general (unassigned) images. Images of OTHER finishes are
 * never mixed into the active gallery — a finish without dedicated
 * images and without general images renders an empty gallery (the UI
 * shows its empty state) instead of borrowing another colour's photos.
 */
export function getProductGalleryImages(
  source: ProductImageSource,
  finish?: string | null,
): ProductImageMetadata[] {
  const metadata = getProductImageMetadata(source)
  const finishImages = getFinishProductImages(
    source,
    finish,
  )

  if (finishImages.length > 0) {
    return finishImages
  }

  return metadata.filter((image) => !image.finish)
}

/**
 * Catalog cards prefer the configured default finish, then its
 * primary image, followed by the product-level primary and finally
 * the first available image. This keeps old products working while
 * making finish galleries useful in listings.
 */
export function getPrimaryProductImage(
  source: ProductImageSource,
): ProductImageMetadata | null {
  const metadata = getProductImageMetadata(source)
  const defaultFinishImages = getFinishProductImages(
    source,
    source.defaultFinish,
  )
  const defaultFinishPrimary =
    defaultFinishImages.find(
      (image) => image.isPrimary,
    ) ?? defaultFinishImages[0]

  if (defaultFinishPrimary) {
    return defaultFinishPrimary
  }

  const general = metadata.filter(
    (image) => !image.finish,
  )
  const generalPrimary =
    general.find((image) => image.isPrimary) ??
    general[0]

  if (generalPrimary) {
    return generalPrimary
  }

  return (
    metadata.find(
      (image) => image.isPrimary,
    ) ?? metadata[0] ?? null
  )
}

export function getProductImageGroups(
  source: ProductImageSource,
  finishes: string[] = [],
) {
  const metadata = getProductImageMetadata(source)
  const normalizedFinishes = Array.from(
    new Set(
      finishes
        .map((finish) => finish.trim())
        .filter(Boolean),
    ),
  )

  const groups = [
    {
      key: null as string | null,
      label: 'Geral',
      images: metadata.filter(
        (image) => !image.finish,
      ),
    },
    ...normalizedFinishes.map((finish) => ({
      key: finish,
      label: finish,
      images: metadata.filter(
        (image) =>
          normalizeFinishKey(image.finish) ===
          normalizeFinishKey(finish),
      ),
    })),
  ]

  const knownFinishes = new Set(
    normalizedFinishes.map((finish) =>
      normalizeFinishKey(finish),
    ),
  )

  const unknownGroups = new Map<
    string,
    {
      key: string
      label: string
      images: ProductImageMetadata[]
    }
  >()

  for (const image of metadata) {
    if (
      !image.finish ||
      knownFinishes.has(
        normalizeFinishKey(image.finish),
      )
    ) {
      continue
    }

    const key = image.finish
    const normalizedKey =
      normalizeFinishKey(key)
    const group =
      unknownGroups.get(normalizedKey) ?? {
        key,
        label: key,
        images: [],
      }
    group.images.push(image)
    unknownGroups.set(normalizedKey, group)
  }

  groups.push(...unknownGroups.values())

  return groups
}
