'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import Price from '@/components/storefront/price'
import StockBadge from '@/components/storefront/stock-badge'
import type {
  CatalogProductDetail,
  CatalogVariant,
} from '@/server/catalog'
import AddToCartButton from './add-to-cart-button'
import {
  useProductFinishSelection,
} from './product-image-selection'

type VariantOptionGroupValue = {
  value: string
  inStock: boolean
  selectable: boolean
}

type VariantOptionGroup = {
  code: string
  name: string
  values: VariantOptionGroupValue[]
}

type ProductPurchasePanelProps = {
  product: CatalogProductDetail
}

/**
 * Ordem dos seletores de jante na ficha de produto.
 * O furo central (centre_bore) é propositamente excluído: é
 * informação técnica da variante resolvida, não uma escolha do
 * cliente — quem compra uma jante escolhe diâmetro, furação,
 * largura, ET e cor.
 */
const WHEEL_SELECTOR_CODES = [
  'diameter',
  'pcd',
  'width',
  'offset',
  'finish',
] as const

const WHEEL_LABELS: Record<string, string> = {
  diameter: 'Diâmetro',
  pcd: 'Furação',
  width: 'Largura',
  offset: 'Offset (ET)',
  finish: 'Cor',
  centre_bore: 'Furo central',
}

/**
 * Prioridade de remoção quando uma escolha torna a seleção atual
 * impossível: os eixos "de gosto" (cor, ET) cedem primeiro; os eixos
 * estruturais de encaixe (diâmetro, furação) aguentam o máximo
 * possível.
 */
const WHEEL_DROP_PRIORITY = [
  'finish',
  'offset',
  'width',
  'pcd',
  'diameter',
] as const

function matchesSelection(
  variant: CatalogVariant,
  selection: Record<string, string>,
) {
  return Object.entries(selection).every(
    ([code, value]) =>
      variant.options.some(
        (option) =>
          option.code === code &&
          option.value === value,
      ),
  )
}

/**
 * Eixos com um único valor em todo o produto (ex.: uma jante vendida
 * só com 5x120). Não são escolha do cliente: entram na seleção como
 * contexto imutável e são mostrados como especificação técnica.
 */
function getConstantValueByCode(
  variants: CatalogVariant[],
): Record<string, string> {
  const valuesByCode: Record<
    string,
    string[]
  > = {}

  for (const variant of variants) {
    for (const option of variant.options) {
      const values =
        valuesByCode[option.code] ?? []

      if (!values.includes(option.value)) {
        values.push(option.value)
      }

      valuesByCode[option.code] = values
    }
  }

  const constants: Record<string, string> = {}

  for (const [
    code,
    values,
  ] of Object.entries(valuesByCode)) {
    if (values.length === 1) {
      constants[code] = values[0]
    }
  }

  return constants
}

/**
 * Valores reais disponíveis num eixo, dados os eixos ESCOLHIDOS PELO
 * CLIENTE que restringem a escolha. É a base dos seletores em cascata:
 * cada dropdown lista apenas valores que existem em variantes
 * compatíveis com as escolhas explícitas atuais — valores preenchidos
 * automaticamente (da variante inicial ou de reancoragens antigas) não
 * restringem nada, senão o cliente nunca conseguiria explorar.
 */
export function getWheelOptionValues(
  variants: CatalogVariant[],
  code: string,
  selection: Record<string, string>,
  chosenCodes: string[] = [],
): string[] {
  const chosen = new Set(chosenCodes)
  const others = Object.entries(
    selection,
  ).filter(
    ([entryCode]) =>
      entryCode !== code && chosen.has(entryCode),
  )

  const values: string[] = []

  for (const variant of variants) {
    if (
      !others.every(([entryCode, value]) =>
        variant.options.some(
          (option) =>
            option.code === entryCode &&
            option.value === value,
        ),
      )
    ) {
      continue
    }

    const value = variant.options.find(
      (option) => option.code === code,
    )?.value

    if (value && !values.includes(value)) {
      values.push(value)
    }
  }

  return values
}

/**
 * Limpa valores preenchidos automaticamente que deixaram de ser
 * compatíveis com as escolhas explícitas do cliente. É o
 * comportamento pedido: mudar a largura para 9.5J limpa o ET30
 * inválido e mostra "Selecione uma opção", em vez de o manter
 * escondido ou saltar para outro valor. Escolhas explícitas nunca
 * são limpas aqui.
 */
function pruneIncompatibleAutomaticAxes(
  variants: CatalogVariant[],
  selection: Record<string, string>,
  changedCode: string,
  chosenCodes: string[],
): Record<string, string> {
  const chosen = new Set(chosenCodes)
  const constantCodes = new Set(
    Object.keys(
      getConstantValueByCode(variants),
    ),
  )
  const pruned = { ...selection }

  for (const [code, value] of Object.entries(
    selection,
  )) {
    if (
      code === changedCode ||
      chosen.has(code) ||
      constantCodes.has(code)
    ) {
      continue
    }

    const compatible = getWheelOptionValues(
      variants,
      code,
      pruned,
      chosenCodes,
    )

    if (!compatible.includes(value)) {
      delete pruned[code]
    }
  }

  return pruned
}

/**
 * Reconcilia a seleção depois de o cliente mudar um eixo. Regras:
 * 1. A escolha nova fica sempre (o cliente mandou).
 * 2. Valores preenchidos automaticamente (nunca escolhidos) são
 *    limpos quando incompatíveis — aparecem como
 *    "Selecione uma opção" em vez de saltarem para outro valor.
 * 3. Escolhas explícitas do cliente só cedem quando bloqueiam toda a
 *    seleção, e cedem primeiro os eixos de gosto (cor, ET), nunca
 *    silenciosamente trocados por outro valor.
 * 4. Se mesmo assim não existir nenhuma variante compatível, parte-se
 *    da escolha nova: o cliente nunca fica preso a um beco sem saída.
 */
export function reconcileSelection(
  variants: CatalogVariant[],
  nextSelection: Record<string, string>,
  changedCode: string,
  chosenCodes: string[] = [],
): Record<string, string> {
  const chosen = new Set(chosenCodes)
  const constantCodes = new Set(
    Object.keys(
      getConstantValueByCode(variants),
    ),
  )
  const kept = { ...nextSelection }

  // Eixos removíveis: primeiro os preenchidos automaticamente
  // (nunca escolhidos), depois as escolhas explícitas por ordem de
  // prioridade (cor e ET cedem antes do encaixe). Eixos constantes
  // são contexto imutável e nunca são removidos.
  const removable = [
    ...Object.keys(kept).filter(
      (code) =>
        code !== changedCode &&
        !chosen.has(code) &&
        !constantCodes.has(code),
    ),
    ...WHEEL_DROP_PRIORITY.filter(
      (code) =>
        code !== changedCode &&
        chosen.has(code) &&
        kept[code] !== undefined,
    ),
  ]

  // A seleção pode já ser compatível: limpar qualquer coisa a mais
  // seria desnecessário e confuso.
  if (
    variants.some((variant) =>
      matchesSelection(variant, kept),
    )
  ) {
    return pruneIncompatibleAutomaticAxes(
      variants,
      kept,
      changedCode,
      chosenCodes,
    )
  }

  // Procura o MENOR conjunto de eixos a limpar que torna a seleção
  // possível de novo. Com eixos ordenados (automáticos primeiro),
  // combinações de tamanho crescente preferem sempre limpar valores
  // automáticos antes das escolhas do cliente.
  for (let size = 1; size <= removable.length; size += 1) {
    for (const drop of combinations(
      removable,
      size,
    )) {
      const candidate = { ...kept }

      for (const code of drop) {
        delete candidate[code]
      }

      if (
        variants.some((variant) =>
          matchesSelection(variant, candidate),
        )
      ) {
        return pruneIncompatibleAutomaticAxes(
          variants,
          candidate,
          changedCode,
          chosenCodes,
        )
      }
    }
  }

  // Nenhuma remoção resolve: recomeça só com a escolha nova
  // em vez de manter um estado impossível.
  return {
    [changedCode]: nextSelection[changedCode],
  }
}

/** Gera todas as combinações de `size` elementos na ordem dada. */
function combinations(
  items: string[],
  size: number,
): string[][] {
  const result: string[][] = []

  const build = (
    start: number,
    current: string[],
  ) => {
    if (current.length === size) {
      result.push([...current])
      return
    }

    for (
      let index = start;
      index < items.length;
      index += 1
    ) {
      current.push(items[index])
      build(index + 1, current)
      current.pop()
    }
  }

  build(0, [])

  return result
}

function buildOptionGroups(
  variants: CatalogVariant[],
): VariantOptionGroup[] {
  const groups: VariantOptionGroup[] = []

  const groupByCode = new Map<
    string,
    VariantOptionGroup
  >()

  const valuesByCode = new Map<
    string,
    Map<string, VariantOptionGroupValue>
  >()

  for (const variant of variants) {
    for (const option of variant.options) {
      let group =
        groupByCode.get(option.code)

      if (!group) {
        group = {
          code: option.code,
          name: option.name,
          values: [],
        }

        groupByCode.set(
          option.code,
          group,
        )

        groups.push(group)

        valuesByCode.set(
          option.code,
          new Map(),
        )
      }

      const values =
        valuesByCode.get(option.code)

      if (!values || values.has(option.value)) {
        continue
      }

      const value = {
        value: option.value,
        inStock: variant.inStock,
        selectable: true,
      }

      values.set(option.value, value)

      group.values.push(value)
    }
  }

  return groups
}

/**
 * Marca como não selecionáveis os valores que, com a
 * seleção atual dos eixos escolhidos pelo utilizador,
 * não correspondem a nenhuma variante real (ex.: 19"
 * nunca existiu com 5x100).
 *
 * Só os eixos realmente escolhidos pelo utilizador
 * restringem os restantes: os valores reancorados
 * automaticamente não podem bloquear a escolha de
 * outro valor do mesmo eixo (senão nunca seria possível
 * trocar, por exemplo, o diâmetro).
 */
function applySelectionConstraints(
  groups: VariantOptionGroup[],
  variants: CatalogVariant[],
  selection: Record<string, string>,
  chosenCodes: string[],
): VariantOptionGroup[] {
  return groups.map((group) => {
    const otherSelection = chosenCodes
      .filter((code) => code !== group.code)
      .map((code) => ({
        code,
        value: selection[code],
      }))
      .filter(
        (item) => item.value !== '',
      )

    const values = group.values.map(
      (optionValue) => {
        // A própria seleção atual do eixo mantém-se
        // selecionável (é o valor escolhido).
        if (
          selection[group.code] ===
          optionValue.value
        ) {
          return optionValue
        }

        const existsMatchingVariant =
          variants.some(
            (variant) =>
              optionValue.value ===
                variant.options.find(
                  (option) =>
                    option.code ===
                    group.code,
                )?.value &&
              otherSelection.every(
                (selected) =>
                  variant.options.some(
                    (option) =>
                      option.code ===
                        selected.code &&
                      option.value ===
                        selected.value,
                  ),
              ),
          )

        if (!existsMatchingVariant) {
          return {
            ...optionValue,
            selectable: false,
          }
        }

        const existsInStock = variants.some(
          (variant) =>
            variant.inStock &&
            optionValue.value ===
              variant.options.find(
                (option) =>
                  option.code === group.code,
              )?.value &&
            otherSelection.every(
              (selected) =>
                variant.options.some(
                  (option) =>
                    option.code ===
                      selected.code &&
                    option.value ===
                      selected.value,
                ),
          ),
        )

        return {
          ...optionValue,
          inStock: existsInStock,
        }
      },
    )

    return { ...group, values }
  })
}

function buildSelectionMap(
  variants: CatalogVariant[],
): Record<string, string[]> {
  const selection: Record<string, string[]> = {}

  for (const variant of variants) {
    for (const option of variant.options) {
      const values =
        selection[option.code] ?? []

      if (!values.includes(option.value)) {
        values.push(option.value)
      }

      selection[option.code] = values
    }
  }

  return selection
}

function findSelectedVariant(
  variants: CatalogVariant[],
  selection: Record<string, string>,
): CatalogVariant | undefined {
  const selectedCodes = Object.entries(
    selection,
  )
    .filter(([, value]) => value !== '')
    .map(([code]) => code)

  if (selectedCodes.length === 0) {
    return undefined
  }

  return variants.find(
    (variant) =>
      selectedCodes.every((code) =>
        variant.options.some(
          (option) =>
            option.code === code &&
            option.value === selection[code],
        ),
      ) &&
      variant.options.every((option) =>
        selectedCodes.includes(option.code),
      ),
  )
}

function createInitialSelection(
  variants: CatalogVariant[],
  defaultFinish?: string | null,
): Record<string, string> {
  const normalizedDefaultFinish =
    defaultFinish?.trim()

  const initialVariant =
    (normalizedDefaultFinish
      ? variants.find(
          (variant) =>
            variant.inStock &&
            variant.options.some(
              (option) =>
                option.code === 'finish' &&
                option.value.toLocaleLowerCase(
                  'pt-PT',
                ) ===
                  normalizedDefaultFinish.toLocaleLowerCase(
                    'pt-PT',
                  ),
            ),
        )
      : undefined) ??
    variants.find((variant) => variant.inStock) ??
    variants[0]

  const selection: Record<string, string> = {}

  for (const option of
    initialVariant?.options ?? []) {
    selection[option.code] = option.value
  }

  return selection
}

/**
 * Preço "Desde": o mínimo real do catálogo desta
 * variante é o preço da variante ativa mais barata, não
 * o preço de catálogo do produto, que pode ser um valor
 * genérico desatualizado.
 */
function getFromPrice(
  product: CatalogProductDetail,
  variants: CatalogVariant[],
): number {
  const variantPrices = variants
    .filter((variant) => variant.inStock)
    .map((variant) => variant.price)

  if (variantPrices.length === 0) {
    // Sem variantes ativas: usa o mínimo geral das
    // variantes ou, na falta delas, o preço do produto.
    const anyVariantPrice = variants.map(
      (variant) => variant.price,
    )

    return anyVariantPrice.length > 0
      ? Math.min(...anyVariantPrice)
      : product.price
  }

  return Math.min(...variantPrices)
}

/**
 * Encontra a variante real a usar quando a combinação
 * exata do utilizador não existe. Mantém todos os eixos
 * já escolhidos que continuam válidos com o novo valor
 * (ex.: mudar o acabamento preserva diâmetro/largura/
 * PCD/ET sempre que exista variante com tudo) e só
 * reancora os restantes na variante anfitriã.
 *
 * Usado apenas pelos produtos não-jante (botões); em
 * jantes o modelo é de seleção parcial com dropdowns.
 */
function findFallbackVariant(
  variants: CatalogVariant[],
  nextSelection: Record<string, string>,
  changedCode: string,
  changedValue: string,
): CatalogVariant | undefined {
  const wanted = Object.entries({
    ...nextSelection,
    [changedCode]: changedValue,
  }).filter(([, value]) => value !== '')

  const matchesWanted = (
    variant: CatalogVariant,
    entries: Array<[string, string]>,
  ) =>
    entries.every(([code, value]) =>
      variant.options.some(
        (option) =>
          option.code === code &&
          option.value === value,
      ),
    )

  // 1. Todas as escolhas continuam possíveis.
  const inStockFullMatch = variants.find(
    (variant) =>
      variant.inStock && matchesWanted(variant, wanted),
  )
  if (inStockFullMatch) {
    return inStockFullMatch
  }

  const fullMatch = variants.find((variant) =>
    matchesWanted(variant, wanted),
  )
  if (fullMatch) {
    return fullMatch
  }

  // 2. Preserva os eixos escolhidos anteriormente e
  // reancora apenas os que colidem com a nova escolha.
  const previousEntries = wanted.filter(
    ([code]) =>
      code !== changedCode &&
      nextSelection[code] !== undefined &&
      nextSelection[code] !== '',
  )

  const inStockKeepPrevious = variants.find(
    (variant) =>
      variant.inStock &&
      variant.options.some(
        (option) =>
          option.code === changedCode &&
          option.value === changedValue,
      ) &&
      matchesWanted(variant, previousEntries),
  )
  if (inStockKeepPrevious) {
    return inStockKeepPrevious
  }

  const keepPrevious = variants.find(
    (variant) =>
      variant.options.some(
        (option) =>
          option.code === changedCode &&
          option.value === changedValue,
      ) && matchesWanted(variant, previousEntries),
  )
  if (keepPrevious) {
    return keepPrevious
  }

  // 3. Último recurso: qualquer variante real com o
  // valor escolhido, dando prioridade ao stock.
  return (
    variants.find(
      (variant) =>
        variant.inStock &&
        variant.options.some(
          (option) =>
            option.code === changedCode &&
            option.value === changedValue,
        ),
    ) ??
    variants.find((variant) =>
      variant.options.some(
        (option) =>
          option.code === changedCode &&
          option.value === changedValue,
      ),
    )
  )
}

export default function ProductPurchasePanel({
  product,
}: ProductPurchasePanelProps) {
  const variants = useMemo(
    () =>
      product.variants.filter(
        (variant) => variant.options.length > 0,
      ),
    [product.variants],
  )

  const baseOptionGroups = useMemo(
    () => buildOptionGroups(variants),
    [variants],
  )

  const fromPrice = useMemo(
    () => getFromPrice(product, variants),
    [product, variants],
  )

  const [selection, setSelection] =
    useState(() =>
      createInitialSelection(
        variants,
        product.defaultFinish,
      ),
    )
  const setSelectedFinish =
    useProductFinishSelection()

  useEffect(() => {
    setSelectedFinish(
      selection.finish || null,
    )
  }, [
    selection.finish,
    setSelectedFinish,
  ])

  // Eixos escolhidos explicitamente pelo utilizador. Em jantes
  // determinam que valores restringem os outros dropdowns; valores
  // apenas preenchidos automaticamente nunca restringem.
  const [chosenCodes, setChosenCodes] =
    useState<string[]>([])

  /**
   * Eixos de jante presentes nas variantes reais deste
   * produto. A presença de qualquer um ativa o modelo de
   * dropdowns em cascata; produtos sem eixos de jante
   * (suspensão, exterior, genéricos) mantêm os botões.
   */
  const wheelSelectorAxes = useMemo(() => {
    const presentCodes = new Set<string>()

    for (const variant of variants) {
      for (const option of variant.options) {
        presentCodes.add(option.code)
      }
    }

    return WHEEL_SELECTOR_CODES.filter((code) =>
      presentCodes.has(code),
    )
  }, [variants])

  const isWheelSelector =
    wheelSelectorAxes.length > 0

  const optionGroups = useMemo(
    () =>
      applySelectionConstraints(
        baseOptionGroups,
        variants,
        selection,
        chosenCodes,
      ),
    [
      baseOptionGroups,
      variants,
      selection,
      chosenCodes,
    ],
  )

  const optionCodes = useMemo(
    () => Object.keys(buildSelectionMap(variants)),
    [variants],
  )

  const requiredCodes = isWheelSelector
    ? wheelSelectorAxes
    : optionCodes

  const selectionIsComplete =
    requiredCodes.every(
      (code) =>
        selection[code] !== undefined &&
        selection[code] !== '',
    )

  const selectedVariant =
    selectionIsComplete
      ? findSelectedVariant(
          variants,
          selection,
        )
      : undefined

  const hasMultipleVariants =
    variants.length > 1

  // Só existe "combinação inválida" quando há variantes
  // com opções; produtos sem variantes usam o estado do
  // próprio produto.
  const isInvalidCombination =
    !isWheelSelector &&
    hasMultipleVariants &&
    selectionIsComplete &&
    selectedVariant === undefined

  const price =
    selectedVariant?.price ??
    product.price

  const inStock = isInvalidCombination
    ? false
    : selectedVariant
      ? selectedVariant.inStock
      : product.inStock

  const sku =
    selectedVariant?.sku ?? product.sku

  // Em produtos com variantes, só se adiciona quando uma
  // variante comprável foi resolvida; em produtos sem
  // variantes, o estado do produto decide.
  const canAddToCart =
    !isInvalidCombination &&
    selectionIsComplete &&
    inStock

  /**
   * Dropdowns em cascata: cada eixo lista os valores compatíveis com
   * as escolhas explícitas dos outros eixos. Para o cliente nunca
   * ficar preso, um dropdown cuja lista compatível se reduce ao valor
   * já escolhido (ou fica vazio) é expandido para todos os valores do
   * produto: escolher um valor em conflito limpa o eixo que bloqueia,
   * em vez de bloquear a navegação.
   */
  const wheelValuesByCode = useMemo(() => {
    const valuesByCode: Record<
      string,
      string[]
    > = {}

    for (const code of wheelSelectorAxes) {
      const compatible = getWheelOptionValues(
        variants,
        code,
        selection,
        chosenCodes,
      )
      const all = getWheelOptionValues(
        variants,
        code,
        {},
      )
      const current = selection[code]

      const isCollapsed =
        compatible.length === 0 ||
        (compatible.length === 1 &&
          current !== undefined &&
          compatible[0] === current)

      let values = isCollapsed ? all : compatible

      // A escolha explícita do cliente aparece sempre na lista,
      // mesmo quando conflitua com a seleção atual: assim vê o que
      // escolheu e pode navegar a partir daí.
      if (
        current &&
        !values.includes(current)
      ) {
        values = [...values, current]
      }

      valuesByCode[code] = values
    }

    return valuesByCode
  }, [
    variants,
    wheelSelectorAxes,
    selection,
    chosenCodes,
  ])

  const totalWheelValuesByCode = useMemo(() => {
    const valuesByCode: Record<
      string,
      string[]
    > = {}

    for (const code of wheelSelectorAxes) {
      valuesByCode[code] =
        getWheelOptionValues(
          variants,
          code,
          {},
        )
    }

    return valuesByCode
  }, [variants, wheelSelectorAxes])

  const singleValueAxes = wheelSelectorAxes.filter(
    (code) =>
      totalWheelValuesByCode[code].length === 1,
  )

  const dropdownAxes = wheelSelectorAxes.filter(
    (code) =>
      totalWheelValuesByCode[code].length > 1,
  )

  /**
   * Furo central: informação técnica da configuração
   * resolvida. Com a seleção completa é o CB da variante;
   * com seleção parcial mostra o CB quando é único entre
   * as variantes compatíveis e "—" quando ambíguo.
   */
  const matchingVariants = useMemo(
    () =>
      variants.filter((variant) =>
        matchesSelection(variant, selection),
      ),
    [variants, selection],
  )

  const centreBoreValues = useMemo(() => {
    const values: string[] = []

    for (const variant of matchingVariants) {
      const value = variant.options.find(
        (option) =>
          option.code === 'centre_bore',
      )?.value

      if (value && !values.includes(value)) {
        values.push(value)
      }
    }

    return values
  }, [matchingVariants])

  const centreBoreDisplay =
    centreBoreValues.length === 1
      ? centreBoreValues[0]
      : '—'

  const showTechnicalSpecs =
    isWheelSelector &&
    hasMultipleVariants &&
    (singleValueAxes.length > 0 ||
      centreBoreValues.length > 0)

  function selectOption(
    code: string,
    value: string,
  ) {
    if (isWheelSelector) {
      if (!value) {
        // O cliente limpou o seletor
        // voluntariamente: deixa de restringir
        // os outros dropdowns.
        setChosenCodes((currentCodes) =>
          currentCodes.filter(
            (itemCode) => itemCode !== code,
          ),
        )
        setSelection(
          (currentSelection) => {
            const nextSelection = {
              ...currentSelection,
            }
            delete nextSelection[code]
            return nextSelection
          },
        )
        return
      }

      // Calculado fora do updater: o updater corre depois e o valor
      // de chosenCodes no closure estaria desatualizado.
      const nextChosen = chosenCodes.includes(code)
        ? chosenCodes
        : [...chosenCodes, code]

      setChosenCodes(nextChosen)

      setSelection(
        (currentSelection) =>
          reconcileSelection(
            variants,
            {
              ...currentSelection,
              [code]: value,
            },
            code,
            nextChosen,
          ),
      )
      return
    }

    setChosenCodes((currentCodes) =>
      currentCodes.includes(code)
        ? currentCodes
        : [...currentCodes, code],
    )

    setSelection(
      (currentSelection) => {
        const nextSelection = {
          ...currentSelection,
          [code]: value,
        }

        // A combinação exata existe: a seleção fica
        // como o utilizador escolheu.
        const resolved = findSelectedVariant(
          variants,
          nextSelection,
        )

        if (resolved) {
          return nextSelection
        }

        // Combinação inexistente (ex.: 19" + 5x100):
        // reancora apenas os eixos necessários na
        // variante real que tem o valor escolhido,
        // preservando o resto da escolha do utilizador.
        const fallback = findFallbackVariant(
          variants,
          nextSelection,
          code,
          value,
        )

        if (fallback) {
          return createSelectionFromVariant(
            fallback,
          )
        }

        return currentSelection
      },
    )
  }

  return (
    <div>
      {hasMultipleVariants &&
        isWheelSelector && (
          <div className="grid gap-4">
            {dropdownAxes.map((code) => {
              const value =
                selection[code] ?? ''

              return (
                <label
                  key={code}
                  className="grid gap-1.5"
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
                    {
                      WHEEL_LABELS[
                        code
                      ]
                    }
                  </span>

                  <select
                    aria-label={
                      WHEEL_LABELS[
                        code
                      ]
                    }
                    value={value}
                    onChange={(event) =>
                      selectOption(
                        code,
                        event.target.value,
                      )
                    }
                    className="min-h-11 rounded-sm border border-gray-300 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition focus:border-brand"
                  >
                    <option value="">
                      Selecione uma opção
                    </option>
                    {wheelValuesByCode[
                      code
                    ].map((optionValue) => (
                      <option
                        key={
                          optionValue
                        }
                        value={
                          optionValue
                        }
                      >
                        {
                          optionValue
                        }
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        )}

      {showTechnicalSpecs && (
        <dl className="mt-5 grid gap-2 border-t border-gray-200 pt-4 text-xs sm:grid-cols-2">
          {singleValueAxes.map((code) => (
            <div
              key={code}
              className="flex gap-2"
            >
              <dt className="uppercase tracking-[0.06em] text-gray-500">
                {WHEEL_LABELS[code]}
              </dt>
              <dd className="font-bold text-gray-800">
                {
                  totalWheelValuesByCode[
                    code
                  ][0]
                }
              </dd>
            </div>
          ))}

          {centreBoreValues.length > 0 && (
            <div className="flex gap-2">
              <dt className="uppercase tracking-[0.06em] text-gray-500">
                {
                  WHEEL_LABELS.centre_bore
                }
              </dt>
              <dd className="font-bold text-gray-800">
                {
                  centreBoreDisplay
                }
              </dd>
            </div>
          )}
        </dl>
      )}

      {hasMultipleVariants &&
        !isWheelSelector && (
          <div className="grid gap-5">
            {optionGroups.map(
              (group) => (
                <fieldset
                  key={group.code}
                  className="border-0 p-0"
                >
                  <legend className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
                    {group.name}
                  </legend>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.values.map(
                      (optionValue) => {
                        const isSelected =
                          selection[
                            group.code
                          ] ===
                          optionValue.value

                        return (
                          <button
                            key={
                              optionValue.value
                            }
                            type="button"
                            aria-pressed={
                              isSelected
                            }
                            disabled={
                              !optionValue.selectable
                            }
                            onClick={() =>
                              selectOption(
                                group.code,
                                optionValue.value,
                              )
                            }
                            title={
                              !optionValue.selectable
                                ? 'Combinação indisponível'
                                : optionValue.inStock
                                  ? undefined
                                  : 'Sem stock'
                            }
                            className={`min-h-9 rounded-sm border px-3 text-xs font-bold transition ${
                              isSelected
                                ? 'border-brand bg-brand text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900'
                            } ${
                              !optionValue.selectable
                                ? 'cursor-not-allowed text-gray-300 line-through opacity-50'
                                : optionValue.inStock
                                  ? ''
                                  : 'text-gray-400 line-through opacity-60'
                            }`}
                          >
                            {
                              optionValue.value
                            }
                          </button>
                        )
                      },
                    )}
                  </div>
                </fieldset>
              ),
            )}
          </div>
        )}

      <div
        className={
          hasMultipleVariants
            ? 'mt-6 border-t border-gray-200 pt-5'
            : ''
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          {hasMultipleVariants &&
            price !== fromPrice &&
            selectedVariant && (
              <span className="text-xs font-semibold text-gray-500">
                Desde{' '}
                <Price
                  value={fromPrice}
                  className="font-bold"
                />
              </span>
            )}

          <Price
            value={price}
            className="text-3xl font-black tracking-[-0.035em] text-brand sm:text-[2rem]"
          />

          {isWheelSelector && (
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-500">
              €/jante
            </span>
          )}

          {(selectionIsComplete ||
            !hasMultipleVariants) && (
            <StockBadge inStock={inStock} />
          )}
        </div>

        {isWheelSelector &&
          selection.finish && (
            <p className="mt-3 text-xs font-semibold tracking-[0.055em]">
              <span className="uppercase text-gray-400">
                Acabamento atual
              </span>
              <span className="ml-2 text-gray-600">
                {selection.finish}
              </span>
            </p>
          )}

        {isWheelSelector &&
          selectedVariant?.priceSet != null && (
            <p className="mt-3 text-xs font-semibold tracking-[0.055em]">
              <span className="uppercase text-gray-400">
                Conjunto de 4
              </span>
              <span className="ml-2 font-bold text-gray-800">
                <Price
                  value={selectedVariant.priceSet}
                />
              </span>
            </p>
          )}

        {isInvalidCombination ? (
          <p
            role="alert"
            className="mt-3 text-sm font-semibold text-danger"
          >
            Esta combinação não está
            disponível. Escolha outra
            configuração.
          </p>
        ) : (
          <p className="mt-3 text-xs font-semibold tracking-[0.055em]">
            <span className="uppercase text-gray-400">
              Referência
            </span>
            <span className="ml-2 text-gray-600">
              {sku}
            </span>
          </p>
        )}

        <div className="mt-4">
          {(hasMultipleVariants &&
            !selectionIsComplete &&
            !isInvalidCombination) ? (
            <button
              type="button"
              disabled
              className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-sm bg-gray-100 px-5 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-gray-300"
            >
              Selecione uma opção
            </button>
          ) : isInvalidCombination ? (
            <button
              type="button"
              disabled
              className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-sm bg-gray-100 px-5 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-gray-300"
            >
              Combinação indisponível
            </button>
          ) : (
            <AddToCartButton
              productId={product.id}
              productVariantId={
                selectedVariant?.id
              }
              inStock={canAddToCart}
              variant="product"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function createSelectionFromVariant(
  variant: CatalogVariant,
): Record<string, string> {
  const selection: Record<string, string> = {}

  for (const option of variant.options) {
    selection[option.code] = option.value
  }

  return selection
}
