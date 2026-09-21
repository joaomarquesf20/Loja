export const DEFAULT_PRODUCT_VARIANT_OPTION_KEY =
  'default'

export type ProductVariantOptionKeySelection = {
  optionId: string
  optionValueId: string
}

function normalizeId(
  value: string,
  fieldName: string,
) {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(
      `${fieldName} é obrigatório`,
    )
  }

  return normalized
}

export function createProductVariantOptionKey(
  selections: ProductVariantOptionKeySelection[],
) {
  if (selections.length === 0) {
    return DEFAULT_PRODUCT_VARIANT_OPTION_KEY
  }

  const normalized =
    selections.map((selection) => ({
      optionId: normalizeId(
        selection.optionId,
        'optionId',
      ),
      optionValueId: normalizeId(
        selection.optionValueId,
        'optionValueId',
      ),
    }))

  const seenOptionIds = new Set<string>()

  for (const selection of normalized) {
    if (
      seenOptionIds.has(
        selection.optionId,
      )
    ) {
      throw new Error(
        'Cada opção só pode ter um valor por variante',
      )
    }

    seenOptionIds.add(
      selection.optionId,
    )
  }

  normalized.sort((first, second) => {
    if (
      first.optionId <
      second.optionId
    ) {
      return -1
    }

    if (
      first.optionId >
      second.optionId
    ) {
      return 1
    }

    return 0
  })

  return JSON.stringify(
    normalized.map((selection) => [
      selection.optionId,
      selection.optionValueId,
    ]),
  )
}
