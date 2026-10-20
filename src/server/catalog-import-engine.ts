import { toSlug } from '@/lib/slug'
import {
  importImageDedupeKey,
} from '@/lib/product-images'
import type {
  ImportField,
  ImportMode,
  ImportPreview,
  ImportPreviewProduct,
  ImportPreviewVariant,
  ImportProfile,
  ImportRowError,
  ProductRowInput,
  SkuStrategy,
} from './catalog-import-types'
import {
  normalizeImportBoolean,
  normalizeImportNumber,
  normalizeImportPrice,
  normalizeImportWheelValue,
  REQUIRED_FIELDS_BY_PROFILE,
  splitCompatibilityValue,
} from '@/lib/catalog-import'
import {
  appendSkuSuffix,
  collisionSuffix,
  generateImportSku,
} from '@/lib/sku-generator'

/**
 * Identidade mínima de uma variante já existente na BD:
 * produto (pelo SKU do produto = productCode) + especificações
 * canónicas. Igual identidade ⇒ mesma variante.
 */
export type DbVariantIdentity = {
  sku: string
  productCode: string
  combinationKey: string
}

/**
 * Chave de identidade de uma variante para deteção de combinações
 * duplicadas: todas as especificações normalizadas pela ordem do
 * campo. Preço/stock/SKU não fazem parte da identidade.
 */
export function buildVariantCombinationKey(
  selections: Record<string, string>,
): string {
  return Object.entries(selections)
    .sort(([left], [right]) =>
      left.localeCompare(right),
    )
    .map(
      ([code, value]) =>
        `${code}=${value.trim().toLocaleLowerCase('pt-PT')}`,
    )
    .join('\u0000')
}

/**
 * Converte as linhas cruas do ficheiro (mapas coluna → valor) em
 * produtos agrupados — cada linha é uma VARIANTE do produto do seu
 * grupo (productCode, ou nome na falta de código). Erros e avisos
 * são recolhidos; linhas inválidas nunca entram no lote.
 */
export function buildRowInputs({
  rows,
  mapping,
  categoryProfile,
  skuStrategy = 'auto',
  skuOverrides = {},
}: {
  rows: Array<Record<string, string>>
  mapping: Partial<Record<ImportField, string>>
  categoryProfile:
    | 'wheels'
    | 'suspension'
    | 'exterior'
    | 'generic'
  /**
   * Como obter o SKU interno: "auto" (gerado, por defeito),
   * "supplier" (referência do ficheiro) ou "custom" (edição
   * manual validada no servidor).
   */
  skuStrategy?: SkuStrategy
  /** SKU editado manualmente por linha (rowNumber → SKU). */
  skuOverrides?: Record<number, string>
}): {
  products: Array<{
    groupKey: string
    productCode: string
    productName: string
    brand: string
    category: string
    description: string
    variants: ProductRowInput[]
    images: Array<{
      url: string
      finish: string | null
    }>
    compatibilities: ProductRowInput['compatibilities']
  }>
  errors: ImportRowError[]
  warnings: Array<{ row: number; message: string }>
  totalRows: number
} {
  const errors: ImportRowError[] = []
  const warnings: Array<{
    row: number
    message: string
  }> = []

  const getValue = (
    row: Record<string, string>,
    field: ImportField,
  ) => {
    const column = mapping[field]
    return column ? (row[column] ?? '') : ''
  }

  const requiredFields =
    REQUIRED_FIELDS_BY_PROFILE[categoryProfile]

  const selectionFields: ImportField[] =
    categoryProfile === 'wheels'
      ? [
          'diameter',
          'width',
          'pcd',
          'offset',
          'centreBore',
          'finish',
        ]
      : []

  const compatibilityFields: ImportField[] =
    categoryProfile === 'suspension' ||
    categoryProfile === 'exterior'
      ? [
          'vehicleMake',
          'vehicleModel',
          'vehicleGeneration',
          'vehicleEngine',
          'yearFrom',
          'yearTo',
        ]
      : []

  const groups = new Map<
    string,
    {
      groupKey: string
      productCode: string
      productName: string
      brand: string
      category: string
      description: string
      variants: ProductRowInput[]
      images: Array<{
        url: string
        finish: string | null
      }>
      compatibilities: ProductRowInput['compatibilities']
    }
  >()

  rows.forEach((row, index) => {
    const rowNumber = index + 2

    const productName = getValue(
      row,
      'productName',
    ).trim()
    // O SKU é opcional no ficheiro: quando falta (ou a estratégia
    // é "auto"), é gerado pelo gerador determinístico.
    const sku = getValue(row, 'sku')
      .trim()
      .slice(0, 100)
    const supplierSku = getValue(row, 'sku')
      .trim()
      .slice(0, 100)
    const priceValue = getValue(row, 'price')

    const fail = (message: string) => {
      errors.push({
        row: rowNumber,
        sku,
        message,
      })
    }

    if (!productName) {
      fail('Nome do produto em falta.')
      return
    }

    const price = normalizeImportPrice(priceValue)

    if (price === null || price < 0) {
      fail(
        `Preço inválido: "${priceValue}". Usa 299,90 ou 299.90.`,
      )
      return
    }

    // Preço do conjunto de 4 jantes (opcional): em branco fica
    // null; malformado é AVISO (nunca falha a linha), igual ao
    // tratamento das imagens.
    const priceSetValue = getValue(row, 'priceSet')
    let priceSet: number | null = null

    if (priceSetValue.trim()) {
      const parsedPriceSet =
        normalizeImportPrice(priceSetValue)

      if (
        parsedPriceSet === null ||
        parsedPriceSet < 0
      ) {
        warnings.push({
          row: rowNumber,
          message: `Preço de conjunto inválido ("${priceSetValue}"): ignorado. Usa 1299,90 ou 1299.90.`,
        })
      } else {
        priceSet = parsedPriceSet
      }
    }

    const stockValue = getValue(row, 'stock')
    let stock = 0

    if (stockValue.trim()) {
      const parsedStock = normalizeImportNumber(
        stockValue,
      )

      if (
        parsedStock === null ||
        parsedStock < 0 ||
        !Number.isInteger(parsedStock)
      ) {
        fail(
          `Stock inválido: "${stockValue}". Usa um número inteiro.`,
        )
        return
      }

      stock = parsedStock
    }

    for (const field of requiredFields) {
      if (field === 'price') {
        continue
      }

      if (!getValue(row, field).trim()) {
        fail(
          `Campo obrigatório em falta: ${field}.`,
        )
        return
      }
    }

    const selections: Record<string, string> = {}
    let exteriorProductType: string | null = null

    for (const field of selectionFields) {
      const raw = getValue(row, field)

      if (!raw.trim()) {
        continue
      }

      selections[field] =
        normalizeImportWheelValue(field, raw)
    }

    // Exterior: o tipo de peça é o eixo de escolha na ficha
    // (Splitter frontal / Saias laterais / Spoiler Cap), não
    // uma especificação solta.
    if (categoryProfile === 'exterior') {
      const productType = getValue(
        row,
        'productType',
      ).trim()

      if (productType) {
        selections.productType = productType
        exteriorProductType = productType
      }
    }

    const specifications: ProductRowInput['specifications'] =
      []

    // Exterior: o tipo de peça entra também nas especificações
    // técnicas da ficha ("Tipo de produto: Splitter frontal"),
    // sem nunca ser um eixo de variante em produtos exteriores.
    if (exteriorProductType) {
      specifications.push({
        key: 'productType',
        label: 'Tipo de produto',
        value: exteriorProductType,
        unit: null,
        position: specifications.length,
      })
    }

    for (const [
      field,
      label,
    ] of [
      ['frontDropMm', 'Rebaixo dianteiro'],
      ['rearDropMm', 'Rebaixo traseiro'],
    ] as Array<[ImportField, string]>) {
      const raw = getValue(row, field)

      if (!raw.trim()) {
        continue
      }

      const parsed = normalizeImportNumber(raw)

      if (parsed === null) {
        fail(
          `Valor inválido para ${label}: "${raw}".`,
        )
        return
      }

      specifications.push({
        key: field,
        label,
        value: String(parsed),
        unit: 'mm',
        position: specifications.length,
      })

      selections[field] = String(parsed)
    }

    const compatibilities: ProductRowInput['compatibilities'] =
      []

    if (compatibilityFields.length > 0) {
      const make = getValue(
        row,
        'vehicleMake',
      ).trim()
      const model = getValue(
        row,
        'vehicleModel',
      ).trim()

      if (make && model) {
        const yearFrom = normalizeImportNumber(
          getValue(row, 'yearFrom'),
        )
        const yearTo = normalizeImportNumber(
          getValue(row, 'yearTo'),
        )

        if (
          yearFrom !== null &&
          yearTo !== null &&
          yearTo < yearFrom
        ) {
          fail(
            `Intervalo de anos inválido: ${yearFrom}–${yearTo}.`,
          )
          return
        }

        // Fornecedores agrupam apresentações por linha:
        // modelos "Q5 / SQ5" ou gerações "G22/G23". Cada
        // parte é uma relação própria — nunca uma string
        // única de geração "falsa".
        const modelParts =
          splitCompatibilityValue(model)
        const generationParts =
          splitCompatibilityValue(
            getValue(row, 'vehicleGeneration').trim(),
          )
        const engine = getValue(
          row,
          'vehicleEngine',
        ).trim()

        for (const modelPart of modelParts) {
          for (const generationPart of generationParts) {
            compatibilities.push({
              make,
              model: modelPart.text,
              generation: generationPart.text,
              engine,
              yearFrom:
                yearFrom !== null
                  ? Math.round(yearFrom)
                  : null,
              yearTo:
                yearTo !== null
                  ? Math.round(yearTo)
                  : null,
            })
          }
        }
      } else if (
        categoryProfile === 'suspension'
      ) {
        fail(
          'Suspensão precisa de marca e modelo de veículo.',
        )
        return
      }
    }

    const images: ProductRowInput['images'] = []
    const generalImage = getValue(
      row,
      'generalImage',
    ).trim()
    const finishImage = getValue(
      row,
      'finishImage',
    ).trim()
    const finish =
      selections.finish ??
      getValue(row, 'finish').trim()

    // URLs de imagem são OPCIONAIS: em branco ignora-se em
    // silêncio; malformado (só se aceita http/https) vira
    // AVISO por linha — nunca falha o import.
    if (generalImage) {
      if (isValidImportImageUrl(generalImage)) {
        images.push({
          url: generalImage,
          finish: null,
        })
      } else {
        warnings.push({
          row: rowNumber,
          message: `URL de imagem geral inválido ("${generalImage}"): só http/https é aceite. Imagem ignorada.`,
        })
      }
    }

    if (finishImage && finish) {
      if (isValidImportImageUrl(finishImage)) {
        images.push({
          url: finishImage,
          finish,
        })
      } else {
        warnings.push({
          row: rowNumber,
          message: `URL de imagem de acabamento inválido ("${finishImage}"): só http/https é aceite. Imagem ignorada.`,
        })
      }
    }

    // Uma imagem de acabamento sem acabamento na linha não tem
    // a que produto+cor se associar: deixar cair em silêncio
    // escondia o problema até a loja mostrar "Imagem em breve".
    // O dry-run avisa o admin em vez de ignorar.
    if (finishImage && !finish) {
      warnings.push({
        row: rowNumber,
        message: `Imagem de acabamento "${finishImage}" ignorada: a linha não indica acabamento (cor) para lhe associar.`,
      })
    }

    const isActive = normalizeImportBoolean(
      getValue(row, 'isActive') || 'true',
    )
    const description = getValue(
      row,
      'description',
    ).trim()
    const productCode =
      getValue(row, 'productCode').trim() ||
      productName.trim()
    const brand = getValue(row, 'brand').trim()
    const category =
      getValue(row, 'category').trim() ||
      'Importados'

    const groupKey =
      toSlug(productCode) ||
      `sem-codigo-${toSlug(productName)}`

    // Identidade da variante:
    // - edição manual do admin tem sempre prioridade;
    // - "auto" gera quando o ficheiro não traz SKU;
    // - "supplier" promove a referência do fornecedor.
    // A referência do fornecedor é SEMPRE guardada à parte.
    const override =
      skuOverrides[rowNumber]?.trim() ?? ''
    const overrideSku = override
      .slice(0, 100)
      .toUpperCase()
    const hasOverride = Boolean(overrideSku)

    let effectiveSku: string
    let skuGenerated: boolean

    if (hasOverride) {
      effectiveSku = overrideSku
      skuGenerated = false
    } else if (skuStrategy === 'auto' && !sku) {
      effectiveSku = generateImportSku({
        productName,
        brand,
        selections,
      })
      skuGenerated = true
    } else if (
      skuStrategy === 'supplier' &&
      supplierSku
    ) {
      effectiveSku = supplierSku
        .toUpperCase()
        .slice(0, 100)
      skuGenerated = false
    } else {
      effectiveSku = sku
      skuGenerated = false
    }

    const variant: ProductRowInput = {
      rowNumber,
      productCode,
      productName,
      brand,
      category,
      description,
      sku: effectiveSku,
      supplierSku,
      skuGenerated,
      price,
      priceSet,
      stock,
      isActive,
      selections,
      images,
      compatibilities,
      specifications,
    }

    const group = groups.get(groupKey)

    if (group) {
      if (
        group.brand &&
        brand &&
        group.brand !== brand
      ) {
        warnings.push({
          row: rowNumber,
          message: `Produto "${productName}" aparece com fabricantes diferentes (${group.brand} / ${brand}); usado ${group.brand}.`,
        })
      }

      group.variants.push(variant)
      group.images.push(...images)
      group.compatibilities.push(
        ...compatibilities,
      )
    } else {
      groups.set(groupKey, {
        groupKey,
        productCode,
        productName,
        brand,
        category,
        description,
        variants: [variant],
        images: [...images],
        compatibilities: [...compatibilities],
      })
    }
  })

  return {
    products: [...groups.values()],
    errors,
    warnings,
    totalRows: rows.length,
  }
}

/**
 * Campos NOT NULL do modelo ProductVariant que o importador TEM
 * de produzir para cada linha (sku, price, stockQuantity,
 * isActive, productId e a chave interna optionKey derivada de
 * produto+SKU). Espelha a barreira de produção do serviço de
 * commit, mas corre no dry-run: qualquer campo impossível de
 * produzir aparece na validação como erro por linha, ANTES de
 * chegar ao Prisma.
 */
export function collectVariantProductionIssues(
  variant: ProductRowInput,
): string[] {
  const missing: string[] = []

  if (!variant.sku) {
    missing.push('sku')
  }

  if (
    typeof variant.price !== 'number' ||
    !Number.isFinite(variant.price)
  ) {
    missing.push('price')
  }

  if (
    !Number.isInteger(variant.stock) ||
    variant.stock < 0
  ) {
    missing.push('stockQuantity')
  }

  if (typeof variant.isActive !== 'boolean') {
    missing.push('isActive')
  }

  if (!variant.productCode) {
    missing.push('productId (código do produto)')
  }

  // optionKey é derivado de productCode + SKU final; se nenhum
  // dos dois produzir slug, a chave interna sairia vazia.
  if (
    !`${toSlug(variant.productCode)}${toSlug(variant.sku)}`.trim()
  ) {
    missing.push('optionKey')
  }

  return missing
}

/**
 * Constrói a pré-visualização (dry-run): status create/update por
 * produto (código conhecido) e por variante (SKU conhecido),
 * duplicados de SKU e de combinação dentro do ficheiro, e erros/
 * avisos acumulados. Não escreve nada na base de dados.
 */
export function buildImportPreview({
  parsed,
  profile,
  mode,
  existingProductCodes,
  dbVariantsBySku,
  dbVariantsBySupplierSku,
  skuStrategy = 'auto',
}: {
  parsed: Awaited<
    ReturnType<typeof buildRowInputs>
  >
  profile: ImportProfile
  mode: ImportMode
  existingProductCodes: Set<string>
  /**
   * Identidade das variantes já na BD por SKU — permite decidir
   * se um SKU existente é A MESMA variante (update) ou uma
   * COLISÃO real (outro produto/especificações).
   */
  dbVariantsBySku: Map<
    string,
    DbVariantIdentity
  >
  /** O mesmo, indexado por referência do fornecedor. */
  dbVariantsBySupplierSku: Map<
    string,
    DbVariantIdentity
  >
  skuStrategy?: SkuStrategy
}): ImportPreview {
  const errors: ImportRowError[] = [
    ...parsed.errors,
  ]
  const warnings = [...parsed.warnings]

  const previewProducts: ImportPreviewProduct[] = []
  const fileSkuOwners = new Map<
    string,
    { row: number; product: string }
  >()
  const fileCombinationOwners = new Map<
    string,
    { row: number; sku: string }
  >()

  let productsToCreate = 0
  let productsToUpdate = 0
  let variantsToCreate = 0
  let variantsToUpdate = 0
  let generatedSkus = 0
  let matchedSkus = 0
  let collisions = 0
  let imagesToCreate = 0

  const sameVariant = (
    match: DbVariantIdentity,
    productCode: string,
    combinationKey: string,
  ) =>
    match.productCode === productCode &&
    match.combinationKey === combinationKey

  for (const group of parsed.products) {
    const productStatus =
      existingProductCodes.has(
        group.productCode,
      ) && mode === 'create-update'
        ? 'update'
        : 'create'

    if (productStatus === 'create') {
      productsToCreate += 1
    } else {
      productsToUpdate += 1
    }

    const variants: ImportPreviewVariant[] = []

    for (const variant of group.variants) {
      // Porta de produção: os campos NOT NULL de ProductVariant
      // têm de ser produzíveis ANTES do commit. Um campo em
      // falta aparece aqui como erro por linha — em vez de um
      // erro críptico do Prisma a meio da transação.
      const productionIssues =
        collectVariantProductionIssues(variant)

      for (const issue of productionIssues) {
        errors.push({
          row: variant.rowNumber,
          sku: variant.sku,
          message: `Campo obrigatório '${issue}' não foi produzido pelo importador.`,
        })
      }

      const combinationKey =
        buildVariantCombinationKey(
          variant.selections,
        )

      // 1) Matching de identidade ANTES de mais nada:
      //    - mesmo SKU interno + mesma variante → update;
      //    - mesmo supplierSku + mesma variante → update,
      //      adotando o SKU interno existente (o SKU interno
      //      é estável: nunca se regenera numa reimportação);
      //    - SKU interno ocupado por OUTRA variante → colisão
      //      real, resolve com sufixo determinístico único.
      let effectiveSku = variant.sku
      let status: 'create' | 'update' = 'create'
      let collision = false

      const directMatch = dbVariantsBySku.get(
        effectiveSku,
      )

      if (
        directMatch &&
        sameVariant(
          directMatch,
          group.productCode,
          combinationKey,
        )
      ) {
        status = 'update'
        effectiveSku = directMatch.sku
      } else {
        const supplierMatch = variant.supplierSku
          ? dbVariantsBySupplierSku.get(
              variant.supplierSku,
            )
          : undefined

        if (
          supplierMatch &&
          sameVariant(
            supplierMatch,
            group.productCode,
            combinationKey,
          )
        ) {
          // Mesma variante, identificada pela referência do
          // fornecedor: atualiza a variante existente.
          status = 'update'
          effectiveSku = supplierMatch.sku
        } else if (directMatch) {
          const suffix = collisionSuffix(
            effectiveSku,
            `${group.groupKey}\u0000${combinationKey}`,
          )

          effectiveSku = appendSkuSuffix(
            effectiveSku,
            suffix,
          )
          collision = true
        }
      }

      // 2) SKU duplicado no próprio ficheiro.
      const skuOwner = fileSkuOwners.get(
        effectiveSku,
      )

      if (skuOwner) {
        errors.push({
          row: variant.rowNumber,
          sku: effectiveSku,
          message: `SKU duplicado no ficheiro (linha ${skuOwner.row}, produto ${skuOwner.product}).`,
        })
      } else {
        fileSkuOwners.set(effectiveSku, {
          row: variant.rowNumber,
          product: group.productName,
        })
      }

      // 3) Combinação duplicada no próprio ficheiro
      //    (mesmo grupo de especificações, mesmo produto).
      const combinationKeyWithProduct = `${group.groupKey}|${combinationKey}`
      const combinationOwner =
        fileCombinationOwners.get(
          combinationKeyWithProduct,
        )

      if (combinationOwner) {
        errors.push({
          row: variant.rowNumber,
          sku: effectiveSku,
          message: `Combinação de especificações repete a linha ${combinationOwner.row} (SKU ${combinationOwner.sku}).`,
        })
      } else {
        fileCombinationOwners.set(
          combinationKeyWithProduct,
          {
            row: variant.rowNumber,
            sku: effectiveSku,
          },
        )
      }

      // 4) Contagem final por estado resolvido.
      if (status === 'update') {
        if (mode === 'create-only') {
          errors.push({
            row: variant.rowNumber,
            sku: effectiveSku,
            message:
              'SKU já existe e o modo é "criar apenas".',
          })
        } else {
          variantsToUpdate += 1
          matchedSkus += 1
        }
      } else {
        variantsToCreate += 1

        if (collision) {
          collisions += 1
          warnings.push({
            row: variant.rowNumber,
            message: `SKU ${variant.sku} já pertence a outra variante; será criado como ${effectiveSku}.`,
          })
        }
      }

      if (variant.skuGenerated) {
        generatedSkus += 1
      }

      variants.push({
        rowNumber: variant.rowNumber,
        sku: effectiveSku,
        skuGenerated: variant.skuGenerated,
        supplierSku: variant.supplierSku,
        status,
        collision,
        price: variant.price,
        stock: variant.stock,
        selections: variant.selections,
      })
    }

    // Contagem de imagens: dedupe em memória por
    // finish+URL — é o que o serviço também fará no
    // commit (mais o dedupe contra a BD).
    imagesToCreate += dedupeImages(
      group.images,
    ).length

    previewProducts.push({
      groupKey: group.groupKey,
      name: group.productName,
      brand: group.brand,
      category: group.category,
      status: productStatus,
      variants,
      images: dedupeImages(group.images),
    })
  }

  return {
    profile,
    mode,
    skuStrategy,
    productsToCreate,
    productsToUpdate,
    variantsToCreate,
    variantsToUpdate,
    generatedSkus,
    matchedSkus,
    collisions,
    imagesToCreate,
    products: previewProducts,
    errors,
    warnings,
    totalRows: parsed.totalRows,
  }
}

function dedupeImages(
  images: Array<{
    url: string
    finish: string | null
  }>,
) {
  const seen = new Set<string>()
  const result: Array<{
    url: string
    finish: string | null
  }> = []

  for (const image of images) {
    // Mesma normalização do commit (lib partilhada):
    // "Gloss Black" e "glossyblack" colapsam na dedupe.
    const key = importImageDedupeKey(
      image.finish,
      image.url,
    )

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(image)
  }

  return result
}

/** URL http(s) bem formado (sem descarregar nada). */
function isValidImportImageUrl(value: string) {
  try {
    const parsed = new URL(value)

    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:'
    )
  } catch {
    return false
  }
}
